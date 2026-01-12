# Troubleshooting White Screen

## Common Causes

1. **JavaScript Error in Browser Console**
   - Open browser Developer Tools (F12)
   - Check Console tab for red errors
   - Check Network tab for failed requests

2. **API Authentication Error**
   - The app tries to fetch projects but you're not logged in
   - This causes a 401 error which might break rendering

3. **Missing Dependencies**
   - Some npm packages might not be installed correctly

## Quick Fixes Applied

✅ Fixed Tailwind custom color classes (using inline styles instead)
✅ Added error handling to API calls
✅ Made the app show error messages instead of crashing

## Check Browser Console

**Press F12** in your browser and check:

1. **Console Tab** - Look for red error messages
2. **Network Tab** - Check if API calls are failing (401, 404, 500 errors)

## Manual Test

Try opening the browser console and running:
```javascript
// Check if React is loaded
console.log(window.React)

// Check for errors
console.error
```

## If Still White Screen

1. **Hard Refresh**: Ctrl+Shift+R (or Cmd+Shift+R on Mac)
2. **Clear Browser Cache**: Ctrl+Shift+Delete
3. **Check if frontend server is running**: http://localhost:3000 should show Vite page
4. **Restart frontend server**:
   ```powershell
   # Stop current server (Ctrl+C)
   cd D:\ToolDevelopment\frontend
   npm run dev
   ```

## Expected Behavior

After fixes, you should see:
- Dark sidebar on the left
- Header with "Welcome User!" message
- Search bar and project cards (or error message if not logged in)
