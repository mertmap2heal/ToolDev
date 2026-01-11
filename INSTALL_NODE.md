# Installing Node.js

Node.js is required to run this project. Follow these steps to install it:

## Windows Installation

### Option 1: Official Installer (Recommended)
1. Visit https://nodejs.org/
2. Download the LTS (Long Term Support) version
3. Run the installer (.msi file)
4. Follow the installation wizard
5. Restart your terminal/PowerShell after installation
6. Verify installation:
   ```powershell
   node --version
   npm --version
   ```

### Option 2: Using Chocolatey
If you have Chocolatey installed:
```powershell
choco install nodejs-lts
```

### Option 3: Using Winget
```powershell
winget install OpenJS.NodeJS.LTS
```

## After Installation

1. **Restart your terminal/PowerShell** - This is important!
2. Verify Node.js is installed:
   ```powershell
   node --version
   npm --version
   ```
3. If commands still don't work, you may need to:
   - Add Node.js to your PATH manually
   - Restart your computer
   - Check if Node.js was installed to a non-standard location

## Verify Installation

Run these commands to verify:
```powershell
node --version    # Should show v18.x.x or higher
npm --version     # Should show 9.x.x or higher
```

## Next Steps

Once Node.js is installed, return to `SETUP.md` and continue with the setup process.
