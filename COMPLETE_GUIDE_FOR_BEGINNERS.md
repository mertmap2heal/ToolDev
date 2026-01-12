# Complete Guide: Engineering Project Development Tool

## 📚 Table of Contents

1. [What We've Built](#what-weve-built)
2. [Understanding the Architecture](#understanding-the-architecture)
3. [How Everything Works Together](#how-everything-works-together)
4. [Key Concepts You Need to Know](#key-concepts-you-need-to-know)
5. [Project Structure Explained](#project-structure-explained)
6. [How to Collaborate with Your Friend](#how-to-collaborate-with-your-friend)
7. [Development Workflow](#development-workflow)
8. [Next Steps for Development](#next-steps-for-development)
9. [Common Tasks and How to Do Them](#common-tasks-and-how-to-do-them)
10. [Troubleshooting Guide](#troubleshooting-guide)

---

## What We've Built

### Overview
We've created a **web application** (a website that runs in your browser) that helps engineers develop projects step-by-step. Think of it like a specialized project management tool for engineering work.

### What It Does
- **Manages Projects**: Create and organize engineering projects
- **Guides Through Steps**: Helps you go through requirements → functions → architecture → verification
- **Tracks Relationships**: Shows how different parts connect (traceability)
- **Generates Documentation**: Creates reports automatically
- **AI Assistance**: Provides intelligent guidance (to be fully implemented)

### The Three Main Parts

1. **Frontend** (What You See)
   - The user interface in the browser
   - Built with React (a JavaScript library for building interfaces)
   - Located in `frontend/` folder

2. **Backend** (The Brain)
   - Handles all the logic and data processing
   - Built with Node.js and Express (server technology)
   - Located in `backend/` folder

3. **Database** (The Memory)
   - Stores all your projects, users, and data
   - Uses PostgreSQL (a database system)
   - Runs in Docker (a container)

---

## Understanding the Architecture

### Simple Analogy
Think of a restaurant:
- **Frontend** = The dining room (where customers see and interact)
- **Backend** = The kitchen (where work happens)
- **Database** = The pantry (where ingredients/data are stored)
- **API** = The waiter (carries requests between dining room and kitchen)

### How Data Flows

```
User (Browser) 
    ↓
Frontend (React) - User clicks button
    ↓
API Request (HTTP) - "Get me all projects"
    ↓
Backend (Express) - Processes request
    ↓
Database (PostgreSQL) - Retrieves data
    ↓
Backend - Formats response
    ↓
Frontend - Displays projects to user
```

### The Technology Stack

**Frontend Technologies:**
- **React**: Builds the user interface (buttons, forms, pages)
- **TypeScript**: JavaScript with type safety (catches errors early)
- **Vite**: Fast development server and build tool
- **Tailwind CSS**: Styling (makes things look good)
- **React Router**: Handles navigation between pages
- **Zustand**: Manages application state (remembers things)
- **React Query**: Handles server data (fetching, caching)

**Backend Technologies:**
- **Node.js**: JavaScript runtime for servers
- **Express**: Web framework (handles HTTP requests)
- **TypeScript**: Same as frontend - type safety
- **Prisma**: Database toolkit (easier database access)
- **PostgreSQL**: The actual database

**Development Tools:**
- **Docker**: Runs database in isolated container
- **Git**: Version control (tracks code changes)
- **npm**: Package manager (installs libraries)

---

## How Everything Works Together

### When You Open the Application

1. **Browser loads** `http://localhost:3000`
2. **Frontend server** (Vite) sends HTML, CSS, and JavaScript files
3. **React starts** and renders the MainLayout component
4. **MainLayout shows**:
   - Sidebar (navigation menu)
   - Header (welcome message)
   - Main content area (dashboard)
5. **Dashboard page** tries to fetch projects from backend
6. **Backend receives** request at `http://localhost:5000/api/v1/projects`
7. **Backend queries** database for projects
8. **Database returns** project data
9. **Backend sends** JSON response to frontend
10. **Frontend displays** projects (or shows error if not logged in)

### Authentication Flow (When Implemented)

1. User enters email/password
2. Frontend sends to `/api/v1/auth/login`
3. Backend checks credentials in database
4. Backend creates JWT token (like a temporary ID card)
5. Frontend stores token in browser
6. All future requests include this token
7. Backend verifies token before processing requests

---

## Key Concepts You Need to Know

### 1. Components (React)
**What it is**: Reusable pieces of UI

**Example**: 
- `ProjectCard` = A card showing one project
- `Sidebar` = The navigation menu
- `Header` = The top bar with welcome message

**Think of it like**: LEGO blocks - you build complex things from simple pieces

### 2. State Management
**What it is**: How the app remembers things

**Example**:
- Which projects are loaded?
- Is the user logged in?
- What page are we on?

**Tools we use**:
- **Zustand**: For app-wide state (projects, user info)
- **React Query**: For server data (cached API responses)
- **useState**: For component-specific state (form inputs)

### 3. API (Application Programming Interface)
**What it is**: How frontend and backend communicate

**Example**:
- Frontend: "GET /api/v1/projects" (give me all projects)
- Backend: Returns JSON with project data
- Frontend: Displays the projects

**HTTP Methods**:
- **GET**: Retrieve data (read)
- **POST**: Create new data
- **PUT**: Update existing data
- **DELETE**: Remove data

### 4. Routes (Navigation)
**What it is**: Different pages/URLs in your app

**Example**:
- `/` = Dashboard (home page)
- `/projects/123/requirements` = Requirements page for project 123
- `/projects/123/functions` = Functions page for project 123

### 5. Database Schema
**What it is**: Structure of your data

**Our Main Tables**:
- **User**: People who use the app
- **Project**: Engineering projects
- **Requirement**: Project requirements
- **SystemFunction**: Functions derived from requirements
- **Architecture**: System architecture designs
- **VerificationPlan**: Testing/verification plans
- **TraceLink**: Connections between items

### 6. Git and Version Control
**What it is**: Tracks changes to your code

**Key Concepts**:
- **Repository (repo)**: Your project folder with version history
- **Commit**: A snapshot of your code at a point in time
- **Branch**: A separate line of development
- **Push**: Upload changes to GitHub
- **Pull**: Download changes from GitHub

**Why it matters**: You and your friend can work on different features without conflicts

---

## Project Structure Explained

```
ToolDevelopment/
│
├── frontend/                    # What users see
│   ├── src/
│   │   ├── pages/              # Different pages/screens
│   │   │   ├── Dashboard/      # Main projects page
│   │   │   ├── Requirements/   # Requirements page
│   │   │   └── ...             # Other lifecycle pages
│   │   │
│   │   ├── components/         # Reusable UI pieces
│   │   │   ├── layout/         # Sidebar, Header, etc.
│   │   │   └── projects/       # Project-related components
│   │   │
│   │   ├── features/           # Feature modules
│   │   │   ├── workflow/       # Workflow navigation
│   │   │   ├── ai-guidance/    # AI assistance
│   │   │   └── traceability/   # Traceability graphs
│   │   │
│   │   ├── services/           # API communication
│   │   │   ├── api.ts          # Base API client
│   │   │   ├── project.service.ts
│   │   │   └── auth.service.ts
│   │   │
│   │   └── store/              # State management
│   │       ├── projectStore.ts
│   │       └── authStore.ts
│   │
│   ├── package.json            # Dependencies list
│   └── vite.config.ts          # Build configuration
│
├── backend/                     # Server logic
│   ├── src/
│   │   ├── routes/             # API endpoints
│   │   │   ├── projects.routes.ts
│   │   │   ├── auth.routes.ts
│   │   │   └── ...
│   │   │
│   │   ├── controllers/        # Business logic
│   │   │   ├── project.controller.ts
│   │   │   └── auth.controller.ts
│   │   │
│   │   ├── services/           # Complex operations
│   │   │   ├── ai.service.ts
│   │   │   ├── workflow.service.ts
│   │   │   └── traceability.service.ts
│   │   │
│   │   ├── middleware/         # Request processing
│   │   │   └── auth.middleware.ts
│   │   │
│   │   └── server.ts           # Main server file
│   │
│   ├── prisma/
│   │   └── schema.prisma       # Database structure
│   │
│   └── package.json
│
├── shared/                      # Code shared between frontend/backend
│   └── types/                   # TypeScript type definitions
│       ├── project.types.ts
│       ├── workflow.types.ts
│       └── ...
│
└── docker-compose.yml           # Database configuration
```

### What Each Folder Does

**Frontend Pages**: Each lifecycle stage has its own page
- `DashboardPage.tsx` - Shows all projects
- `RequirementsPage.tsx` - Create/edit requirements
- `SystemFunctionsPage.tsx` - Define system functions
- etc.

**Frontend Components**: Reusable pieces
- `ProjectCard.tsx` - Shows one project
- `Sidebar.tsx` - Navigation menu
- `WorkflowStepper.tsx` - Shows progress through stages

**Backend Routes**: Define API endpoints
- `/api/v1/projects` - Project operations
- `/api/v1/auth/login` - User login
- `/api/v1/workflow/:projectId` - Workflow progress

**Backend Controllers**: Handle requests
- Receive request → Process → Return response

**Backend Services**: Complex business logic
- AI guidance generation
- Traceability calculations
- Workflow orchestration

---

## How to Collaborate with Your Friend

### Git Workflow for Two People

#### 1. Initial Setup (One Time)

**Both of you:**
```powershell
# Clone the repository
git clone https://github.com/mertmap2heal/ToolDev.git
cd ToolDev

# Install dependencies
cd frontend && npm install
cd ../backend && npm install
```

#### 2. Daily Workflow

**Before Starting Work:**
```powershell
# Make sure you have latest code
git pull origin master
```

**While Working:**
```powershell
# Create a branch for your feature
git checkout -b feature/your-feature-name

# Example:
git checkout -b feature/add-login-page
git checkout -b feature/requirements-form
```

**After Completing Work:**
```powershell
# Stage your changes
git add .

# Commit with descriptive message
git commit -m "feat: add login page with email validation"

# Push to GitHub
git push origin feature/your-feature-name
```

**Then create a Pull Request on GitHub** for your friend to review.

#### 3. Working on Different Features

**You work on**: Requirements page
**Friend works on**: Authentication system

**No conflicts!** You're in different files/branches.

#### 4. Resolving Conflicts (If Same File Changed)

```powershell
# Pull latest changes
git pull origin master

# If conflicts:
# 1. Git will mark conflict areas
# 2. Open file, see <<<<<< markers
# 3. Choose which version to keep
# 4. Remove conflict markers
# 5. Commit the resolution
```

### Branch Strategy

- **master**: Production-ready code (main branch)
- **develop**: Integration branch (optional)
- **feature/***: New features
  - `feature/login-page`
  - `feature/requirements-form`
  - `feature/ai-guidance`
- **fix/***: Bug fixes
  - `fix/project-card-styling`
  - `fix/api-error-handling`

### Communication Tips

1. **Coordinate**: "I'm working on the requirements page, don't touch RequirementsPage.tsx"
2. **Small Commits**: Commit often, push daily
3. **Clear Messages**: "feat: add project creation modal" not "fix stuff"
4. **Review PRs**: Look at each other's code before merging
5. **Test Together**: Test features together before marking complete

---

## Development Workflow

### Starting Your Day

```powershell
# 1. Navigate to project
cd D:\ToolDevelopment

# 2. Get latest code
git pull origin master

# 3. Start database (if not running)
docker-compose up -d

# 4. Start backend (Terminal 1)
cd backend
npm run dev

# 5. Start frontend (Terminal 2 - new window)
cd frontend
npm run dev

# 6. Open browser to http://localhost:3000
```

### Making Changes

1. **Create a branch**: `git checkout -b feature/my-feature`
2. **Make changes** in your code editor
3. **Test locally**: Check browser, fix errors
4. **Commit**: `git add . && git commit -m "description"`
5. **Push**: `git push origin feature/my-feature`
6. **Create PR**: On GitHub, create pull request
7. **Get review**: Friend reviews and approves
8. **Merge**: Merge to master branch

### Testing Your Changes

**Frontend:**
- Browser automatically refreshes (hot reload)
- Check console for errors (F12)
- Test different scenarios

**Backend:**
- Server restarts automatically
- Test API with:
  - Browser: http://localhost:5000/api/health
  - Postman/Thunder Client (API testing tool)
  - Or from frontend

### Common Development Tasks

**Add a New Page:**
1. Create file: `frontend/src/pages/NewPage/NewPage.tsx`
2. Add route in `App.tsx`
3. Add link in navigation (Sidebar.tsx)

**Add a New API Endpoint:**
1. Create route: `backend/src/routes/new.routes.ts`
2. Create controller: `backend/src/controllers/new.controller.ts`
3. Add to routes index: `backend/src/routes/index.ts`

**Add Database Table:**
1. Update schema: `backend/prisma/schema.prisma`
2. Run migration: `npm run prisma:migrate`
3. Use in code: Import Prisma client

---

## Next Steps for Development

### Phase 1: Core Features (Current Status ✅)

**Completed:**
- ✅ Project structure
- ✅ Database setup
- ✅ Basic UI layout
- ✅ Project dashboard
- ✅ API structure

**Next Priority:**
1. **User Authentication**
   - Login page
   - Registration page
   - Protected routes
   - Session management

2. **Project CRUD**
   - Create project form
   - Edit project
   - Delete project
   - Project details page

### Phase 2: Workflow Implementation

1. **Requirements Page**
   - Form to add requirements
   - List of requirements
   - Edit/delete requirements
   - Priority and status management

2. **System Functions Page**
   - Create functions from requirements
   - Link functions to requirements
   - Function details

3. **Architecture Page**
   - Design system architecture
   - Component relationships
   - Visual diagrams (future)

4. **Verification Page**
   - Create verification plans
   - Link to requirements
   - Test case management

### Phase 3: Advanced Features

1. **AI Integration**
   - Connect to OpenAI/Claude API
   - Context-aware guidance
   - Auto-generation of content
   - Validation suggestions

2. **Traceability**
   - Visual graph of relationships
   - Automatic linking
   - Impact analysis
   - Completeness checking

3. **Documentation**
   - Generate PDF reports
   - Export to Word/Markdown
   - Custom templates
   - Auto-update on changes

### Phase 4: Polish and Production

1. **User Experience**
   - Better error messages
   - Loading states
   - Animations
   - Responsive design (mobile)

2. **Performance**
   - Optimize database queries
   - Cache frequently used data
   - Lazy load components
   - Code splitting

3. **Security**
   - Input validation
   - SQL injection prevention
   - XSS protection
   - Rate limiting

4. **Deployment**
   - Set up production database
   - Configure environment variables
   - Set up CI/CD pipeline
   - Deploy to cloud (AWS, Azure, etc.)

---

## Common Tasks and How to Do Them

### Adding a New Component

**Example: Add a "Settings" button**

1. **Create component file:**
   ```typescript
   // frontend/src/components/SettingsButton.tsx
   export default function SettingsButton() {
     return <button>Settings</button>
   }
   ```

2. **Use it in a page:**
   ```typescript
   import SettingsButton from '../components/SettingsButton'
   
   // In your component:
   <SettingsButton />
   ```

### Adding a New API Endpoint

**Example: Get project statistics**

1. **Create route:**
   ```typescript
   // backend/src/routes/projects.routes.ts
   router.get('/:id/stats', getProjectStats)
   ```

2. **Create controller:**
   ```typescript
   // backend/src/controllers/project.controller.ts
   export const getProjectStats = async (req, res) => {
     // Your logic here
     res.json({ success: true, data: stats })
   }
   ```

3. **Call from frontend:**
   ```typescript
   // frontend/src/services/project.service.ts
   async getProjectStats(id: string) {
     return apiClient.get(`/projects/${id}/stats`)
   }
   ```

### Adding a Database Field

**Example: Add "category" to Project**

1. **Update schema:**
   ```prisma
   // backend/prisma/schema.prisma
   model Project {
     // ... existing fields
     category String?
   }
   ```

2. **Run migration:**
   ```powershell
   cd backend
   npm run prisma:migrate
   ```

3. **Update TypeScript types:**
   ```typescript
   // shared/types/project.types.ts
   export interface Project {
     // ... existing fields
     category?: string
   }
   ```

### Debugging Tips

**Frontend Issues:**
- Open browser console (F12)
- Check Network tab for failed requests
- Use `console.log()` to see values
- Check React DevTools extension

**Backend Issues:**
- Check terminal for error messages
- Add `console.log()` in controllers
- Test API directly with Postman
- Check database with Prisma Studio: `npm run prisma:studio`

**Database Issues:**
- Check if Docker container is running: `docker ps`
- View database logs: `docker logs engineering-tool-db`
- Connect directly: Use Prisma Studio

---

## Troubleshooting Guide

### "Cannot find module" Error

**Problem**: Missing dependency

**Solution**:
```powershell
cd frontend  # or backend
npm install
```

### "Port already in use"

**Problem**: Another process using port 3000 or 5000

**Solution**:
```powershell
# Find process
netstat -ano | findstr :3000

# Kill process (replace PID with actual number)
taskkill /PID <PID> /F

# Or change port in config files
```

### "Database connection failed"

**Problem**: PostgreSQL not running

**Solution**:
```powershell
# Check if running
docker ps

# Start if not running
docker-compose up -d

# Check logs
docker logs engineering-tool-db
```

### "White screen" in browser

**Problem**: JavaScript error

**Solution**:
1. Open browser console (F12)
2. Check Console tab for errors
3. Check Network tab for failed requests
4. Hard refresh: Ctrl+Shift+R

### "Git push rejected"

**Problem**: Friend pushed changes you don't have

**Solution**:
```powershell
# Get latest changes
git pull origin master

# Resolve conflicts if any
# Then push again
git push origin feature/your-branch
```

---

## Learning Resources

### For Understanding React
- **Official Docs**: https://react.dev
- **Tutorial**: React's official tutorial
- **Key Concepts**: Components, Props, State, Hooks

### For Understanding Backend
- **Express Guide**: https://expressjs.com/en/guide/routing.html
- **REST API**: Learn HTTP methods (GET, POST, PUT, DELETE)
- **Database**: Basic SQL concepts

### For Understanding Git
- **Git Basics**: https://git-scm.com/book
- **GitHub Guide**: https://guides.github.com
- **Practice**: Make small changes, commit, push

### For TypeScript
- **Official Docs**: https://www.typescriptlang.org/docs/
- **Key Concept**: Types prevent errors before runtime

---

## Quick Reference Commands

### Development
```powershell
# Start database
docker-compose up -d

# Start backend
cd backend && npm run dev

# Start frontend
cd frontend && npm run dev

# View database
cd backend && npm run prisma:studio
```

### Git
```powershell
# Get latest code
git pull origin master

# Create feature branch
git checkout -b feature/name

# Commit changes
git add .
git commit -m "description"

# Push to GitHub
git push origin feature/name
```

### Database
```powershell
# Create migration
cd backend && npm run prisma:migrate

# Reset database (WARNING: deletes all data)
cd backend && npx prisma migrate reset

# Generate Prisma client
cd backend && npm run prisma:generate
```

---

## Summary: What You Know Now

✅ **You understand**:
- What frontend, backend, and database do
- How they communicate (API)
- The project structure
- How to collaborate with Git
- Basic development workflow
- How to add new features
- How to troubleshoot issues

✅ **You can**:
- Start the development servers
- Make code changes
- Use Git for version control
- Work with your friend on the same project
- Debug common issues
- Add new components and features

✅ **Next**: Start implementing features! Begin with user authentication, then move to the workflow pages.

---

## Questions to Ask Yourself

Before starting a new feature:
1. **What does it do?** (Functionality)
2. **Where does it go?** (Frontend page? Backend endpoint?)
3. **What data does it need?** (Database fields? API calls?)
4. **How do users interact?** (UI components? Forms?)
5. **How do I test it?** (Manual testing? API testing?)

---

**Remember**: Web development is about building things step by step. Start small, test often, and don't be afraid to ask questions or look things up. You and your friend are learning together!

Good luck with your Engineering Project Development Tool! 🚀
