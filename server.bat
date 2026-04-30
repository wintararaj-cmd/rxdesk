@echo off
setlocal
title RxDesk Server Launcher

:: Set current directory
cd /d %~dp0

:menu
cls
echo ========================================================
echo           RxDesk - Pharmacy Management System
echo ========================================================
echo.
echo  [1]  START ALL (Docker + Backend + Web + Mobile)
echo  [2]  START BACKEND ONLY (Port: 3000)
echo  [3]  START WEB DASHBOARD ONLY (Port: 3001)
echo  [4]  START DOCKER (Database + Redis)
echo.
echo  [5]  PRODUCTION BUILD (Recommended for PWA Testing)
echo  [6]  STOP ALL DOCKER CONTAINERS
echo.
echo  [7]  EXIT
echo.
echo ========================================================
set /p choice="Select an option (1-7): "

if "%choice%"=="1" goto start_all
if "%choice%"=="2" goto start_backend
if "%choice%"=="3" goto start_web
if "%choice%"=="4" goto start_docker
if "%choice%"=="5" goto build_prod
if "%choice%"=="6" goto stop_docker
if "%choice%"=="7" goto exit
goto menu

:start_docker
echo.
echo [Action] Starting Docker services (Postgres, Redis)...
docker-compose up -d
echo.
echo Services are running in background.
pause
goto menu

:start_all
echo.
echo [Action] Launching all systems...
docker-compose up -d
echo Launching Backend...
start "RxDesk - Backend" cmd /k "npm run dev --filter=@rxdesk/backend"
echo Launching Web...
start "RxDesk - Web" cmd /k "npm run dev --filter=@rxdesk/web"
echo Launching Mobile...
start "RxDesk - Mobile" cmd /k "npm run start --filter=@rxdesk/mobile"
echo.
echo All systems are booting up in separate windows.
pause
goto menu

:start_backend
echo.
echo [Action] Launching Backend only...
docker-compose up -d
start "RxDesk - Backend" cmd /k "npm run dev --filter=@rxdesk/backend"
goto menu

:start_web
echo.
echo [Action] Launching Web Dashboard only...
start "RxDesk - Web" cmd /k "npm run dev --filter=@rxdesk/web"
goto menu

:build_prod
echo.
echo [Action] Creating Production Build...
echo This will enable PWA and optimize the code.
npm run build
echo.
echo Build finished! 
echo To run the production web server: 
echo cd apps\web && npm run start
pause
goto menu

:stop_docker
echo.
echo [Action] Stopping all Docker containers...
docker-compose down
echo Containers stopped.
pause
goto menu

:exit
echo Goodbye!
exit
