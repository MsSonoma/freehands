@echo off
setlocal
cd /d "%~dp0.."
echo Starting Freehands tray (debug mode)...
echo If it crashes, check: %TEMP%\freehands-tray.log
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -STA -File scripts\freehands-tray.ps1
