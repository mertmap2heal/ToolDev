# Project Overview

**Engineering Project Development Tool** — AI-powered platform for structured engineering lifecycle management. Guides teams through the full lifecycle: Requirements → System Functions → Architecture → Verification → Certification.

## One-command start
```powershell
.\start.ps1            # start everything; skips npm install if node_modules exist
.\start.ps1 --install  # force reinstall all node_modules (use after pulling new deps)
```

## URLs
| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:5000/api/v1 |
| Health | http://localhost:5000/api/health |
| DB health | http://localhost:5000/api/health/db |

## Tech stack
| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, React Router v6, Zustand, React Query v5, Tailwind CSS, Lucide, TipTap, ReactFlow, DnD-Kit |
| Backend | Node.js, Express, TypeScript (`tsx watch`), Prisma ORM v5, JWT, Socket.IO, bcryptjs |
| Database | PostgreSQL 15 (Docker, container: `engineering-tool-db`, port 5432) |
| Shared types | `shared/` — TypeScript-only package, no server |
| Doc generation | docx, pdfkit, exceljs, archiver, jsPDF (backend + frontend) |
| Email | nodemailer (optional — SMTP env vars required) |

## Environment — `backend/.env`
`start.ps1` creates this from `backend/.env.example`. Gitignored.

**Required:**
```
DATABASE_URL="postgresql://engineering_user:engineering_password@localhost:5432/engineering_tool"
JWT_SECRET="<any secret string>"
```

**Optional:**
```
PORT=5000
NODE_ENV=development
JWT_EXPIRES_IN="7d"
ADMIN_EMAILS="admin@example.com"   # first user is admin if unset

# Enable invite emails:
SMTP_HOST / SMTP_PORT / SMTP_SECURE / SMTP_USER / SMTP_PASS
APP_URL="http://localhost:3000"
INVITE_FROM_NAME="Engineering Tool"
```

## Infrastructure
- Docker volume `postgres_data` persists across `docker-compose down`
- `docker-compose down -v` wipes all data
- `/uploads` directory served statically by Express (file attachments)
- Socket.IO for real-time CPU/memory metrics and dataflow events
- Daily scheduled job (`cleanup.service.ts`) permanently purges soft-deleted requirements

## Roles terminology (avoid mixing concepts)

| Concept | What it is | Where it lives |
|--------|----------------|----------------|
| **Discipline / engineering roles** | Project-scoped assignments to the engineering role catalog (e.g. Requirements Engineer). Single source for lifecycle transition “allowed roles”. | Backend: `ProjectUserEngineeringRole`, `EngineeringRole`. UI: **Stakeholders → Roles & assignments**, Directory. APIs: `GET/POST /projects/:id/engineering-roles`, `.../users-with-roles`, `.../me/engineering-roles`. |
| **Admin permission roles** | RBAC templates (`AdminRole`) for module actions (requirements, verification, admin, …). | Admin panel, `/admin/roles`. |
| **Stakeholders “simulation” role** | Client-only role in **Stakeholders → Settings & Roles** to demo module permissions — not stored as engineering roles. | `SettingsRolesTab`, `stakeholders/store`. |
