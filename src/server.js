import express from 'express';
import cron from 'node-cron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store } from './db.js';
import { AgentRouterAutomation } from './automation.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dataDir = path.join(root, 'data');
const store = new Store(path.join(dataDir, 'agentrouter.sqlite'));
fs.mkdirSync(path.join(root, 'browser-profiles'), { recursive: true });

const app = express();
app.use(express.json());
app.use(express.static(path.join(root, 'public')));
const clients = new Set();
const logs = [];
function log(level, message) {
  const item = { time: new Date().toISOString(), level, message };
  logs.unshift(item);
  if (logs.length > 300) logs.pop();
  for (const client of clients) client.write(`data: ${JSON.stringify(item)}\n\n`);
  console.log(`[${level}] ${message}`);
}
const automation = new AgentRouterAutomation({
  profileRoot: path.join(root, 'browser-profiles'), db: store, log
});
let running = false;

async function runAll() {
  if (running) throw new Error('签到任务正在运行中');
  running = true;
  try {
    for (const account of store.getAccounts()) {
      try { await automation.runAccount(account); }
      catch { /* error already logged and persisted */ }
    }
  } finally { running = false; }
}

function schedule() {
  const expression = store.getSetting('schedule', '0 1 * * *');
  if (!cron.validate(expression)) throw new Error('无效的 Cron 表达式');
  if (globalThis.dailyTask) globalThis.dailyTask.stop();
  globalThis.dailyTask = cron.schedule(expression, () => {
    log('info', '开始执行每日自动签到');
    runAll().catch(error => log('error', error.message));
  });
}
schedule();

app.get('/api/state', (req, res) => res.json({
  accounts: store.getAccounts(),
  runs: store.getRuns(),
  schedule: store.getSetting('schedule', '0 1 * * *'),
  enabled: store.getSetting('enabled', 'true') === 'true',
  running
}));
app.get('/api/logs', (req, res) => res.json(logs));
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  clients.add(res);
  req.on('close', () => clients.delete(res));
});
app.post('/api/accounts', async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name || name.length > 40) return res.status(400).json({ error: '请输入 1-40 个字符的账号名称' });
  try {
    const account = await automation.addAccount(name);
    res.json({ account });
  } catch (error) { res.status(500).json({ error: error.message }); }
});
app.delete('/api/accounts/:id', async (req, res) => {
  const id = Number(req.params.id);
  const account = store.getAccount(id);
  if (!account) return res.sendStatus(404);
  store.deleteAccount(id);
  fs.rmSync(path.join(root, 'browser-profiles', String(id)), { recursive: true, force: true });
  res.json({ ok: true });
});
app.post('/api/run', async (req, res) => {
  if (running) return res.status(409).json({ error: '任务正在运行' });
  runAll().catch(error => log('error', error.message));
  res.json({ ok: true });
});
app.put('/api/settings', (req, res) => {
  const scheduleValue = String(req.body.schedule || '0 1 * * *');
  if (!cron.validate(scheduleValue)) return res.status(400).json({ error: 'Cron 表达式无效' });
  store.setSetting('schedule', scheduleValue);
  store.setSetting('enabled', req.body.enabled ? 'true' : 'false');
  if (req.body.enabled) schedule();
  else if (globalThis.dailyTask) globalThis.dailyTask.stop();
  res.json({ ok: true });
});

const port = Number(process.env.PORT || 3210);
app.listen(port, '127.0.0.1', () => log('success', `AgentRouter Tools 已启动：http://127.0.0.1:${port}`));
