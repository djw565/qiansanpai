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
    echo ❌ 构建失败，请检查错误信息
    pause
    exit /b 1
)
echo.
echo [2/3] 提交更新...
git add .
git commit -m "更新文章内容 %date%"
echo.
echo [3/3] 推送到 GitHub...
git push
echo.
echo ========================================
echo   ✅ 完成！等1分钟后刷新网站即可
echo   https://djw565.github.io/qiansanpai/
echo ========================================
pause
