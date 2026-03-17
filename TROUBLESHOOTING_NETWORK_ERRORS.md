# Troubleshooting Network Errors

## Common Causes of Network Errors

### 1. Backend Server Not Running
**Symptom**: "Cannot connect to backend server" or "Network error"

**Solution**:
```powershell
cd backend
npm run dev
```

**Check if running**:
```powershell
Invoke-WebRequest -Uri "http://localhost:5000/api/health" -Method GET
```

### 2. Port Already in Use
**Symptom**: `EADDRINUSE: address already in use :::5000`

**Solution**:
- Find and kill the process using port 5000:
```powershell
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```
- Or restart your IDE/terminal to release the port

### 3. Backend Crashes Due to Code Errors
**Symptom**: Backend starts but crashes immediately or after a few requests

**Common Causes**:
- Missing import files (like `templates.routes.ts` - now fixed)
- Syntax errors in TypeScript
- Database connection issues
- Missing environment variables

**Solution**:
- Check backend terminal for error messages
- Ensure all route files exist
- Verify database is running: `docker ps`
- Check `.env` file has correct `DATABASE_URL`

### 4. Database Connection Issues
**Symptom**: Backend runs but API calls fail with database errors

**Solution**:
```powershell
# Check if database is running
docker ps

# Restart database if needed
docker-compose restart postgres

# Verify DATABASE_URL in backend/.env matches docker-compose.yml
```

### 5. Prisma Client Not Generated
**Symptom**: "PrismaClient is not defined" or schema errors

**Solution**:
```powershell
cd backend
npx prisma generate
```

## Prevention Tips

1. **Always check backend is running** before testing frontend
2. **Monitor backend terminal** for error messages
3. **Keep database running** - use `docker-compose up -d`
4. **After schema changes**, run `npx prisma generate` and `npx prisma db push`
5. **Check for missing files** - ensure all imported files exist

## Quick Health Check

Run these commands to verify everything is working:

```powershell
# 1. Check database
docker ps | Select-String postgres

# 2. Check backend
Invoke-WebRequest -Uri "http://localhost:5000/api/health" -Method GET

# 3. Check frontend (if running)
Invoke-WebRequest -Uri "http://localhost:5173" -Method GET
```

## If Backend Keeps Crashing

1. Check the terminal output for the specific error
2. Look for missing imports or files
3. Verify all route files exist in `backend/src/routes/`
4. Check `backend/src/routes/index.ts` for correct imports
5. Ensure Prisma schema is in sync: `npx prisma db push`
