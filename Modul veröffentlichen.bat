@echo off
rem Prueft, fragt nach und veroeffentlicht die Version aus module.json als GitHub-Release.
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul || set "PATH=E:\Apps\nodejs;%PATH%"
where git >nul 2>nul || set "PATH=E:\Apps\Git\cmd;%PATH%"
where gh >nul 2>nul || set "PATH=C:\Program Files\GitHub CLI;%PATH%"
node tools\publish.mjs
echo.
pause
