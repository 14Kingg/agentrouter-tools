@echo off
setlocal
cd /d "%~dp0"

echo [AgentRouter Tools] Checking Node.js...
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js 20 or newer, then run this script again.
  pause
  exit /b 1
)
node -e "const v=Number(process.versions.node.split('.')[0]); if(v<20){console.error('Node.js 20 or newer is required.');process.exit(1)}"
if errorlevel 1 (
  pause
  exit /b 1
)

echo [AgentRouter Tools] Installing Node.js dependencies...
call npm install
if errorlevel 1 (
  echo.
  echo Dependency installation failed. Review the npm error above.
  pause
  exit /b 1
)

echo [AgentRouter Tools] Installing Chromium...
call npx playwright install chromium
if errorlevel 1 (
  echo.
  echo Chromium installation failed. Review the error above.
  pause
  exit /b 1
)

echo.
echo Setup complete. Run start.bat to open the dashboard.
pause
