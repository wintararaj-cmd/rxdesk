@echo off
echo Starting RxDesk development servers...
echo.

:: Start Docker services (PostgreSQL + Redis)
echo [1/4] Starting Docker services...
docker-compose up -d
echo.

:: Start Backend (Express + Prisma)
echo [2/4] Starting Backend on :3000...
start "RxDesk - Backend" cmd /k "cd /d %~dp0apps\backend && npm run dev"

:: Start Web (Next.js on port 3001)
echo [3/4] Starting Web on :3001...
start "RxDesk - Web" cmd /k "cd /d %~dp0apps\web && npm run dev"

:: Start Mobile (Expo)
echo [4/4] Starting Mobile (Expo)...
start "RxDesk - Mobile" cmd /k "cd /d %~dp0apps\mobile && npm run start"

echo.
echo All servers launched. Close the individual windows to stop each server.
echo To stop Docker: npm run docker:down
