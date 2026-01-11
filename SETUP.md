# Setup Guide

## Prerequisites

Before starting, ensure you have the following installed:

1. **Node.js** (v18 or higher)
   - Download from: https://nodejs.org/
   - Verify installation: `node --version` and `npm --version`

2. **Docker Desktop** (for PostgreSQL database)
   - Download from: https://www.docker.com/products/docker-desktop
   - Verify installation: `docker --version`

3. **Git** (for version control)
   - Download from: https://git-scm.com/
   - Verify installation: `git --version`

## Step-by-Step Setup

### 1. Install Node.js Dependencies

```bash
# Frontend dependencies
cd frontend
npm install

# Backend dependencies
cd ../backend
npm install

# Shared types dependencies
cd ../shared
npm install
```

### 2. Set Up Database with Docker

```bash
# From the project root directory
docker-compose up -d

# Verify PostgreSQL is running
docker ps
```

### 3. Configure Backend Environment

```bash
cd backend

# Copy the example environment file
# On Windows (PowerShell):
Copy-Item .env.example .env

# On Linux/Mac:
# cp .env.example .env
```

Edit `backend/.env` and update the following:
- `DATABASE_URL`: Should match your Docker PostgreSQL setup
- `JWT_SECRET`: Generate a secure random string
- `JWT_EXPIRES_IN`: Token expiration (default: 7d)

Example `.env` content:
```
PORT=5000
DATABASE_URL="postgresql://engineering_user:engineering_password@localhost:5432/engineering_tool?schema=public"
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d
NODE_ENV=development
```

### 4. Set Up Prisma Database

```bash
cd backend

# Generate Prisma Client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# (Optional) Open Prisma Studio to view database
npm run prisma:studio
```

### 5. Start Development Servers

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

The backend should start on `http://localhost:5000`

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

The frontend should start on `http://localhost:3000`

### 6. Verify Installation

1. Open browser to `http://localhost:3000`
2. You should see the dashboard page
3. Check backend health: `http://localhost:5000/api/health`

## Troubleshooting

### Node.js not found
- Install Node.js from https://nodejs.org/
- Restart your terminal after installation
- Verify with `node --version`

### Docker issues
- Ensure Docker Desktop is running
- Check if port 5432 is available
- Try: `docker-compose down` then `docker-compose up -d`

### Database connection errors
- Verify PostgreSQL container is running: `docker ps`
- Check DATABASE_URL in `backend/.env` matches docker-compose.yml
- Try restarting the database: `docker-compose restart postgres`

### Prisma errors
- Run `npm run prisma:generate` again
- Check if DATABASE_URL is correct
- Ensure database container is running

### Port already in use
- Change PORT in `backend/.env` or `frontend/vite.config.ts`
- Kill process using the port:
  - Windows: `netstat -ano | findstr :5000` then `taskkill /PID <pid> /F`
  - Linux/Mac: `lsof -ti:5000 | xargs kill`

## Next Steps

After setup is complete:

1. Create your first user account (via API or implement registration UI)
2. Create a project
3. Start working through the engineering lifecycle stages

## Development Commands

### Frontend
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint

### Backend
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript
- `npm run prisma:studio` - Open Prisma Studio (database GUI)
- `npm run prisma:migrate` - Run database migrations

### Database
- `docker-compose up -d` - Start PostgreSQL
- `docker-compose down` - Stop PostgreSQL
- `docker-compose logs postgres` - View database logs
