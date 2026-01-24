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
If you see database connection errors or **can't see projects you created**:

1. **Check DB connectivity** (backend must be running):
   ```powershell
   curl http://localhost:5000/api/health/db
   ```
   - `{"ok":true,"projectCount":N}` = DB connected; `N` projects in DB.
   - `{"ok":false,"error":"..."}` or 503 = DB connection failed.

2. **List projects and users** in the database:
   ```powershell
   cd backend
   npm run check-db
   ```
   This lists users, all projects, and which user owns each project.

3. **Ensure PostgreSQL is running**:
   ```powershell
   docker ps
   ```
   If using Docker Compose: `docker compose up -d` (from project root).

4. Check `backend/.env` has the correct `DATABASE_URL` (e.g. `postgresql://engineering_user:engineering_password@localhost:5432/engineering_tool`).

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
