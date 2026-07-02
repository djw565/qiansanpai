@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ========================================
echo   前三排 · 网站更新部署
echo ========================================
echo.

echo [1/3] 重新生成网站页面...
python build.py
if errorlevel 1 (
    echo.
    echo ❌ 构建失败！截图上面的错误信息发我
    pause
    exit /b 1
)
echo.
echo [2/3] 提交更新...
git add .
git commit -m "更新 %date%"
if errorlevel 1 (
    echo （没有新变更，跳过提交）
)
echo.
echo [3/3] 推送到 GitHub...
git push
if errorlevel 1 (
    echo.
    echo ❌ 推送失败！可能原因：
    echo   1. SSH Key 没配好
    echo   2. 网络问题
    echo   3. GitHub 仓库权限问题
    echo.
    echo 截图上面的错误信息发我
    pause
    exit /b 1
)
echo.
echo ========================================
echo   ✅ 完成！等1分钟后刷新网站
echo   https://djw565.github.io/qiansanpai/
echo ========================================
echo.
echo   💡 新文章：放到 raw 的 txt 文件夹后双击本文件
echo   💡 新PDF：放到 raw 的 pdf 文件夹后双击本文件
echo.
pause
