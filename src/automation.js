import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE = 'https://agentrouter.org';

export class AgentRouterAutomation {
  constructor({ profileRoot, db, log }) {
    this.profileRoot = profileRoot;
    this.db = db;
    this.log = log;
  }

  browserOptions(headless) {
    const options = { headless, viewport: { width: 1440, height: 960 } };
    const proxy = this.db.getSetting('proxyUrl', '').trim();
    if (proxy) options.proxy = { server: proxy };
    return options;
  }

  profilePath(accountId) {
    return path.join(this.profileRoot, String(accountId));
  }

  async addAccount(name) {
    const account = this.db.createAccount(name);
    const context = await chromium.launchPersistentContext(
      this.profilePath(account.id),
      this.browserOptions(false)
    );
    try {
      const page = context.pages()[0] || await context.newPage();
      await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      this.log('info', `请在打开的浏览器中完成 GitHub 登录：${name}`);
      await page.waitForURL(url => url.hostname === 'agentrouter.org' && !url.pathname.includes('/login'), { timeout: 180000 });
      const cookies = await context.cookies(BASE);
      if (!cookies.some(c => c.name === 'session' && c.value)) {
        throw new Error('登录流程结束，但没有检测到 AgentRouter session cookie');
      }
      this.db.setAccountStatus(account.id, 'ready');
      this.log('success', `账号「${name}」已完成首次登录并保存浏览器会话`);
      return this.db.getAccount(account.id);
    } catch (error) {
      this.db.setAccountStatus(account.id, 'needs_login');
      throw error;
    } finally {
      await context.close();
    }
  }

  async runAccount(account) {
    const profileDir = this.profilePath(account.id);
    await fs.access(profileDir);
    const context = await chromium.launchPersistentContext(profileDir, {
      ...this.browserOptions(true)
    });
    let page;
    try {
      page = context.pages()[0] || await context.newPage();
      let apiUser = null;
      page.on('request', async request => {
        try {
          const headers = await request.allHeaders();
          if (headers['new-api-user']) apiUser = String(headers['new-api-user']);
        } catch { /* request may finish while context is closing */ }
      });
      // Load the signed-in console first so the app can emit its account identity header.
      await page.goto(`${BASE}/console`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(1800);
      const before = await this.readBalance(page, context, apiUser).catch(() => null);

      // Remove only AgentRouter cookies. GitHub's saved login remains in the profile.
      const cookies = await context.cookies(BASE);
      for (const cookie of providerCookies) {
        await context.clearCookies({ name: cookie.name, domain: cookie.domain });
      }

      await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      const githubButton = page.getByText('使用 GitHub 继续', { exact: true }).first();
      await githubButton.waitFor({ state: 'visible', timeout: 30000 });
      const popupPromise = context.waitForEvent('page', { timeout: 8000 }).catch(() => null);
      await githubButton.click();
      const oauthPage = await popupPromise;

      this.log('info', `「${account.name}」已发起 GitHub OAuth${oauthPage ? '（新窗口）' : ''}，等待 AgentRouter 回调`);
      // AgentRouter deployments may complete OAuth in the same tab or a popup.
      // Wait for a provider-origin page and a newly issued provider session cookie.
      const deadline = Date.now() + 120000;
      let session = null;
      while (Date.now() < deadline) {
        const providerPage = context.pages().find(candidate => {
          try {
            const url = new URL(candidate.url());
            return url.hostname === 'agentrouter.org' && !url.pathname.includes('/login');
          } catch { return false; }
        });
        const sessionCookies = await context.cookies(BASE);
        session = sessionCookies.find(cookie => cookie.name === 'session' && cookie.value);
        if (session) {
          page = providerPage || page;
          break;
        }
        await page.waitForTimeout(500);
      }
      if (!session) throw new Error('OAuth 返回超时：没有检测到新的 AgentRouter session');

      const after = await this.readBalance(page, context, apiUser).catch(error => {
        this.log('warn', `余额读取失败：${error.message}`);
        return null;
      });

      const delta = before && after ? Number((after.quota - before.quota).toFixed(2)) : null;
      this.db.recordRun(account.id, {
        status: 'success',
        before: before?.quota ?? null,
        after: after?.quota ?? null,
        delta,
        message: delta === null ? 'OAuth 登录成功；余额差额暂不可用' : `OAuth 登录成功；余额变化 ${delta >= 0 ? '+' : ''}${delta}`
      });
      this.db.setAccountStatus(account.id, 'ready');
      this.log('success', `「${account.name}」OAuth 登录成功；当前余额：${after ? after.quota : '暂不可读取'}`);
      return { status: 'success', before, after, delta };
    } catch (error) {
      this.db.recordRun(account.id, { status: 'failed', message: error.message });
      if (/GitHub|OAuth|session|登录/.test(error.message)) this.db.setAccountStatus(account.id, 'needs_login');
      this.log('error', `「${account.name}」签到失败：${error.message}`);
      throw error;
    } finally {
      await context.close();
    }
  }

  async readBalance(page, context, apiUser) {
    const cookies = await context.cookies(BASE);
    const session = cookies.find(c => c.name === 'session' && c.value);
    if (!session) return null;
    const result = await page.evaluate(async (identity) => {
      const response = await fetch('/api/user/self', {
        credentials: 'include',
        cache: 'no-store',
        headers: identity ? { Accept: 'application/json', 'new-api-user': identity } : { Accept: 'application/json' }
      });
      if (!response.ok) throw new Error(`余额接口 HTTP ${response.status}`);
      return response.json();
    }, apiUser);
    if (!result?.success || !result?.data) throw new Error('余额接口返回格式异常');
    const data = result.data;
    if (apiUser && String(data.id) !== String(apiUser)) throw new Error('余额接口账号 ID 与当前账号不匹配');
    return {
      userId: data.id == null ? null : String(data.id),
      quota: Number((Number(data.quota || 0) / 500000).toFixed(2)),
      used: Number((Number(data.used_quota || 0) / 500000).toFixed(2))
    };
  }
}
