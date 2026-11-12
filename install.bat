@echo off
setlocal
cd /d "%~dp0"
echo [AgentRouter Tools] Installing Node.js dependencies...
call npm install
if errorlevel 1 (
  echo Dependency installation failed. Check that Node.js 20+ and npm are installed.
  pause
  exit /b 1
)
echo [AgentRouter Tools] Installing Chromium...
call npx playwright install chromium
if errorlevel 1 (
  echo Chromium installation failed.
  pause
  exit /b 1
)
echo.
echo Setup complete. Run start.bat to open the dashboard.
pause
