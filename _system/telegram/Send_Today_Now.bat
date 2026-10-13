@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0send_telegram.ps1"
echo Bhej diya (log: log.txt). & pause
