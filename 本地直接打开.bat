@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"
echo Opening MagicCube app directly...
start "" "%~dp0index.html"
