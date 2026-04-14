# Bugbot context — Engineering Project Development Tool

Monorepo: React 18 + TypeScript + Vite + Tailwind (`frontend/`), Express + TypeScript + Prisma (`backend/`), shared types (`shared/`). API base path `/api/v1`; do not assume port changes (frontend 3000, backend 5000).

## Prioritize in PR review

- **Security:** Auth on protected routes (`authenticateToken`); JWT handling; never log secrets; validate/sanitize user input and file uploads; path traversal on `/uploads` or attachment flows; SQL injection via Prisma is rare but raw queries need scrutiny.
- **API consistency:** Match existing `{ success, data | error }` response shapes where used; consistent HTTP status codes; `projectId` and multi-tenant boundaries on data access.
- **Data integrity:** Prisma models often use soft delete (`deletedAt`); new queries should respect existing deletion and project scoping patterns.
- **Frontend:** React Query usage for server state; Zustand for client state; preserve existing component and styling patterns (Tailwind, design system). Avoid unnecessary re-renders and effect dependency bugs.
- **Types:** Keep `shared/` types aligned with API contracts; avoid `any` without strong justification.

## Noise to avoid

- Do not flag stack choices (React, Prisma, Vite) as issues unless the PR introduces inconsistency or misuse.
- Nits should be non-blocking unless they indicate a real bug or security risk.

## Lifecycle / domain

Requirements, verification, traceability, and certification workflows are core. Flag breaking changes to trace links, lifecycle transitions, or role-gated actions without migration path or tests.
