$url = "https://shifucon.ppihgroup.com/"
$maxWaitMinutes = 120
$checkIntervalSeconds = 30
$cooldownAfterUp = 300   # サイト復活後5分待ってから実行
$elapsed = 0

Write-Host "=== Site Monitor (with 5min cooldown) ===" -ForegroundColor Cyan
Write-Host "Interval: ${checkIntervalSeconds}s, Cooldown after UP: ${cooldownAfterUp}s" -ForegroundColor Yellow
Write-Host ""

while ($elapsed -lt ($maxWaitMinutes * 60)) {
    $timestamp = Get-Date -Format "HH:mm:ss"
    try {
        $r = Invoke-WebRequest -Uri $url -TimeoutSec 15 -UseBasicParsing -ErrorAction Stop
        Write-Host "[$timestamp] Site is UP (HTTP $($r.StatusCode))" -ForegroundColor Green
        Write-Host "[$timestamp] Waiting ${cooldownAfterUp}s cooldown before running..." -ForegroundColor Yellow

        # クールダウン中も30秒ごとに確認（サイトが再度落ちないか）
        $coolElapsed = 0
        $siteStillUp = $true
        while ($coolElapsed -lt $cooldownAfterUp) {
            Start-Sleep 30
            $coolElapsed += 30
            $ts2 = Get-Date -Format "HH:mm:ss"
            try {
                $r2 = Invoke-WebRequest -Uri $url -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
                Write-Host "[$ts2] Still UP... ($([math]::Round($coolElapsed/60,1))min / $([math]::Round($cooldownAfterUp/60,1))min)" -ForegroundColor DarkGreen
            } catch {
                Write-Host "[$ts2] Site went DOWN again during cooldown. Restarting wait..." -ForegroundColor Red
                $siteStillUp = $false
                break
            }
        }

        if (-not $siteStillUp) {
            continue
        }

        $ts3 = Get-Date -Format "HH:mm:ss"
        Write-Host "[$ts3] Cooldown done. Running sync (headless)..." -ForegroundColor Cyan
        Set-Location "c:\vscodeapp\shift_sync"
        python main.py --reset 2>&1
        $exitCode = $LASTEXITCODE
        $ts4 = Get-Date -Format "HH:mm:ss"
        if ($exitCode -eq 0) {
            Write-Host "[$ts4] Sync completed successfully!" -ForegroundColor Green
            exit 0
        } else {
            Write-Host "[$ts4] Sync failed (exit $exitCode). Will retry after site recovers..." -ForegroundColor Red
            # 失敗したらもう一度待機ループへ
        }
    } catch {
        $mins = [math]::Round($elapsed/60, 1)
        Write-Host "[$timestamp] Site down... (${mins} min elapsed)" -ForegroundColor DarkGray
    }
    Start-Sleep $checkIntervalSeconds
    $elapsed += $checkIntervalSeconds
}

Write-Host "Timeout after $maxWaitMinutes min. Run manually: python main.py --reset" -ForegroundColor Red
