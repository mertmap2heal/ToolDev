# Backend Server Status Check

## Quick Check

If you're getting a "Network error" or "Cannot connect to backend server", the backend is likely not running.

## How to Start the Backend

1. **Open a new terminal window** (keep the frontend running in the other terminal)

2. **Navigate to the backend directory:**
   ```powershell
   cd D:\ToolDevelopment\backend
   ```

3. **Start the backend server:**
   ```powershell
   npm run dev
   ```

4. **You should see:**
   ```
   Server is running on port 5000
   ```

## Verify Backend is Running

Open your browser and go to:
```
http://localhost:5000/api/health
```

You should see:
```json
{"status":"ok","message":"Server is running"}
```

## Common Issues

### Port 5000 Already in Use
If you get an error that port 5000 is already in use:
- Check if another instance is running
- Change the port in `backend/.env`:
  ```
  PORT=5001
  ```
- Update `frontend/src/services/api.ts` to use the new port

### Database Connection Error
If you see database connection errors:
- Make sure Docker is running
- Make sure the PostgreSQL container is running:
  ```powershell
  docker ps
  ```
- Check `backend/.env` has the correct `DATABASE_URL`

### Missing Dependencies
If you get module errors:
```powershell
cd backend
npm install
```

## Both Servers Should Be Running

- **Frontend**: Usually on `http://localhost:5173` (Vite default)
- **Backend**: On `http://localhost:5000`

Make sure both terminals are running!
