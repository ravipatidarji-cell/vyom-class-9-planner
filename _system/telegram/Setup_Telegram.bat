@echo off
chcp 65001 >nul
echo ===== Vyom Planner - Telegram setup =====
echo.
echo Pehle: Telegram group banao (Ravi, Vyom, SNP + aapka bot). Group me bot ko add karo
echo aur group me ek message likho:  /start
echo.
pause
set PS=powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0send_telegram.ps1"
%PS% -FindChat
if errorlevel 1 goto end
%PS% -Test
echo.
echo Roz subah 6:15 ka auto-message set kar raha hoon (Windows Task Scheduler)...
%PS% -Register
echo.
echo Aaj ka message abhi bhejna ho to: Send_Today_Now.bat chalao.
:end
pause
