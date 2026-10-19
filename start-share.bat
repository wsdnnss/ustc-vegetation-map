@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title 中科大植被分布 · 一键共享服务

set "PROJECT=E:\ustc-vegetation-map"
set "START_PORT=8080"
set "END_PORT=8090"
set "PORT="

echo ============================================================
echo    中科大本部植被分布  ·  一键共享启动
echo ============================================================
echo.

rem ---------- 0) 刷新 PATH，确保能找到 node / pnpm ----------
for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')"`) do set "PATH=%%P"

if not exist "%PROJECT%" (
  echo [错误] 找不到项目目录: %PROJECT%
  goto :end
)
cd /d "%PROJECT%"

where pnpm >nul 2>&1
if errorlevel 1 (
  echo [错误] 未找到 pnpm，请确认已安装 Node 并重启过本机/终端。
  goto :end
)

rem ---------- 1) 构建 ----------
echo [1/3] 正在构建（pnpm run build）...
call pnpm run build
if errorlevel 1 (
  echo.
  echo [错误] 构建失败，请查看上面的报错信息。
  goto :end
)
echo       构建完成。
echo.

rem ---------- 2) 找一个空闲端口 ----------
echo [2/3] 查找可用端口（%START_PORT% - %END_PORT%）...
for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "$s=%START_PORT%;$e=%END_PORT%;$p=$s;while($p -le $e -and (Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue)){$p++};if($p -gt $e){''}else{$p}"`) do set "PORT=%%P"
if "%PORT%"=="" (
  echo [错误] %START_PORT% - %END_PORT% 端口全部被占用，请先关闭占用程序。
  goto :end
)
echo       使用端口: %PORT%
echo.

rem ---------- 3) 打印 IPv6 访问地址 ----------
echo [3/3] 本机 IPv6 访问地址（发给队友，方括号不能省略）：
echo.
powershell -NoProfile -Command "Get-NetIPAddress -AddressFamily IPv6 -ErrorAction SilentlyContinue | Where-Object { $_.AddressState -eq 'Preferred' -and $_.IPAddress -ne '::1' -and $_.IPAddress -notlike 'fe80*' -and $_.IPAddress -notlike 'fd*' -and $_.IPAddress -notlike '2001:0:*' } | ForEach-Object { '        http://[' + $_.IPAddress + ']:%PORT%/        [' + $_.InterfaceAlias + ']' }"
echo.
echo        本机预览:  http://[::1]:%PORT%/
echo ============================================================
echo    服务已启动。停止请按 Ctrl+C 或直接关闭本窗口。
echo ============================================================
echo.

rem 使用项目自带的 node 服务：同时提供网页与 /api/store 数据接口，
rem 社区帖子、投稿会写入科大云盘同步目录（E:\科大云盘\云盘文件\科大植物地图）
node "%PROJECT%\server.mjs" %PORT%

echo.
echo 服务已停止。

:end
pause
