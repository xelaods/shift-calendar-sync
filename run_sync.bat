@echo off
chcp 65001 > NUL
echo ============================================================
echo  シフト Googleカレンダー自動同期
echo ============================================================
cd /d "%~dp0"

echo 必要なライブラリを確認中...
python -m pip install -q requests beautifulsoup4

echo.
echo 同期処理を実行しています...
python sync_shift.py

echo.
pause
