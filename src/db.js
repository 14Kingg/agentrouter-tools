import fs from 'node:fs';
import path from 'node:path';

export class Store {
  constructor(file) {
    this.file = file;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    this.state = { nextAccountId: 1, nextRunId: 1, accounts: [], runs: [], settings: {} };
    if (fs.existsSync(file)) {
      try {
        const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
        this.state = { ...this.state, ...saved };
      } catch (error) {
        throw new Error(`无法读取本地数据文件 ${file}：${error.message}`);
      }
    }
  }

  persist() {
    const temp = `${this.file}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(this.state, null, 2), 'utf8');
    fs.renameSync(temp, this.file);
  }

  createAccount(name) {
    if (this.state.accounts.some(item => item.name === name.trim())) {
      throw new Error('这个账号备注已经存在');
    }
    const account = {
      id: this.state.nextAccountId++,
      name: name.trim(),
      status: 'needs_login',
      created_at: new Date().toISOString()
    };
    this.state.accounts.push(account);
    this.persist();
    return { ...account };
  }

  getAccounts() {
    return this.state.accounts.map(item => ({ ...item })).sort((a, b) => a.id - b.id);
  }

  getAccount(id) {
    const item = this.state.accounts.find(account => account.id === Number(id));
    return item ? { ...item } : undefined;
  }

  setAccountStatus(id, status) {
    const item = this.state.accounts.find(account => account.id === Number(id));
    if (item) {
      item.status = status;
      this.persist();
    }
  }

  deleteAccount(id) {
    this.state.accounts = this.state.accounts.filter(item => item.id !== Number(id));
    this.state.runs = this.state.runs.filter(item => item.account_id !== Number(id));
    this.persist();
  }

  recordRun(id, run) {
    this.state.runs.push({
      id: this.state.nextRunId++,
      account_id: Number(id),
      status: run.status,
      before_balance: run.before ?? null,
      after_balance: run.after ?? null,
      delta: run.delta ?? null,
      message: run.message ?? '',
      created_at: new Date().toISOString()
    });
    this.persist();
  }

  getRuns(limit = 50) {
    const names = new Map(this.state.accounts.map(account => [account.id, account.name]));
    return this.state.runs
      .slice()
      .sort((a, b) => b.id - a.id)
      .slice(0, limit)
      .map(run => ({ ...run, account_name: names.get(run.account_id) || '已删除账号' }));
  }

  getSetting(key, fallback) {
    return Object.prototype.hasOwnProperty.call(this.state.settings, key)
      ? this.state.settings[key]
      : fallback;
  }

  setSetting(key, value) {
    this.state.settings[key] = String(value);
    this.persist();
  }
}
