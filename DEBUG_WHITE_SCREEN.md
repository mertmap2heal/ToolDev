# How to Debug White Screen Error

## Step 1: Open Browser Developer Console

1. **Press F12** in your browser (or Right-click → Inspect)
2. Go to the **Console** tab
3. Look for **red error messages**
4. **Copy the entire error message** - it will tell us what's wrong

## Step 2: Check Network Tab

1. In Developer Tools, click the **Network** tab
2. Refresh the page (F5)
3. Look for requests that show in **red** (failed requests)
4. Click on failed requests to see the error details

## Step 3: Check Terminal/Command Prompt

Look at the terminal where you ran `npm run dev`:
- Are there any **error messages**?
- Does it say "Failed to compile"?
- What is the last line showing?

## Step 4: Common Issues to Check

### Issue 1: Missing Module Error
**Error**: `Cannot find module 'jspdf-autotable'`
**Fix**: 
```powershell
cd d:\ToolDevelopment\frontend
npm install jspdf-autotable
```

### Issue 2: Syntax Error
**Error**: `Unexpected token` or `SyntaxError`
**Fix**: The error message will show which file and line number has the error

### Issue 3: Import Error
**Error**: `Cannot read property 'default' of undefined`
**Fix**: Usually means a module isn't exporting correctly

### Issue 4: Component Error
**Error**: `Cannot read property 'map' of undefined` or similar
**Fix**: Usually means data isn't loaded yet when component tries to use it

## Step 5: Quick Fixes to Try

### Fix 1: Clear Cache and Restart
```powershell
# Stop the dev server (Ctrl+C)

# Clear node_modules cache
cd d:\ToolDevelopment\frontend
rm -r node_modules/.vite

# Restart dev server
npm run dev
```

### Fix 2: Hard Refresh Browser
- **Windows/Linux**: Ctrl + Shift + R
- **Mac**: Cmd + Shift + R

### Fix 3: Check if All Dependencies are Installed
```powershell
cd d:\ToolDevelopment\frontend
npm install
```

## Step 6: Get More Information

Run this in your browser console (F12 → Console tab):
```javascript
// Check if React is loaded
console.log('React:', window.React)

// Check for errors
window.addEventListener('error', (e) => {
  console.error('Global error:', e.error, e.message, e.filename, e.lineno)
})
```

## Most Common Causes

1. **Import Error** - A module isn't being imported correctly
2. **Runtime Error** - Code tries to access undefined property
3. **Build Error** - TypeScript/Vite compilation failed
4. **Missing Dependency** - A package isn't installed

## Share the Error Message

After checking the browser console, please share:
1. The **exact error message** from Console tab
2. The **file name** where the error occurs
3. The **line number** (if shown)

This will help us fix it quickly!
