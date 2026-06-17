# ShiftSync API 自動起動スクリプト
# Windows タスクスケジューラに登録して使用する
# 
# 【登録方法】
# 1. タスクスケジューラを管理者として開く
# 2. 「基本タスクの作成」→ 名前: ShiftSync API
# 3. トリガー: コンピューターの起動時
# 4. 操作: プログラムの開始
#    プログラム: powershell.exe
#    引数: -ExecutionPolicy Bypass -File "C:\vscodeapp\shift_sync\start_api.ps1"
# 5. 「最上位の特権で実行する」にチェック

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$logFile   = "$scriptDir\api_server.log"
$pidFile   = "$scriptDir\api_server.pid"

function Write-Log {
    param([string]$msg)
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$ts $msg" | Tee-Object -FilePath $logFile -Append
}

Write-Log "=== ShiftSync API 起動スクリプト開始 ==="

# 既存プロセスを停止
if (Test-Path $pidFile) {
    $oldPid = Get-Content $pidFile -ErrorAction SilentlyContinue
    if ($oldPid) {
        $proc = Get-Process -Id $oldPid -ErrorAction SilentlyContinue
        if ($proc) {
            Write-Log "既存プロセス (PID: $oldPid) を停止します"
            Stop-Process -Id $oldPid -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 2
        }
    }
}

# Python / uvicorn のパスを確認
$python = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $python) {
    Write-Log "ERROR: Python が見つかりません"
    exit 1
}

Write-Log "Python: $python"

# ポート 8000 が空いているか確認
$portInUse = netstat -ano | Select-String ":8000 "
if ($portInUse) {
    Write-Log "ポート 8000 はすでに使用中です。既存プロセスを確認してください。"
    # 既存プロセスが shiftSync なら起動済みとして正常終了
    exit 0
}

# API サーバー起動（ログを logFile に追記）
Write-Log "API サーバーを起動します..."
$proc = Start-Process -FilePath $python `
    -ArgumentList "-m", "uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000" `
    -WorkingDirectory $scriptDir `
    -RedirectStandardOutput "$scriptDir\uvicorn_stdout.log" `
    -RedirectStandardError  "$scriptDir\uvicorn_stderr.log" `
    -PassThru `
    -WindowStyle Hidden

# PID を保存
$proc.Id | Out-File -FilePath $pidFile -Encoding ascii
Write-Log "API サーバー起動完了 (PID: $($proc.Id))"
Write-Log "エンドポイント: http://0.0.0.0:8000"
