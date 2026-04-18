# Starts ngrok for the Vite dev server (port 3000) using the bundled Windows binary.
$ErrorActionPreference = "Stop"
$here = $PSScriptRoot
$exe = Join-Path $here "bin\ngrok.exe"
$zip = Join-Path $here "ngrok.zip"

if (-not (Test-Path $zip)) {
    Write-Error "Missing $zip"
    exit 1
}

if (-not (Test-Path $exe)) {
    $bin = Split-Path $exe
    New-Item -ItemType Directory -Force -Path $bin | Out-Null
    Expand-Archive -Path $zip -DestinationPath $bin -Force
}

if (-not (Test-Path $exe)) {
    Write-Error "Failed to extract ngrok.exe to $exe"
    exit 1
}

Unblock-File -Path $exe -ErrorAction SilentlyContinue

Write-Host "ngrok -> http://localhost:3000 (ensure Vite is running)"
Write-Host "Inspector: http://127.0.0.1:4040"
Write-Host ""

& $exe http 3000
