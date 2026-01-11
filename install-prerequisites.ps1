# Install Node.js and Docker Desktop
# This script downloads and installs the prerequisites

Write-Host "========================================="
Write-Host "Installing Prerequisites"
Write-Host "========================================="
Write-Host ""

$ErrorActionPreference = "Stop"

# Create temp directory
$tempDir = "$env:TEMP\engineering-tool-install"
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

# Check if already installed
Write-Host "Checking existing installations..."

$nodeInstalled = $false
$dockerInstalled = $false

try {
    $nodeVersion = node --version 2>$null
    if ($nodeVersion) {
        Write-Host "Node.js is already installed: $nodeVersion"
        $nodeInstalled = $true
    }
} catch {
    Write-Host "Node.js is not installed"
}

try {
    $dockerVersion = docker --version 2>$null
    if ($dockerVersion) {
        Write-Host "Docker is already installed: $dockerVersion"
        $dockerInstalled = $true
    }
} catch {
    Write-Host "Docker is not installed"
}

if ($nodeInstalled -and $dockerInstalled) {
    Write-Host ""
    Write-Host "All prerequisites are already installed!"
    exit 0
}

Write-Host ""
Write-Host "========================================="
Write-Host "Downloading Installers"
Write-Host "========================================="
Write-Host ""

# Download Node.js LTS
if (-not $nodeInstalled) {
    Write-Host "Downloading Node.js LTS installer..."
    $nodeUrl = "https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi"
    $nodeInstaller = "$tempDir\nodejs.msi"
    
    try {
        Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeInstaller -UseBasicParsing
        Write-Host "Node.js installer downloaded"
    } catch {
        Write-Host "Failed to download Node.js installer"
        Write-Host "Please download manually from: https://nodejs.org/"
        Write-Host "Error: $_"
        $nodeInstaller = $null
    }
}

# Docker Desktop - Note: Docker Desktop requires manual download due to license
if (-not $dockerInstalled) {
    Write-Host ""
    Write-Host "Docker Desktop requires manual download and installation."
    Write-Host "Please download from: https://www.docker.com/products/docker-desktop"
    Write-Host "Or use this direct link:"
    Write-Host "https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe"
    Write-Host ""
    Write-Host "Opening download page in browser..."
    Start-Process "https://www.docker.com/products/docker-desktop"
}

Write-Host ""
Write-Host "========================================="
Write-Host "Installing Node.js"
Write-Host "========================================="
Write-Host ""

if (-not $nodeInstalled -and $nodeInstaller) {
    Write-Host "Installing Node.js..."
    Write-Host "This will run the Node.js installer silently."
    Write-Host "Please wait..."
    Write-Host ""
    
    Start-Process msiexec.exe -ArgumentList "/i `"$nodeInstaller`" /quiet /norestart" -Wait
    
    Write-Host "Node.js installation completed."
    Write-Host "Please restart your terminal/PowerShell after installation."
    Write-Host ""
}

Write-Host ""
Write-Host "========================================="
Write-Host "Installation Summary"
Write-Host "========================================="
Write-Host ""

if (-not $nodeInstalled) {
    Write-Host "Node.js:"
    Write-Host "  - Installer downloaded to: $tempDir\nodejs.msi"
    if ($nodeInstaller) {
        Write-Host "  - Installation attempted"
    } else {
        Write-Host "  - Please download manually from: https://nodejs.org/"
    }
    Write-Host ""
}

if (-not $dockerInstalled) {
    Write-Host "Docker Desktop:"
    Write-Host "  - Download page opened in browser"
    Write-Host "  - Please download and install manually"
    Write-Host "  - After installation, start Docker Desktop"
    Write-Host ""
}

Write-Host "After installing both:"
Write-Host "1. Restart your terminal/PowerShell"
Write-Host "2. Verify installations:"
Write-Host "   node --version"
Write-Host "   npm --version"
Write-Host "   docker --version"
Write-Host "3. Run the setup script: setup.ps1"
Write-Host ""
