@echo off
chcp 65001 >nul
setlocal
title 备份植物地图数据

set "DATA=E:\科大云盘\云盘文件\科大植物地图"
set "OUT=%~dp0backups"

if not exist "%DATA%" (
  echo [错误] 找不到数据目录：%DATA%
  pause
  exit /b 1
)
if not exist "%OUT%" mkdir "%OUT%"

for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"`) do set "STAMP=%%i"

echo 正在备份到 %OUT%\植物地图数据-%STAMP%.zip ...
powershell -NoProfile -Command "Compress-Archive -Path '%DATA%\*' -DestinationPath '%OUT%\植物地图数据-%STAMP%.zip' -Force"
if errorlevel 1 (
  echo [错误] 备份失败，请确认数据目录非空且未被占用。
  pause
  exit /b 1
)

echo.
echo 备份完成：%OUT%\植物地图数据-%STAMP%.zip
pause
