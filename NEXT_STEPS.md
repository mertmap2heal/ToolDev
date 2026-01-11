# Next Steps - Installation Guide

## Current Status

✅ **Installation Script Executed**
- Node.js installer downloaded
- Node.js installation attempted
- Docker Desktop download page opened

## ⚠️ Important: Terminal Restart Required

**You MUST restart your PowerShell/terminal window** for Node.js to be available in your PATH.

## Step 1: Verify Node.js Installation

After restarting your terminal, run:

```powershell
node --version
npm --version
```

**If Node.js is NOT found:**

### Option A: Wait and Retry
The installation might still be in progress. Wait 2-3 minutes and try again.

### Option B: Manual Installation
1. Open the installer manually:
   ```
   C:\Users\mmert\AppData\Local\Temp\engineering-tool-install\nodejs.msi
   ```
2. Or download fresh from: https://nodejs.org/
3. Run the installer and follow the wizard
4. **Make sure to check "Add to PATH"** during installation
5. Restart terminal after installation

## Step 2: Install Docker Desktop

1. **Download Docker Desktop** (if not already downloaded)
   - The download page should have opened in your browser
   - Or visit: https://www.docker.com/products/docker-desktop
   - Download the Windows installer

2. **Run the Docker Desktop Installer**
   - Double-click the downloaded file (Docker Desktop Installer.exe)
   - Follow the installation wizard
   - Accept the license agreement
   - Choose installation options (WSL 2 recommended)
   - Complete the installation

3. **Start Docker Desktop**
   - Launch Docker Desktop from Start menu
   - Wait for it to fully start (whale icon in system tray)
   - First startup may take a few minutes

4. **Verify Docker**
   ```powershell
   docker --version
   docker ps
   ```

## Step 3: Complete Project Setup

Once both Node.js and Docker are installed and verified:

```powershell
# Navigate to project directory
cd D:\ToolDevelopment

# Run the setup script
.\setup.ps1
```

This will:
- ✅ Install all npm dependencies (frontend, backend, shared)
- ✅ Start PostgreSQL database in Docker
- ✅ Set up database schema with Prisma
- ✅ Prepare everything for development

## Step 4: Start Development Servers

After setup completes:

**Terminal 1 - Backend:**
```powershell
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```powershell
cd frontend
npm run dev
```

## Step 5: Access the Application

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:5000/api/health

## Quick Verification Checklist

After restarting terminal, verify everything:

- [ ] `node --version` shows a version (e.g., v20.11.0)
- [ ] `npm --version` shows a version (e.g., 10.2.4)
- [ ] `docker --version` shows Docker version
- [ ] `docker ps` runs without errors
- [ ] Docker Desktop is running (whale icon in system tray)

## Troubleshooting

### Node.js Issues

**"node is not recognized"**
- Restart your terminal/PowerShell
- Check if Node.js is installed: `Test-Path "C:\Program Files\nodejs\node.exe"`
- If false, run the installer manually
- Check Windows PATH environment variable

**Installation failed**
- Download fresh installer from https://nodejs.org/
- Run as Administrator
- Check Windows Event Viewer for errors

### Docker Issues

**"docker is not recognized"**
- Ensure Docker Desktop is installed and running
- Restart terminal after Docker installation
- Check if Docker Desktop is running (system tray)

**Docker won't start**
- Enable virtualization in BIOS
- Install WSL 2: `wsl --install`
- Check Windows features: Hyper-V or Virtual Machine Platform
- Restart computer

**Port conflicts**
- Check if ports 5432 (PostgreSQL) are available
- Stop conflicting services
- Change ports in docker-compose.yml if needed

## Need Help?

- See `SETUP.md` for detailed setup instructions
- See `INSTALL_NODE.md` for Node.js help
- See `QUICK_START.md` for quick reference
- Check `INSTALLATION_STATUS.md` for current status

## Summary

1. ✅ **Restart your terminal/PowerShell** (CRITICAL!)
2. ✅ Verify Node.js: `node --version`
3. ✅ Install Docker Desktop (if not done)
4. ✅ Verify Docker: `docker --version`
5. ✅ Run setup: `.\setup.ps1`
6. ✅ Start servers and begin development!

Good luck! 🚀
