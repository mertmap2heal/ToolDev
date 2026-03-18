# Shutdown script for Engineering Tool Development
# Stops the frontend (port 3000), backend (port 5000), and PostgreSQL container.
# Data is preserved - use docker-compose down -v only if you want to wipe the DB.

param(
    [switch]$KeepDb   # Pass -KeepDb to leave the PostgreSQL container running
)

$ROOT = $PSScriptRoot

Write-Host "========================================="
Write-Host " Engineering Tool - Shutting Down"
Write-Host "========================================="
Write-Host ""

# ============================================================
# [1/3] STOP FRONTEND (port 3000)
# ============================================================
Write-Host "[1/3] Stopping frontend (port 3000)..."

$fe = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($fe) {
    $fePid = ($fe | Select-Object -First 1).OwningProcess
    $feProc = Get-Process -Id $fePid -ErrorAction SilentlyContinue
    if ($feProc) {
        Stop-Process -Id $fePid -Force
        Write-Host "  Stopped process '$($feProc.Name)' (PID $fePid) on port 3000."
    } else {
        Write-Host "  Process on port 3000 already gone."
    }
} else {
    Write-Host "  Nothing listening on port 3000."
}

# ============================================================
# [2/3] STOP BACKEND (port 5000)
# ============================================================
Write-Host ""
Write-Host "[2/3] Stopping backend (port 5000)..."

$be = Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue
if ($be) {
    $bePid = ($be | Select-Object -First 1).OwningProcess
    $beProc = Get-Process -Id $bePid -ErrorAction SilentlyContinue
    if ($beProc) {
        Stop-Process -Id $bePid -Force
        Write-Host "  Stopped process '$($beProc.Name)' (PID $bePid) on port 5000."
    } else {
        Write-Host "  Process on port 5000 already gone."
    }
} else {
    Write-Host "  Nothing listening on port 5000."
}

# ============================================================
# [3/3] STOP POSTGRESQL CONTAINER
# ============================================================
Write-Host ""
if ($KeepDb) {
    Write-Host "[3/3] Skipping database shutdown (-KeepDb flag set)."
} else {
    Write-Host "[3/3] Stopping PostgreSQL container..."

    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Host "  docker not found in PATH - skipping."
    } else {
        docker ps --filter "name=engineering-tool-db" --filter "status=running" --format "{{.Names}}" | Out-Null
        $running = docker ps --filter "name=engineering-tool-db" --filter "status=running" --format "{{.Names}}"
        if ($running -eq "engineering-tool-db") {
            Set-Location $ROOT
            docker-compose stop 2>&1 | Out-Null
            Write-Host "  PostgreSQL container stopped (data preserved)."
            Write-Host "  To also remove the container: docker-compose down"
            Write-Host "  To wipe all data:             docker-compose down -v"
        } else {
            Write-Host "  PostgreSQL container is not running."
        }
    }
}

# ============================================================
# [+] STOP NGROK (if running)
# ============================================================
Write-Host ""
Write-Host "[+] Stopping ngrok..."
$ngrokProcs = Get-Process -Name "ngrok" -ErrorAction SilentlyContinue
if ($ngrokProcs) {
    $ngrokProcs | Stop-Process -Force
    Write-Host "  ngrok stopped."
} else {
    Write-Host "  ngrok is not running."
}

Write-Host ""
Write-Host "========================================="
Write-Host " All services stopped."
Write-Host "========================================="
Write-Host ""
