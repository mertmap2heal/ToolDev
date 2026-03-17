# Storage and Data Persistence Guide

## Overview

This application uses **two types of storage**:

1. **Browser localStorage** - Temporary, client-side storage for authentication tokens
2. **PostgreSQL Database** - Permanent, server-side storage for all application data

## 1. Browser localStorage (Authentication Tokens)

### What is Stored:
- **JWT Authentication Token** only
- **Location**: Browser's localStorage (client-side)
- **Key**: `token`

### Storage Capacity:
- **Typical Limit**: ~5-10 MB per domain (varies by browser)
- **Current Usage**: ~1-2 KB (just the JWT token)
- **Available**: ~99.99% remaining

### Why Tokens Expire:
```typescript
// From backend/src/controllers/auth.controller.ts
JWT_EXPIRES_IN = '7d'  // 7 days default expiration
```

**Token Expiration Reasons:**
- Security: Limits exposure if token is compromised
- Industry best practice for JWT tokens
- Prevents indefinite access after logout

### Why Data Appears to Disappear:
❌ **MYTH**: Your data is lost  
✅ **REALITY**: Your authentication token expired, but data still exists in database

When token expires:
1. Browser still has old token in localStorage
2. Backend rejects token (403 Forbidden)
3. Frontend can't access data until re-authentication
4. Data remains safely stored in PostgreSQL database

### localStorage Limitations:
- **Cleared by user**: Browser settings, "Clear browsing data"
- **Cleared automatically**: Private/Incognito mode closure
- **Per-domain**: Each domain has separate storage
- **No persistence**: Not shared across browsers/devices

## 2. PostgreSQL Database (All Application Data)

### What is Stored:
- Users, Projects, Requirements, Functions, Parameters
- Issues, Change Requests, Documentation
- Traceability links, Baselines, Versions
- All relationships and metadata

### Storage Location:
- **Docker Volume**: `postgres_data` (named volume)
- **Physical Location**: `/var/lib/docker/volumes/tooldevelopment_postgres_data/_data`
- **Host Path**: Managed by Docker Desktop on Windows

### Current Database Size:
- **Current Usage**: ~9 MB (8,997 KB)
- **Capacity**: Limited only by disk space
- **Growth Rate**: ~1-10 KB per requirement/function

### Database Persistence:
✅ **Persists through**:
- Browser restarts
- Frontend/backend restarts
- Docker container restarts (if volume exists)
- Token expiration
- Multiple login sessions

❌ **Lost if**:
- Docker volume is deleted
- Database container is removed without volume backup
- Disk runs out of space

## 3. Storage Sources and Locations

### Frontend Storage (Browser):
```
Browser localStorage
  └─ Key: 'token'
  └─ Value: JWT token string (~200-500 bytes)
  └─ Location: User's browser on their machine
  └─ Scope: Per-domain (localhost:3000)
```

### Backend Storage (Server):
```
PostgreSQL Database
  └─ Docker Volume: postgres_data
  └─ Physical: /var/lib/docker/volumes/tooldevelopment_postgres_data/_data
  └─ Size: ~9 MB current, unlimited growth
  └─ Scope: Shared across all users (with user-based access control)
```

## 4. Why Data Loss Happens (Apparent)

### Common Scenarios:

#### Scenario 1: Token Expiration
**Symptom**: "My projects disappeared!"  
**Cause**: JWT token expired (after 7 days)  
**Solution**: Auto-authentication re-logs you in (already implemented)  
**Data Status**: ✅ **All data safe in database**

#### Scenario 2: Different User Login
**Symptom**: "My old data is gone!"  
**Cause**: Logged in with different user account  
**Solution**: Log in with same user account that created the data  
**Data Status**: ✅ **Data exists for original user**

#### Scenario 3: Browser localStorage Cleared
**Symptom**: "I'm not logged in"  
**Cause**: User cleared browser data or used Incognito mode  
**Solution**: Re-login (auto-auth handles this)  
**Data Status**: ✅ **All data safe in database**

#### Scenario 4: Docker Volume Deleted
**Symptom**: "Everything is actually gone!"  
**Cause**: Docker volume was removed  
**Solution**: Restore from backup  
**Data Status**: ❌ **Real data loss** (rare, needs manual deletion)

## 5. How to Avoid Data Loss

### Best Practices:

#### ✅ Do:
1. **Keep Docker container running** - Database needs to be accessible
2. **Don't delete Docker volumes** - Contains all your data
3. **Use same user account** - Data is tied to user ID
4. **Backup database regularly** - For production use
5. **Let auto-authentication work** - Handles token expiration automatically

#### ❌ Don't:
1. **Clear browser data carelessly** - You'll need to re-login (data still safe)
2. **Delete Docker volumes** - This actually deletes data
3. **Remove Docker container without backup** - Can lose data if volume isn't preserved
4. **Run `docker-compose down -v`** - The `-v` flag deletes volumes!

### Backup Database:
```bash
# Create backup
docker exec engineering-tool-db pg_dump -U engineering_user engineering_tool > backup.sql

# Restore from backup
docker exec -i engineering-tool-db psql -U engineering_user engineering_tool < backup.sql
```

## 6. Storage Capacity Summary

### Current Usage:
- **localStorage**: ~1-2 KB / 5-10 MB (0.01% used)
- **PostgreSQL**: ~9 MB / Unlimited (only limited by disk)

### Expected Growth:
- **localStorage**: Constant (~2 KB, just token)
- **PostgreSQL**: ~1-10 KB per requirement/function/project
- **Example**: 1000 requirements ≈ 1-10 MB additional

### Storage Location:
- **Browser localStorage**: Client-side (your computer)
- **PostgreSQL**: Server-side (Docker volume on your machine)
- **Both**: Stored locally on your development machine

## 7. Troubleshooting

### "I can't see my data"
1. ✅ Check if backend is running: `http://localhost:5000/api/health`
2. ✅ Check if database is running: `docker ps` (look for `engineering-tool-db`)
3. ✅ Clear localStorage and refresh (auto-auth will re-login)
4. ✅ Check browser console for errors

### "My data is actually gone"
1. ✅ Check Docker volume exists: `docker volume ls`
2. ✅ Verify container is using volume: `docker inspect engineering-tool-db`
3. ✅ Check database has data: `docker exec engineering-tool-db psql -U engineering_user -d engineering_tool -c "SELECT COUNT(*) FROM \"Project\";"`

### "Token keeps expiring"
- ✅ This is normal after 7 days
- ✅ Auto-authentication handles this automatically
- ✅ To change expiration, edit `backend/.env`: `JWT_EXPIRES_IN=30d` (example)

## Summary

**Your data is stored in two places:**

1. **localStorage** (Browser) - Just authentication token, expires after 7 days, cleared on browser data clear
2. **PostgreSQL** (Docker Volume) - All your actual data, persists permanently, survives restarts

**The "data loss" you experience is usually:**
- Token expiration (data still exists, just need to re-authenticate)
- Auto-authentication now handles this automatically ✅

**Real data loss only happens if:**
- Docker volume is deleted manually
- Database disk runs out of space
- Container is removed without preserving volume
