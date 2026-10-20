@echo off
chcp 65001 >nul
setlocal
title 重置演示数据

set "DATA=E:\科大云盘\云盘文件\科大植物地图"
set "OUT=%~dp0backups"

if not exist "%DATA%" (
  echo [错误] 找不到数据目录：%DATA%
  pause
  exit /b 1
)

echo 此操作会清空：
echo   1. 社区帖子
echo   2. 上传投稿
echo   3. 上述记录关联的图片文件
echo 物种库（src\data\species.json）不受影响。
echo.
set /p ANSWER=确定继续吗？(y/N)
if /i not "%ANSWER%"=="y" (
  echo 已取消。
  pause
  exit /b 0
)

if not exist "%OUT%" mkdir "%OUT%"
for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"`) do set "STAMP=%%i"

echo.
echo [1/2] 先备份当前数据...
powershell -NoProfile -Command "Compress-Archive -Path '%DATA%\*' -DestinationPath '%OUT%\重置前备份-%STAMP%.zip' -Force"
if errorlevel 1 (
  echo [错误] 备份失败，已中止重置。
  pause
  exit /b 1
)
echo       备份：%OUT%\重置前备份-%STAMP%.zip

echo [2/2] 重置数据文件与图片目录...
powershell -NoProfile -Command "$p='%DATA%\植物地图数据.json'; $o=[ordered]@{'ustc-veg-community-posts'=@(); 'ustc-veg-community-author'=''; 'ustc-veg-submissions'=@()}; $json=$o | ConvertTo-Json -Depth 5; [System.IO.File]::WriteAllText($p, $json, (New-Object System.Text.UTF8Encoding($false)))"
if errorlevel 1 (
  echo [错误] 写入数据文件失败。
  pause
  exit /b 1
)
powershell -NoProfile -Command "if (Test-Path -LiteralPath '%DATA%\图片') { Get-ChildItem -LiteralPath '%DATA%\图片' -File | Remove-Item -Force }"

echo.
echo 重置完成。重新启动服务即可从空白演示数据开始。
pause
