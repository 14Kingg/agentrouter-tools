# AgentRouter Tools

Node.js + Playwright + SQLite local Web GUI for AgentRouter GitHub OAuth check-in.

## Features

- Add one or more AgentRouter accounts through a visible GitHub OAuth browser window.
- Persist each account's browser profile locally; GitHub credentials are never stored by this app.
- Daily scheduled OAuth re-login (default 01:00, local machine timezone).
- Before/after balance snapshots and reward delta where the balance API is available.
- Manual run, task enable/disable, run history and live logs in the web UI.
- Account profiles, cookies, SQLite database and logs stay on the local machine.

## Requirements

- Node.js 20+
- Windows, macOS or Linux desktop session for first-time GitHub login.
- Network access to agentrouter.org and github.com. Configure a proxy in Settings if required.

## Start

```bash
npm install
npm run install:browser
npm start
```

Open http://127.0.0.1:3210.

The server binds to loopback only. Do not expose it to the public network: the local UI controls browser profiles and account sessions.

## First-time account setup

1. Click **Add account** in the UI.
2. Enter a local display name and click **Start GitHub login**.
3. Complete GitHub sign-in / MFA / OAuth approval in the opened browser.
4. The app verifies an AgentRouter session cookie and saves the persistent profile.

The OAuth provider may require a one-time manual approval or challenge. The app does not bypass MFA, CAPTCHA or GitHub security checks.

## Daily workflow

The scheduler opens the account's persistent Chromium profile, clears only AgentRouter cookies (not GitHub cookies), visits the AgentRouter login page and starts GitHub OAuth again. It waits for a new AgentRouter session, then reads the current balance. AgentRouter currently triggers its daily reward as part of a fresh GitHub OAuth login; no separate sign-in POST is assumed.

Balance endpoint defaults to `GET /api/user/self`; quota units are converted using the upstream project's documented divisor (500000). Balance comparison is marked unavailable rather than fabricated when the API denies access or does not return the account identity/header needed for verification.

## Configuration

Settings in the UI:
- Daily run time (local timezone; default 01:00)
- AgentRouter base URL
- Optional HTTP proxy (for example `http://127.0.0.1:7890`)
- Headless mode (first-time account setup always opens a visible browser)

## Security

- Browser profiles and SQLite data are local and ignored by Git.
- GitHub passwords and personal access tokens are not collected.
- Keep the app bound to localhost.
- Back up the `data/` and `browser-profiles/` directories together if you want to migrate accounts.

## Development status

Initial implementation. Validate OAuth selectors and AgentRouter's balance response against your account before relying on unattended scheduling. Browser challenges and expired GitHub sessions require user intervention.
