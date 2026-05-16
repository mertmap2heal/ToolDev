# Start script for Engineering Tool Development
# Usage: .\start.ps1 [--install]
#   --install  Force npm install even if node_modules already exists

$ROOT = $PSScriptRoot
$forceInstall = $args -contains "--install"

Write-Host "========================================="
Write-Host " Engineering Tool - Starting App"
Write-Host "========================================="
Write-Host ""

# ============================================================
# [1/4] DOCKER
# ============================================================
Write-Host "[1/4] Checking Docker..."

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "  ERROR: docker not found in PATH. Is Docker Desktop installed?"
    exit 1
}

docker ps *>$null 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Docker daemon not running - launching Docker Desktop..."
    $dockerExe = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    if (-not (Test-Path $dockerExe)) {
        Write-Host "  ERROR: Docker Desktop not found at default path. Please start it manually."
        exit 1
    }
    Start-Process $dockerExe
    Write-Host "  Waiting for Docker to be ready (up to 60s)..."
    $elapsed = 0
    do {
        Start-Sleep -Seconds 3
        $elapsed += 3
        docker ps *>$null 2>&1
    } while ($LASTEXITCODE -ne 0 -and $elapsed -lt 60)

    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ERROR: Docker did not become ready in time. Please start Docker Desktop manually and retry."
        exit 1
    }
}
Write-Host "  Docker is running."

# ============================================================
# [2/4] POSTGRESQL
# ============================================================
Write-Host ""
Write-Host "[2/4] Starting PostgreSQL..."
Set-Location $ROOT
docker-compose up -d *>&1 | Out-Null

$dbName = docker ps --filter "name=engineering-tool-db" --filter "status=running" --format "{{.Names}}"
if ($dbName -ne "engineering-tool-db") {
    Write-Host "  ERROR: Database container failed to start. Run: docker-compose logs postgres"
    exit 1
}

Write-Host "  Container is up. Waiting for healthcheck (up to 60s)..."
$elapsed = 0
$status = ""
do {
    Start-Sleep -Seconds 3
    $elapsed += 3
    $status = docker inspect --format "{{.State.Health.Status}}" engineering-tool-db 2>$null
} while ($status -ne "healthy" -and $elapsed -lt 60)

if ($status -ne "healthy") {
    Write-Host "  ERROR: PostgreSQL did not become healthy in time. Run: docker-compose logs postgres"
    exit 1
}
Write-Host "  PostgreSQL is healthy on port 5432."

# ============================================================
# [3/4] CONFIG + DEPENDENCIES + SCHEMA
# ============================================================
Write-Host ""
Write-Host "[3/4] Configuring..."

# --- 3a. backend/.env ---
$envFile    = Join-Path $ROOT "backend\.env"
$envExample = Join-Path $ROOT "backend\.env.example"

$devDefaults = @{
    "DATABASE_URL" = 'postgresql://engineering_user:engineering_password@localhost:5432/engineering_tool'
    "JWT_SECRET"   = "dev-jwt-secret-change-in-production"
    "PORT"         = "5000"
    "NODE_ENV"     = "development"
}

if (-not (Test-Path $envFile)) {
    Write-Host "  Creating backend\.env..."
    $envLines = @()

    if (Test-Path $envExample) {
        $keysWritten = @{}
        foreach ($line in (Get-Content $envExample)) {
            $trimmed = $line.Trim()
            # Pass through blank lines and comments unchanged
            if ($trimmed -eq "" -or $trimmed.StartsWith("#")) {
                $envLines += $line
                continue
            }
            # Parse KEY=value (ignore commented-out lines already handled above)
            $eqIdx = $line.IndexOf("=")
            if ($eqIdx -lt 0) { $envLines += $line; continue }
            $key = $line.Substring(0, $eqIdx).Trim()
            $keysWritten[$key] = $true
            # Substitute dev default for this key if one exists
            if ($devDefaults.ContainsKey($key)) {
                $envLines += "$key=`"$($devDefaults[$key])`""
            } else {
                $envLines += $line
            }
        }
        # Append any required defaults not present in the example file
        foreach ($k in $devDefaults.Keys) {
            if (-not $keysWritten.ContainsKey($k)) {
                $envLines += "$k=`"$($devDefaults[$k])`""
            }
        }
    } else {
        # Fallback: no .env.example — write bare minimum
        foreach ($k in $devDefaults.Keys) {
            $envLines += "$k=`"$($devDefaults[$k])`""
        }
    }

    $envLines | Set-Content $envFile
    Write-Host "  Created backend\.env"
} else {
    Write-Host "  backend\.env already exists."
}

# --- 3b. npm install (shared -> backend -> frontend) ---
foreach ($pkg in @("shared", "backend", "frontend")) {
    $pkgDir = Join-Path $ROOT $pkg
    $nmDir  = Join-Path $pkgDir "node_modules"
    if ($forceInstall -or (-not (Test-Path $nmDir))) {
        Write-Host "  Installing $pkg dependencies..."
        Push-Location $pkgDir
        npm install
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  ERROR: npm install failed in $pkg"
            Pop-Location
            exit 1
        }
        Pop-Location
    } else {
        Write-Host "  $pkg node_modules present - skipping install. (Use --install to force)"
    }
}

# --- 3c. Prisma generate then db push ---
Write-Host "  Generating Prisma client..."
Push-Location (Join-Path $ROOT "backend")
npx prisma generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: prisma generate failed."
    Pop-Location
    exit 1
}

Write-Host "  Syncing database schema..."
npx prisma db push --skip-generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: prisma db push failed."
    Pop-Location
    exit 1
}
Pop-Location
Write-Host "  Schema up to date."

# --- 3d. Seed default users if the database has none ---
Write-Host "  Checking for existing users..."
Push-Location (Join-Path $ROOT "backend")
$userCount = node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.user.count().then(n => { console.log(n); p.\$disconnect(); }).catch(() => { console.log(-1); p.\$disconnect(); });
" 2>$null

if ($userCount -eq "0") {
    Write-Host "  No users found - seeding default accounts..."
    npm run seed:users
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  WARNING: seed:users failed - you can run it manually: cd backend && npm run seed:users"
    } else {
        Write-Host "  Default accounts created:"
        Write-Host "    admin, mert.caferoglu, christian.mandle"
        Write-Host "  Passwords use the values of SEED_PASSWORD_ADMIN / SEED_PASSWORD_MERT / SEED_PASSWORD_CHRISTIAN"
        Write-Host "  from backend/.env (never committed). Rotate freely."
    }
} else {
    Write-Host "  Users already exist - skipping seed."
}
Pop-Location

# --- 3e. Seed engineering roles (idempotent - safe to run every start) ---
Write-Host "  Seeding engineering roles..."
Push-Location (Join-Path $ROOT "backend")
npm run seed:engineering-roles
if ($LASTEXITCODE -ne 0) {
    Write-Host "  WARNING: seed:engineering-roles failed - run manually: cd backend && npm run seed:engineering-roles"
} else {
    Write-Host "  Engineering role catalogue up to date."
}
Pop-Location

# ============================================================
# [4/5] LAUNCH SERVERS
# ============================================================
Write-Host ""
Write-Host "[4/5] Launching servers..."

$backendDir  = Join-Path $ROOT "backend"
$frontendDir = Join-Path $ROOT "frontend"

Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$backendDir'; Write-Host 'Backend starting...'; npm run dev" -WindowStyle Normal
Write-Host "  Backend window opened  -> http://localhost:5000"

Start-Sleep -Seconds 2

Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$frontendDir'; Write-Host 'Frontend starting...'; npm run dev" -WindowStyle Normal
Write-Host "  Frontend window opened -> http://localhost:3000"

# ============================================================
# [5/5] NGROK (optional - remote access tunnel)
# ============================================================
Write-Host ""
Write-Host "[5/5] Starting ngrok tunnel..."

$ngrokUrl = $null

if (Get-Command ngrok -ErrorAction SilentlyContinue) {
    # Kill any leftover ngrok process before starting a fresh one
    $stale = Get-Process -Name "ngrok" -ErrorAction SilentlyContinue
    if ($stale) {
        $stale | Stop-Process -Force
        Start-Sleep -Seconds 1
        Write-Host "  Stopped existing ngrok process."
    }

    Start-Process powershell -ArgumentList "-NoExit", "-Command", "ngrok http 3000" -WindowStyle Normal
    Write-Host "  ngrok window opened. Fetching public URL..."

    $elapsed = 0
    do {
        Start-Sleep -Seconds 2
        $elapsed += 2
        try {
            $resp = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels" -ErrorAction SilentlyContinue
            $ngrokUrl = $resp.tunnels | Where-Object { $_.proto -eq "https" } | Select-Object -ExpandProperty public_url -First 1
        } catch { }
    } while (-not $ngrokUrl -and $elapsed -lt 20)

    if ($ngrokUrl) {
        Write-Host "  ngrok public URL: $ngrokUrl"
    } else {
        Write-Host "  ngrok started - check the ngrok window for your public URL."
    }
} else {
    Write-Host "  ngrok not found in PATH - skipping. Install ngrok for remote access."
}

Write-Host ""
Write-Host "========================================="
Write-Host " All services started!"
Write-Host "========================================="
Write-Host ""
Write-Host "  Frontend : http://localhost:3000"
Write-Host "  Backend  : http://localhost:5000/api/v1"
Write-Host "  Health   : http://localhost:5000/api/health"
if ($ngrokUrl) {
    Write-Host "  Remote   : $ngrokUrl"
}
Write-Host ""
Write-Host "  Close the opened terminal windows to stop the servers."
Write-Host "  To stop the database: docker-compose down"
Write-Host ""
