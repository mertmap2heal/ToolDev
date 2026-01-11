# Engineering Project Development Tool

An AI-powered engineering project development tool that guides users step-by-step through transforming requirements into system functions, architectures, and verification plans.

## Features

- **Structured Workflow**: Step-by-step guidance through engineering lifecycle stages
- **AI-Powered Assistance**: Context-aware AI guidance and generation
- **Traceability**: Automatic and manual tracking of relationships between artifacts
- **Documentation Generation**: Auto-generate comprehensive documentation
- **Project Management**: Dashboard with project cards, search, filter, and collaboration

## Tech Stack

### Frontend
- React 18 with TypeScript
- Vite for build tooling
- React Router for routing
- Zustand for state management
- React Query for server state
- Tailwind CSS for styling
- Lucide React for icons

### Backend
- Node.js with Express and TypeScript
- PostgreSQL database
- Prisma ORM
- JWT authentication
- OpenAI/Claude API integration

## Getting Started

### Prerequisites
- Node.js 18+ 
- Docker and Docker Compose
- PostgreSQL (or use Docker)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/mertmap2heal/ToolDev.git
cd ToolDev
```

2. Start the database:
```bash
docker-compose up -d
```

3. Install dependencies:
```bash
# Frontend
cd frontend
npm install

# Backend
cd ../backend
npm install

# Shared types
cd ../shared
npm install
```

4. Set up environment variables:
```bash
# Backend
cd backend
cp .env.example .env
# Edit .env with your configuration
```

5. Run database migrations:
```bash
cd backend
npm run prisma:generate
npm run prisma:migrate
```

6. Start development servers:
```bash
# Backend (terminal 1)
cd backend
npm run dev

# Frontend (terminal 2)
cd frontend
npm run dev
```

## Project Structure

```
ToolDevelopment/
├── frontend/          # React frontend application
├── backend/           # Express backend API
├── shared/            # Shared TypeScript types
└── docker-compose.yml # Docker configuration
```

## Development

### Git Workflow
- `main` - Production-ready code
- `develop` - Integration branch
- `feature/*` - Feature branches
- `fix/*` - Bug fixes

### Code Style
- TypeScript strict mode
- ESLint for linting
- Prettier for formatting
- Conventional commits

## License

MIT
