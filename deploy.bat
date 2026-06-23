@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ========================================
echo   前三排 · 网站更新部署
echo ========================================
echo.
echo [1/4] 提取金句...
python extract_quotes.py
if errorlevel 1 (
    echo 金句提取失败（不影响主流程）
)
echo.
echo [2/4] 重新生成网站页面...
python build.py
if errorlevel 1 (
    echo 构建失败，请检查错误信息
    pause
    exit /b 1
)
echo.
echo [3/4] 提交更新...
git add .
git commit -m "更新文章内容 %date%"
echo.
echo [4/4] 推送到 GitHub...
git push
echo.
echo ========================================
echo   ✅ 完成！等1分钟后刷新网站即可
echo   https://djw565.github.io/qiansanpai/
echo ========================================
pause
