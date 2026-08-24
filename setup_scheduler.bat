@echo off
chcp 65001 > NUL
set TASK_NAME=PPIH_Shift_Sync
set BAT_PATH=%~dp0run_sync.bat

echo ============================================================
echo  シフト同期 Windowsタスクスケジューラ自動設定
echo ============================================================
echo.
echo 1. 毎日自動実行タスクを登録する (毎朝 07:00)
echo 2. 登録済みタスクを削除する
echo 3. タスクの登録状態を確認する
echo 4. キャンセル
echo.
set /p CHOICE="番号を選択してください (1/2/3/4): "

if "%CHOICE%"=="1" goto ADD_TASK
if "%CHOICE%"=="2" goto DELETE_TASK
if "%CHOICE%"=="3" goto CHECK_TASK
goto END

:ADD_TASK
echo.
echo タスク '%TASK_NAME%' を毎日 07:00 に実行するように登録しています...
schtasks /create /tn "%TASK_NAME%" /tr "\"%BAT_PATH%\"" /sc daily /st 07:00 /f
if %ERRORLEVEL% equ 0 (
    echo.
    echo ✅ 登録が完了しました！毎日 07:00 に自動実行されます。
) else (
    echo.
    echo ❌ 登録に失敗しました。右クリックして「管理者として実行」をお試しください。
)
goto END

:DELETE_TASK
echo.
echo タスク '%TASK_NAME%' を削除しています...
schtasks /delete /tn "%TASK_NAME%" /f
if %ERRORLEVEL% equ 0 (
    echo.
    echo ✅ 削除が完了しました。
) else (
    echo.
    echo ⚠️ タスクが見つからないか、削除できませんでした。
)
goto END

:CHECK_TASK
echo.
schtasks /query /tn "%TASK_NAME%" /v /fo LIST
goto END

:END
echo.
pause
