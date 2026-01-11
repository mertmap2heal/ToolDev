# Quick Start Guide

This guide assumes you have Node.js and Docker installed. If not, see `INSTALL_NODE.md` and install Docker Desktop.

## Automated Setup Script

### Windows PowerShell

Run this script from the project root:

```powershell
# Check if Node.js is installed
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js is not installed. Please install it first from https://nodejs.org/"
    exit 1
}

# Check if Docker is running
if (!(docker ps 2>$null)) {
    Write-Host "Docker is not running. Please start Docker Desktop first."
    exit 1
}

Write-Host "Installing dependencies..."

# Install frontend dependencies
Write-Host "Installing frontend dependencies..."
cd frontend
npm install
if ($LASTEXITCODE -ne 0) { exit 1 }

# Install backend dependencies
Write-Host "Installing backend dependencies..."
cd ../backend
npm install
if ($LASTEXITCODE -ne 0) { exit 1 }

# Install shared dependencies
Write-Host "Installing shared dependencies..."
cd ../shared
npm install
if ($LASTEXITCODE -ne 0) { exit 1 }

cd ..

# Start Docker database
Write-Host "Starting PostgreSQL database..."
docker-compose up -d
Start-Sleep -Seconds 5

# Setup Prisma
Write-Host "Setting up database..."
cd backend
npm run prisma:generate
if ($LASTEXITCODE -ne 0) { exit 1 }

npm run prisma:migrate
if ($LASTEXITCODE -ne 0) { exit 1 }

cd ..

Write-Host ""
Write-Host "========================================="
Write-Host "Setup complete!"
Write-Host "========================================="
Write-Host ""
Write-Host "To start the application:"
Write-Host "1. Terminal 1: cd backend && npm run dev"
Write-Host "2. Terminal 2: cd frontend && npm run dev"
Write-Host ""
Write-Host "Then open http://localhost:3000 in your browser"
Write-Host ""
```

Save this as `setup.ps1` and run:
```powershell
.\setup.ps1
```

## Manual Setup (Step by Step)

### 1. Install Dependencies

```bash
# Frontend
cd frontend
npm install

# Backend  
cd ../backend
npm install

# Shared
cd ../shared
npm install
cd ..
```

### 2. Start Database

```bash
docker-compose up -d
```

Wait a few seconds for PostgreSQL to start.

### 3. Setup Database Schema

```bash
cd backend
npm run prisma:generate
npm run prisma:migrate
cd ..
```

### 4. Start Servers

**Terminal 1 (Backend):**
```bash
cd backend
npm run dev
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm run dev
```

### 5. Open Application

Open http://localhost:3000 in your browser.

## Verify Everything Works

1. Backend health check: http://localhost:5000/api/health
2. Frontend: http://localhost:3000
3. Database: `docker ps` should show postgres container running

## Common Issues

- **"npm is not recognized"**: Install Node.js from nodejs.org
- **"docker is not recognized"**: Install Docker Desktop
- **Port 5000/3000 in use**: Change ports in config files or kill processes
- **Database connection error**: Ensure Docker is running and container started
