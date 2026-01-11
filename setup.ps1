# Setup script for Engineering Tool Development
# Run this from the project root directory

Write-Host "========================================="
Write-Host "Engineering Tool - Setup Script"
Write-Host "========================================="
Write-Host ""

# Check if Node.js is installed
Write-Host "Checking Node.js installation..."
try {
    $nodeVersion = node --version
    $npmVersion = npm --version
    Write-Host "✓ Node.js found: $nodeVersion"
    Write-Host "✓ npm found: $npmVersion"
} catch {
    Write-Host "✗ Node.js is not installed or not in PATH"
    Write-Host "Please install Node.js from https://nodejs.org/"
    Write-Host "See INSTALL_NODE.md for detailed instructions"
    exit 1
}

# Check if Docker is available
Write-Host ""
Write-Host "Checking Docker installation..."
try {
    $dockerVersion = docker --version
    Write-Host "✓ Docker found: $dockerVersion"
} catch {
    Write-Host "✗ Docker is not installed or not in PATH"
    Write-Host "Please install Docker Desktop from https://www.docker.com/products/docker-desktop"
    exit 1
}

# Check if Docker is running
Write-Host ""
Write-Host "Checking if Docker is running..."
try {
    docker ps | Out-Null
    Write-Host "✓ Docker is running"
} catch {
    Write-Host "✗ Docker is not running"
    Write-Host "Please start Docker Desktop and try again"
    exit 1
}

# Install dependencies
Write-Host ""
Write-Host "========================================="
Write-Host "Installing Dependencies"
Write-Host "========================================="
Write-Host ""

# Frontend
Write-Host "Installing frontend dependencies..."
Set-Location frontend
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Failed to install frontend dependencies"
    Set-Location ..
    exit 1
}
Write-Host "✓ Frontend dependencies installed"
Set-Location ..

# Backend
Write-Host "Installing backend dependencies..."
Set-Location backend
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Failed to install backend dependencies"
    Set-Location ..
    exit 1
}
Write-Host "✓ Backend dependencies installed"
Set-Location ..

# Shared
Write-Host "Installing shared dependencies..."
Set-Location shared
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Failed to install shared dependencies"
    Set-Location ..
    exit 1
}
Write-Host "✓ Shared dependencies installed"
Set-Location ..

# Start Docker database
Write-Host ""
Write-Host "========================================="
Write-Host "Starting Database"
Write-Host "========================================="
Write-Host ""

Write-Host "Starting PostgreSQL container..."
docker-compose up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Failed to start database"
    exit 1
}

Write-Host "Waiting for database to be ready..."
Start-Sleep -Seconds 5

# Check if database is running
$dbRunning = docker ps --filter "name=engineering-tool-db" --format "{{.Names}}"
if ($dbRunning -eq "engineering-tool-db") {
    Write-Host "✓ Database container is running"
} else {
    Write-Host "✗ Database container failed to start"
    Write-Host "Check logs with: docker-compose logs postgres"
    exit 1
}

# Setup Prisma
Write-Host ""
Write-Host "========================================="
Write-Host "Setting Up Database Schema"
Write-Host "========================================="
Write-Host ""

Set-Location backend

Write-Host "Generating Prisma Client..."
npm run prisma:generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Failed to generate Prisma client"
    Set-Location ..
    exit 1
}
Write-Host "✓ Prisma Client generated"

Write-Host "Running database migrations..."
npm run prisma:migrate
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Failed to run migrations"
    Write-Host "This might be normal if migrations already exist"
}
Write-Host "✓ Database migrations completed"

Set-Location ..

# Success message
Write-Host ""
Write-Host "========================================="
Write-Host "Setup Complete!"
Write-Host "========================================="
Write-Host ""
Write-Host "Next steps:"
Write-Host ""
Write-Host "1. Start the backend server:"
Write-Host "   cd backend"
Write-Host "   npm run dev"
Write-Host ""
Write-Host "2. In a new terminal, start the frontend:"
Write-Host "   cd frontend"
Write-Host "   npm run dev"
Write-Host ""
Write-Host "3. Open your browser to:"
Write-Host "   http://localhost:3000"
Write-Host ""
Write-Host "Backend API will be available at:"
Write-Host "   http://localhost:5000"
Write-Host ""
Write-Host "For more information, see SETUP.md"
Write-Host ""
