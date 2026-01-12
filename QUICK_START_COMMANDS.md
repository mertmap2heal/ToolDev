# Quick Start Commands

## ⚠️ Important: Always Run Commands from the Correct Directory!

Make sure you're in the right directory before running npm commands.

## ✅ Backend Server (Terminal 1)

**First, navigate to the backend directory:**
```powershell
cd D:\ToolDevelopment\backend
```

**Then start the server:**
```powershell
npm run dev
```

You should see:
```
Server is running on port 5000
```

## ✅ Frontend Server (Terminal 2 - NEW WINDOW)

**Open a NEW PowerShell/terminal window**, then:

**First, navigate to the frontend directory:**
```powershell
cd D:\ToolDevelopment\frontend
```

**Then start the server:**
```powershell
npm run dev
```

You should see:
```
VITE v5.x.x  ready in xxx ms
➜  Local:   http://localhost:3000/
```

## 🔍 Verify You're in the Right Directory

Before running npm commands, check your current directory:

```powershell
pwd
# Should show: D:\ToolDevelopment\backend (for backend)
# Or: D:\ToolDevelopment\frontend (for frontend)
```

Or use:
```powershell
Get-Location
```

## 📁 Directory Structure

```
D:\ToolDevelopment\
├── backend\          ← Run "npm run dev" here for backend
├── frontend\         ← Run "npm run dev" here for frontend
└── shared\
```

## 🚨 Common Error Fix

If you see:
```
npm ERR! enoent Could not read package.json
```

**Solution:**
1. Check you're in the right directory: `pwd` or `Get-Location`
2. Navigate to the correct directory:
   ```powershell
   cd D:\ToolDevelopment\backend    # For backend
   # OR
   cd D:\ToolDevelopment\frontend   # For frontend
   ```
3. Then run your npm command

## ✅ Complete Startup Sequence

**Terminal 1:**
```powershell
cd D:\ToolDevelopment\backend
npm run dev
```

**Terminal 2 (NEW WINDOW):**
```powershell
cd D:\ToolDevelopment\frontend
npm run dev
```

**Browser:**
Open http://localhost:3000
