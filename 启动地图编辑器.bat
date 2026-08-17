@echo off
setlocal
chcp 65001 >nul
title GeoJSON Map Editor - Local Server

echo ========================================
echo    GeoJSON Map Editor
echo ========================================
echo.
echo Preparing the local development server...
echo.
echo Notes:
echo  * First launch may install dependencies and needs network access.
echo  * The browser will open the Vite local URL automatically.
echo  * Close this window or press Ctrl+C to stop the server.
echo ========================================
echo.

cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js was not found.
    echo Please install Node.js 22 LTS or newer: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
    echo [ERROR] npm was not found. Please reinstall Node.js with npm enabled.
    echo.
    pause
    exit /b 1
)

if not exist "package-lock.json" (
    echo [ERROR] package-lock.json was not found. Please run this file from the project root.
    echo.
    pause
    exit /b 1
)

set "NEEDS_INSTALL=0"
if not exist "node_modules\vite\bin\vite.js" set "NEEDS_INSTALL=1"
if not exist "node_modules\@fortawesome\fontawesome-free\css\all.min.css" set "NEEDS_INSTALL=1"
if not exist "node_modules\leaflet\dist\leaflet.js" set "NEEDS_INSTALL=1"
if not exist "node_modules\dompurify\dist\purify.min.js" set "NEEDS_INSTALL=1"

if "%NEEDS_INSTALL%"=="1" (
    echo Installing project dependencies...
    call npm ci
    if errorlevel 1 (
        echo.
        echo [ERROR] Dependency installation failed. Check your network, npm registry, and Node.js version.
        pause
        exit /b 1
    )
)

echo Preparing local vendor assets...
call npm run prepare:vendor
if errorlevel 1 (
    echo.
    echo [ERROR] Vendor asset preparation failed.
    echo Try deleting node_modules and running this launcher again.
    pause
    exit /b 1
)

echo.
echo The local URL will be printed below, usually http://127.0.0.1:5173/
echo.
call npm run dev -- --host 127.0.0.1 --open

pause
