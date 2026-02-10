@echo off
setlocal

REM Freehands dev launcher (port 3001)
REM Double-click this file, or make a desktop shortcut to it.

cd /d "%~dp0.."
echo.
echo Freehands: clean restart + dev server on http://localhost:3001
echo Working dir: %CD%
echo.

echo [1/3] Stopping anything on port 3001...
call npm run -s kill:3001

echo.
echo [2/3] Cleaning Next.js build caches...
call npm run -s clean

echo.
echo [3/3] Starting dev server...

call npm run dev

echo.
echo Dev server stopped. Press any key to close.
pause >nul
