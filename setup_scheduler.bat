@echo off
chcp 65001 > NUL
set TASK_NAME=PPIH_Shift_Sync
set BAT_PATH=%~dp0run_sync.bat

echo ============================================================
echo  シフト同期 自動化設定メニュー
echo ============================================================
echo.
echo 1. 【おすすめ】毎朝 07:00 に自動実行する（タスクスケジューラ登録）
echo 2. PC起動時・ログイン時に自動実行する（タスクスケジューラ登録）
echo 3. 登録済みタスクを削除する
echo 4. タスクの登録状態を確認する
echo 5. 今すぐ手動で同期する
echo 6. 終了
echo.
set /p CHOICE="番号を選択してください (1/2/3/4/5/6): "

if "%CHOICE%"=="1" goto ADD_DAILY
if "%CHOICE%"=="2" goto ADD_LOGON
if "%CHOICE%"=="3" goto DELETE_TASK
if "%CHOICE%"=="4" goto CHECK_TASK
if "%CHOICE%"=="5" goto RUN_NOW
goto END

:ADD_DAILY
echo.
echo タスク '%TASK_NAME%' を毎日 07:00 に実行するように登録しています...
schtasks /create /tn "%TASK_NAME%" /tr "\"%BAT_PATH%\"" /sc daily /st 07:00 /f
if %ERRORLEVEL% equ 0 (
    echo.
    echo ✅ 登録完了！ 毎朝 07:00 に自動でGoogleカレンダーへ同期されます。
) else (
    echo.
    echo ❌ 登録に失敗しました。右クリックして「管理者として実行」をお試しください。
)
goto END

:ADD_LOGON
echo.
echo タスク '%TASK_NAME%' をPCログイン時に実行するように登録しています...
schtasks /create /tn "%TASK_NAME%" /tr "\"%BAT_PATH%\"" /sc onlogon /f
if %ERRORLEVEL% equ 0 (
    echo.
    echo ✅ 登録完了！ PCを起動・ログインするたびに自動で同期されます。
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

:RUN_NOW
echo.
call "%BAT_PATH%"
goto END

:END
echo.
pause
