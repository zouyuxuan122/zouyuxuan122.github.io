@echo off
chcp 65001 >nul
title SeatMaster Pro

echo.
echo  ===========================================
echo     🎓 SeatMaster Pro - 启动器
echo     Seating, Reimagined
echo  ===========================================
echo.

REM 方式 1：直接用默认浏览器打开
if "%1"=="browser" goto browser
if "%1"=="electron" goto electron
if "%1"=="build" goto build

:MENU
echo  请选择启动方式：
echo.
echo    [1] 浏览器直接打开（最快）
echo    [2] Electron 桌面应用（需 npm install）
echo    [3] 构建 Windows 安装包
echo    [4] 启动本地服务器
echo.
set /p choice="  请输入选项 (1-4): "

if "%choice%"=="1" goto browser
if "%choice%"=="2" goto electron
if "%choice%"=="3" goto build
if "%choice%"=="4" goto server
goto MENU

:browser
echo.
echo  正在打开浏览器...
start "" "%~dp0index.html"
goto END

:electron
echo.
echo  正在启动 Electron...
cd /d "%~dp0electron"
if not exist "node_modules" (
  echo  首次运行需要安装依赖...
  call npm install
)
call npm start
goto END

:build
echo.
echo  正在构建 Windows 安装包...
cd /d "%~dp0electron"
if not exist "node_modules" call npm install
call npm run build:win
goto END

:server
echo.
echo  正在启动本地服务器 (http://localhost:8000)...
cd /d "%~dp0"
where python >nul 2>&1
if %errorlevel%==0 (
  python -m http.server 8000
) else (
  where npx >nul 2>&1
  if %errorlevel%==0 (
    npx -y http-server -p 8000 -c-1
  ) else (
    echo  请安装 Python 或 Node.js 后再使用此选项
    pause
  )
)
goto END

:END
echo.
pause
