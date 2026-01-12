# Starting Development Servers

## ✅ Setup Complete!

All prerequisites are installed and configured:
- ✅ Node.js v20.11.0
- ✅ Docker Desktop running
- ✅ PostgreSQL database running and schema created
- ✅ All dependencies installed
- ✅ Git repository initialized

## 🚀 Start Development

You need **TWO terminal windows** - one for backend, one for frontend.

### Terminal 1 - Backend Server

```powershell
cd D:\ToolDevelopment\backend
npm run dev
```

The backend will start on: **http://localhost:5000**

You should see:
```
Server is running on port 5000
```

### Terminal 2 - Frontend Server

Open a **new terminal/PowerShell window** and run:

```powershell
cd D:\ToolDevelopment\frontend
npm run dev
```

The frontend will start on: **http://localhost:3000**

You should see:
```
VITE v5.x.x  ready in xxx ms
➜  Local:   http://localhost:3000/
```

## 🌐 Access the Application

Once both servers are running:

1. **Open your browser** to: http://localhost:3000
2. You should see the Engineering Project Development Tool dashboard
3. **Backend API** is available at: http://localhost:5000/api/health

## 📝 Quick Commands Reference

### Start Database (if stopped)
```powershell
cd D:\ToolDevelopment
docker-compose up -d
```

### Stop Database
```powershell
cd D:\ToolDevelopment
docker-compose down
```

### Check Database Status
```powershell
docker ps
```

### View Database Logs
```powershell
docker logs engineering-tool-db
```

### Open Prisma Studio (Database GUI)
```powershell
cd D:\ToolDevelopment\backend
npm run prisma:studio
```
This opens a web interface at http://localhost:5555 to view/edit database data.

## 🛠️ Development Workflow

1. **Start database** (if not running):
   ```powershell
   docker-compose up -d
   ```

2. **Start backend** (Terminal 1):
   ```powershell
   cd backend
   npm run dev
   ```

3. **Start frontend** (Terminal 2):
   ```powershell
   cd frontend
   npm run dev
   ```

4. **Open browser**: http://localhost:3000

5. **Make changes** - Both servers have hot reload enabled!

## 🐛 Troubleshooting

### Backend won't start
- Check if port 5000 is available
- Verify database is running: `docker ps`
- Check `.env` file exists in `backend/` directory

### Frontend won't start
- Check if port 3000 is available
- Verify backend is running first
- Check `frontend/.env` file exists

### Database connection errors
- Ensure Docker is running
- Check database container: `docker ps`
- Verify DATABASE_URL in `backend/.env`

### Port already in use
- Change port in `backend/.env` (PORT=5001) or `frontend/vite.config.ts`
- Or kill the process using the port

## 📚 Next Steps

1. **Create your first user** (via API or implement registration UI)
2. **Create a project** from the dashboard
3. **Start working through the engineering lifecycle stages**
4. **Collaborate with your friend** using Git:
   ```powershell
   git add .
   git commit -m "Your changes"
   git push origin master
   ```

## 🎉 You're Ready!

Everything is set up and ready for development. Start the servers and begin building your Engineering Project Development Tool!
