# Setup PostgreSQL and connect the backend database.
# Run this script as Administrator (right-click PowerShell -> Run as Administrator).
# Usage: .\scripts\setup-database.ps1

$ErrorActionPreference = "Stop"
$BackendRoot = $PSScriptRoot + "\.."

# --- 1. Find or install PostgreSQL (requires Admin for install) ---
Write-Host "Checking for PostgreSQL..." -ForegroundColor Cyan
# Search case-insensitively; Chocolatey/EDB use various names
$allServices = Get-Service -ErrorAction SilentlyContinue
$pgService = $allServices | Where-Object { $_.Name -imatch "postgres|postgresql|pg_" } | Select-Object -First 1
if (-not $pgService) {
    $pgService = $allServices | Where-Object { $_.DisplayName -imatch "PostgreSQL|Postgres" } | Select-Object -First 1
}
# Only run Chocolatey if no service AND no PostgreSQL binaries found (avoid prompt when already installed)
$pgBinCheck = @("C:\Program Files\PostgreSQL\16\bin\pg_ctl.exe","C:\Program Files\PostgreSQL\15\bin\pg_ctl.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $pgService -and -not $pgBinCheck) {
    Write-Host "PostgreSQL not found. Installing via Chocolatey (this may take a few minutes)..." -ForegroundColor Yellow
    choco install postgresql16 --yes
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Chocolatey install failed. Try running this script in an elevated PowerShell (Run as Administrator)." -ForegroundColor Red
        exit 1
    }
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    $allServices = Get-Service -ErrorAction SilentlyContinue
    $pgService = $allServices | Where-Object { $_.Name -imatch "postgres|postgresql|pg_" } | Select-Object -First 1
    if (-not $pgService) { $pgService = $allServices | Where-Object { $_.DisplayName -imatch "PostgreSQL|Postgres" } | Select-Object -First 1 }
}

$pgStarted = $false
if ($pgService) {
    Write-Host "Found service: $($pgService.Name) ($($pgService.DisplayName))" -ForegroundColor Green
    if ($pgService.Status -ne "Running") {
        Write-Host "Starting PostgreSQL service..." -ForegroundColor Cyan
        Start-Service $pgService.Name
    }
    $pgStarted = $true
}

# Fallback: Chocolatey may have installed binaries but not created data dir or service. Init and start with pg_ctl.
if (-not $pgStarted) {
    $pgBinPaths = @(
        "C:\Program Files\PostgreSQL\16\bin",
        "C:\Program Files\PostgreSQL\15\bin",
        "C:\Program Files\PostgreSQL\14\bin"
    )
    $pgBin = $null
    foreach ($p in $pgBinPaths) {
        if (Test-Path (Join-Path $p "pg_ctl.exe")) { $pgBin = $p; break }
    }
    if ($pgBin) {
        # Use user-writable path so no Administrator required (avoids Turkish locale issues in Program Files)
        $pgData = Join-Path $env:LOCALAPPDATA "PostgreSQL\16\data"
        $env:Path = $pgBin + ";" + $env:Path
        if (-not (Test-Path (Join-Path $pgData "postgresql.conf"))) {
            Write-Host "PostgreSQL binaries found but no data directory. Creating with initdb..." -ForegroundColor Cyan
            if (-not (Test-Path $pgData)) {
                New-Item -ItemType Directory -Path $pgData -Force | Out-Null
            }
            # Use C locale to avoid "locale contains non-ASCII" on Turkish/other Windows locales
            & (Join-Path $pgBin "initdb.exe") -D $pgData -U postgres -A trust -E UTF8 --locale=C
            if ($LASTEXITCODE -ne 0) {
                Write-Host "initdb failed." -ForegroundColor Red
                exit 1
            }
            Write-Host "Data directory created." -ForegroundColor Green
        }
        Write-Host "Starting PostgreSQL with pg_ctl..." -ForegroundColor Cyan
        & (Join-Path $pgBin "pg_ctl.exe") start -D $pgData -w
        if ($LASTEXITCODE -eq 0) {
            $pgStarted = $true
            Write-Host "PostgreSQL started." -ForegroundColor Green
            # Use postgres user (only one that exists after initdb); ensure .env has it for db:push
            $envPath = Join-Path $BackendRoot ".env"
            if (Test-Path $envPath) {
                $envContent = Get-Content $envPath -Raw
                $newUrl = 'DATABASE_URL="postgresql://postgres@localhost:5432/engineering_tool"'
                if ($envContent -match 'DATABASE_URL\s*=') {
                    $envContent = $envContent -replace 'DATABASE_URL\s*=.*', $newUrl
                } else {
                    $envContent = $envContent + "`n" + $newUrl
                }
                Set-Content -Path $envPath -Value $envContent.TrimEnd() -NoNewline:$false
            }
        } else {
            Write-Host "pg_ctl start failed. Check $pgData\log for errors." -ForegroundColor Yellow
        }
    }
}

if (-not $pgStarted) {
    Write-Host "PostgreSQL service not found and could not start from binaries." -ForegroundColor Red
    Write-Host "List all services (look for PostgreSQL): Get-Service | Format-Table Name, DisplayName, Status -AutoSize" -ForegroundColor Yellow
    exit 1
}

# --- 2. Ensure DATABASE_URL in .env ---
$envPath = Join-Path $BackendRoot ".env"
$envExamplePath = Join-Path $BackendRoot ".env.example"
if (-not (Test-Path $envPath)) {
    if (Test-Path $envExamplePath) {
        Copy-Item $envExamplePath $envPath
        Write-Host "Created .env from .env.example" -ForegroundColor Green
    }
}
$envContent = Get-Content $envPath -Raw -ErrorAction SilentlyContinue
$defaultUrl = "postgresql://postgres:postgres@localhost:5432/engineering_tool"
if (-not $envContent -or $envContent -notmatch "DATABASE_URL\s*=") {
    Add-Content -Path $envPath -Value "`nDATABASE_URL=`"$defaultUrl`""
    Write-Host "Set DATABASE_URL in .env (postgres/postgres). Change password in .env if your install uses a different one." -ForegroundColor Green
}

# --- 3. Create database if not exists (optional; Prisma can create in some configs) ---
$pgBin = "C:\Program Files\PostgreSQL\16\bin"
if (Test-Path "$pgBin\createdb.exe") {
    & "$pgBin\createdb.exe" -U postgres engineering_tool 2>$null
    if ($LASTEXITCODE -eq 0) { Write-Host "Database engineering_tool created or already exists." -ForegroundColor Green }
}

# --- 4. Push schema and verify (no admin needed) ---
Push-Location $BackendRoot
Write-Host "`nPushing schema and verifying connection..." -ForegroundColor Cyan
npm run db:push
if ($LASTEXITCODE -eq 0) {
    npm run check-db
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`nDatabase is connected and ready." -ForegroundColor Green
    }
} else {
    Write-Host "If DATABASE_URL password is wrong, edit backend\.env and run: npm run db:push" -ForegroundColor Yellow
}
Pop-Location
