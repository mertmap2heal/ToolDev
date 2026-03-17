# Setup script for Engineering Tool Development
# Run once on a fresh clone. For day-to-day starting use start.ps1 instead.

$ROOT = $PSScriptRoot

Write-Host "========================================="
Write-Host "Engineering Tool - First-Time Setup"
Write-Host "========================================="
Write-Host ""

# --- Node.js check ---
Write-Host "Checking Node.js..."
try {
    $nodeVersion = node --version
    $npmVersion  = npm --version
    Write-Host "  OK Node.js $nodeVersion / npm $npmVersion"
} catch {
    Write-Host "  ERROR: Node.js not found. Install from https://nodejs.org/"
    exit 1
}

# --- Docker check ---
Write-Host "Checking Docker..."
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "  ERROR: docker not found in PATH. Install Docker Desktop."
    exit 1
}
docker ps *>$null 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: Docker daemon is not running. Start Docker Desktop and retry."
    exit 1
}
Write-Host "  OK Docker is running."

# ============================================================
# Install dependencies  (order: shared -> backend -> frontend)
# ============================================================
Write-Host ""
Write-Host "========================================="
Write-Host "Installing Dependencies"
Write-Host "========================================="
Write-Host ""

foreach ($pkg in @("shared", "backend", "frontend")) {
    Write-Host "Installing $pkg dependencies..."
    Push-Location (Join-Path $ROOT $pkg)
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ERROR: npm install failed in $pkg"
        Pop-Location
        exit 1
    }
    Write-Host "  OK $pkg"
    Pop-Location
}

# ============================================================
# Validate no undeclared imports snuck in (common after merges)
# ============================================================
Write-Host ""
Write-Host "Checking for undeclared dependencies..."
$missingFound = $false

foreach ($pkg in @("backend", "frontend")) {
    Push-Location (Join-Path $ROOT $pkg)
    $missing = node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json','utf8'));
const deps = Object.keys({...pkg.dependencies||{}, ...pkg.devDependencies||{}});
const missing = deps.filter(d => !fs.existsSync('node_modules/' + d));
if (missing.length) process.stdout.write(missing.join('\n') + '\n');
" 2>$null
    if ($missing) {
        Write-Host "  WARNING: Missing from $pkg/node_modules after install:"
        $missing -split "`n" | Where-Object { $_ } | ForEach-Object { Write-Host "    - $_" }
        $missingFound = $true
    } else {
        Write-Host "  OK $pkg - all declared dependencies present."
    }
    Pop-Location
}

if ($missingFound) {
    Write-Host ""
    Write-Host "  Some packages are still missing. This usually means package.json"
    Write-Host "  references a package not yet published or has a resolution conflict."
    Write-Host "  Review the list above before continuing."
    Write-Host ""
}

# ============================================================
# Start PostgreSQL and wait for healthcheck
# ============================================================
Write-Host ""
Write-Host "========================================="
Write-Host "Starting Database"
Write-Host "========================================="
Write-Host ""

Set-Location $ROOT
Write-Host "Starting PostgreSQL container..."
docker-compose up -d *>&1 | Out-Null

$dbName = docker ps --filter "name=engineering-tool-db" --filter "status=running" --format "{{.Names}}"
if ($dbName -ne "engineering-tool-db") {
    Write-Host "  ERROR: Container failed to start. Run: docker-compose logs postgres"
    exit 1
}

Write-Host "  Waiting for PostgreSQL healthcheck (up to 60s)..."
$elapsed = 0
$status = ""
do {
    Start-Sleep -Seconds 3
    $elapsed += 3
    $status = docker inspect --format "{{.State.Health.Status}}" engineering-tool-db 2>$null
} while ($status -ne "healthy" -and $elapsed -lt 60)

if ($status -ne "healthy") {
    Write-Host "  ERROR: PostgreSQL did not become healthy. Run: docker-compose logs postgres"
    exit 1
}
Write-Host "  OK PostgreSQL is healthy."

# ============================================================
# Create backend/.env if missing
# ============================================================
Write-Host ""
Write-Host "Checking backend/.env..."
$envFile    = Join-Path $ROOT "backend\.env"
$envExample = Join-Path $ROOT "backend\.env.example"

$devDefaults = @{
    "DATABASE_URL" = "postgresql://engineering_user:engineering_password@localhost:5432/engineering_tool"
    "JWT_SECRET"   = "dev-jwt-secret-change-in-production"
    "PORT"         = "5000"
    "NODE_ENV"     = "development"
}

if (-not (Test-Path $envFile)) {
    Write-Host "  Creating backend/.env from .env.example..."
    $envLines = @()
    if (Test-Path $envExample) {
        $keysWritten = @{}
        foreach ($line in (Get-Content $envExample)) {
            $trimmed = $line.Trim()
            if ($trimmed -eq "" -or $trimmed.StartsWith("#")) { $envLines += $line; continue }
            $eqIdx = $line.IndexOf("=")
            if ($eqIdx -lt 0) { $envLines += $line; continue }
            $key = $line.Substring(0, $eqIdx).Trim()
            $keysWritten[$key] = $true
            if ($devDefaults.ContainsKey($key)) {
                $envLines += "$key=`"$($devDefaults[$key])`""
            } else {
                $envLines += $line
            }
        }
        foreach ($k in $devDefaults.Keys) {
            if (-not $keysWritten.ContainsKey($k)) { $envLines += "$k=`"$($devDefaults[$k])`"" }
        }
    } else {
        foreach ($k in $devDefaults.Keys) { $envLines += "$k=`"$($devDefaults[$k])`"" }
    }
    $envLines | Set-Content $envFile
    Write-Host "  OK Created backend/.env"
} else {
    Write-Host "  OK backend/.env already exists."
}

# ============================================================
# Prisma generate + migrate deploy
# ============================================================
Write-Host ""
Write-Host "========================================="
Write-Host "Setting Up Database Schema"
Write-Host "========================================="
Write-Host ""

Push-Location (Join-Path $ROOT "backend")

Write-Host "Generating Prisma client..."
npx prisma generate
if ($LASTEXITCODE -ne 0) { Write-Host "  ERROR: prisma generate failed"; Pop-Location; exit 1 }
Write-Host "  OK"

Write-Host "Applying migrations..."
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) {
    Write-Host "  No migration files found - falling back to db push..."
    npx prisma db push --skip-generate
    if ($LASTEXITCODE -ne 0) { Write-Host "  ERROR: db push failed"; Pop-Location; exit 1 }
}
Write-Host "  OK Schema is up to date."

Pop-Location

# ============================================================
# Done
# ============================================================
Write-Host ""
Write-Host "========================================="
Write-Host "Setup Complete!"
Write-Host "========================================="
Write-Host ""
Write-Host "  Start the app:  .\start.ps1"
Write-Host "  Stop the app:   .\shutdown.ps1"
Write-Host ""
Write-Host "  Frontend : http://localhost:3000"
Write-Host "  Backend  : http://localhost:5000/api/v1"
Write-Host ""
