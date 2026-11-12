@echo off
setlocal
cd /d "%~dp0"
if not exist node_modules (
  echo Please run install.bat first.
  pause
  exit /b 1
)
start "" http://127.0.0.1:3210
call npm start
pause
