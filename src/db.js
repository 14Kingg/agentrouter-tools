import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

export class Store {
  constructor(file) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    this.db = new Database(file);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'needs_login',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        status TEXT NOT NULL,
        before_balance REAL,
        after_balance REAL,
        delta REAL,
        message TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(account_id) REFERENCES accounts(id)
      );
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    `);
  }
  createAccount(name) {
    const result = this.db.prepare('INSERT INTO accounts(name) VALUES (?)').run(name.trim());
    return this.getAccount(result.lastInsertRowid);
  }
  getAccounts() { return this.db.prepare('SELECT * FROM accounts ORDER BY id').all(); }
  getAccount(id) { return this.db.prepare('SELECT * FROM accounts WHERE id=?').get(id); }
  setAccountStatus(id, status) { this.db.prepare('UPDATE accounts SET status=? WHERE id=?').run(status, id); }
  deleteAccount(id) { this.db.prepare('DELETE FROM runs WHERE account_id=?').run(id); this.db.prepare('DELETE FROM accounts WHERE id=?').run(id); }
  recordRun(id, run) {
    this.db.prepare('INSERT INTO runs(account_id,status,before_balance,after_balance,delta,message) VALUES(?,?,?,?,?,?)')
      .run(id, run.status, run.before, run.after, run.delta, run.message);
  }
  getRuns(limit = 50) {
    return this.db.prepare(`SELECT runs.*, accounts.name AS account_name FROM runs
      JOIN accounts ON accounts.id=runs.account_id ORDER BY runs.id DESC LIMIT ?`).all(limit);
  }
  getSetting(key, fallback) {
    return this.db.prepare('SELECT value FROM settings WHERE key=?').get(key)?.value ?? fallback;
  }
  setSetting(key, value) {
    this.db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, String(value));
  }
}
