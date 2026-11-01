@echo off
chcp 65001 >nul 2>&1
title MagicCube Launcher
cd /d "%~dp0"

set "NODE="
if exist "%USERPROFILE%\.workbuddy\binaries\node\versions\22.22.2-6\node.exe" set "NODE=%USERPROFILE%\.workbuddy\binaries\node\versions\22.22.2-6\node.exe"
if not defined NODE (
  for /d %%v in ("%USERPROFILE%\.workbuddy\binaries\node\versions\*") do if not defined NODE if exist "%%v\node.exe" set "NODE=%%v\node.exe"
)
if not defined NODE (
  where node >nul 2>nul && set "NODE=node"
)
if not defined NODE (
  if exist "C:\Program Files\nodejs\node.exe" set "NODE=C:\Program Files\nodejs\node.exe"
)

if defined NODE (
  echo [OK] node found. Starting local server...
  start "MagicCube-Server" "%NODE%" serve.js
  ping -n 3 127.0.0.1 >nul
  echo Opening browser at http://localhost:8080 ...
  start "" http://localhost:8080
  echo.
  echo ============================================
  echo  Server started. Browser should open at
  echo  http://localhost:8080
  echo  Close the "MagicCube-Server" window to stop.
  echo ============================================
  ping -n 7 127.0.0.1 >nul
  exit /b 0
)

set "PY="
where python >nul 2>nul && set "PY=python"
if not defined PY (
  if exist "%USERPROFILE%\.workbuddy\binaries\python\versions\3.13.12\python.exe" set "PY=%USERPROFILE%\.workbuddy\binaries\python\versions\3.13.12\python.exe"
)
if defined PY (
  echo [OK] node not found, using python for local server...
  start "MagicCube-Server" "%PY%" -m http.server 8080
  ping -n 3 127.0.0.1 >nul
  echo Opening browser at http://localhost:8080 ...
  start "" http://localhost:8080
  echo.
  echo ============================================
  echo  Server started. Browser should open at
  echo  http://localhost:8080
  echo  Close the "MagicCube-Server" window to stop.
  echo ============================================
  ping -n 7 127.0.0.1 >nul
  exit /b 0
)

echo [WARN] node and python not found. Opening page directly.
echo  (Bluetooth cube connect and offline cache unavailable in this mode.)
start "" "%~dp0index.html"
pause
