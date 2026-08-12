@echo off
setlocal
chcp 65001 >nul
title GeoJSON 地图编辑器 - 本地服务器

echo ========================================
echo    GeoJSON 地图编辑器
echo ========================================
echo.
echo 正在准备本地开发服务器...
echo.
echo 提示：
echo  * 首次启动会自动安装依赖，请保持联网
echo  * 浏览器将自动打开 Vite 本地地址
echo  * 关闭此窗口/按 Ctrl+C 可停止服务器
echo ========================================
echo.

cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo [错误] 未检测到 Node.js。
    echo 请先安装 Node.js 22 LTS 或更新版本：https://nodejs.org/
    echo.
    pause
    exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
    echo [错误] 未检测到 npm。请重新安装 Node.js 并勾选 npm。
    echo.
    pause
    exit /b 1
)

if not exist "node_modules\vite\bin\vite.js" (
    echo 正在安装项目依赖...
    call npm ci
    if errorlevel 1 (
        echo.
        echo [错误] 依赖安装失败。请检查网络、npm 源或 Node.js 版本。
        pause
        exit /b 1
    )
)

echo 正在生成本地 vendor 资源...
call npm run prepare:vendor
if errorlevel 1 (
    echo.
    echo [错误] vendor 资源生成失败。
    pause
    exit /b 1
)

echo.
echo 启动地址会显示在下方，通常是 http://127.0.0.1:5173/
echo.
call npm run dev -- --host 127.0.0.1 --open

pause
