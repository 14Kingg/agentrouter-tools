# AgentRouter Tools

Node.js + Playwright local Web GUI for AgentRouter GitHub OAuth check-in.

## Features

- Add AgentRouter accounts through a visible GitHub OAuth browser window.
- Persist each account's browser profile locally; GitHub passwords are never stored.
- Daily scheduled OAuth re-login (default 01:00, local machine timezone).
- Before/after balance snapshots and reward delta when the upstream balance API is available.
- Manual run, task enable/disable, run history and live logs in the web UI.
- Local JSON data store; no native database addon or C++ build tools required.

## Requirements

- Node.js 20+
- Windows, macOS or Linux desktop session for first-time GitHub login.
- Network access to agentrouter.org and github.com. Configure an HTTP proxy in Settings if required.

## Windows quick start

1. Run `install.bat` once.
2. Run `start.bat`.
3. Open http://127.0.0.1:3210 if it does not open automatically.

## Manual start

```bash
npm install
npm run install:browser
npm start
```

The server binds to loopback only. Do not expose it to the public network: the local UI controls browser profiles and account sessions.

## First-time account setup

1. Click **添加 GitHub 账号** in the UI.
2. Enter a local display name.
3. Complete GitHub sign-in, MFA and OAuth approval in the opened browser.
4. The app checks for an AgentRouter session cookie and saves the persistent browser profile.

GitHub security checks, CAPTCHA and MFA are intentionally left for the user.

## Daily workflow

The scheduler opens the account's persistent Chromium profile, clears AgentRouter cookies while retaining GitHub cookies, visits the AgentRouter login page and starts GitHub OAuth again. It waits for a new AgentRouter session, then attempts to read the account balance.

The balance endpoint currently defaults to `GET /api/user/self`. Balance comparison is reported as unavailable if the endpoint or account identity information cannot be verified.

## Configuration

- Daily run time (local timezone; default 01:00)
- Optional HTTP proxy (for example `http://127.0.0.1:7890`)

## Local data and security

- `data/agentrouter.json`: accounts, settings and run history.
- `browser-profiles/`: persistent Chromium profiles and login cookies.
- Both paths are local and ignored by Git. Back them up together if migrating.
- GitHub passwords and personal access tokens are not collected.
- Keep the app bound to localhost.

## Reference and attribution

The workflow design was informed by [jiang7f/checkin-agentrouter](https://github.com/jiang7f/checkin-agentrouter) (MIT License, Copyright (c) 2026 jiang7f). This repository contains an independent Node.js implementation and does not bundle the upstream Python source. See `THIRD_PARTY_NOTICES.md`.

## Development status

Initial implementation. Validate OAuth selectors and AgentRouter's balance response against your account before relying on unattended scheduling. Browser challenges and expired GitHub sessions require user intervention.
