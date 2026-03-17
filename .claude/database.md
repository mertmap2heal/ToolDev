# Database

## Overview
- **Engine:** PostgreSQL 15 (Docker — `docker-compose up -d`)
- **ORM:** Prisma v5
- **Schema:** `backend/prisma/schema.prisma` — **157 models**
- **Migrations:** `backend/prisma/migrations/` — **13 migrations**
- **Container name:** `engineering-tool-db`
- **Port:** 5432
- **Volume:** `postgres_data` (persists across `docker-compose down`)

## Essential commands (run from `backend/`)

```bash
# Dev — sync schema without creating a migration file (used by start.ps1)
npx prisma db push

# After any schema change — regenerate the Prisma client
npx prisma generate

# Create a new migration (interactive, dev only)
npx prisma migrate dev --name <description>

# Apply existing migrations (non-interactive — use in CI / production)
npx prisma migrate deploy

# Open Prisma Studio GUI
npm run prisma:studio

# Check DB health
curl http://localhost:5000/api/health/db
```

## Docker commands
```powershell
docker-compose up -d              # start DB
docker-compose down               # stop DB (data persists in volume)
docker-compose down -v            # stop DB and DELETE all data
docker-compose logs postgres      # inspect DB logs
docker ps                         # verify container is running + healthy
```

## Schema highlights
Key model groups in `schema.prisma`:

| Group | Models (examples) |
|-------|------------------|
| Users & Auth | `User`, `ProjectMember`, `EngineeringRole`, `AdminRole`, `Organization` |
| Projects | `Project`, `SavedView`, `CustomRequirementType` |
| Requirements | `Requirement`, `RequirementVersion`, `RequirementComment`, `RequirementAttachment`, `RequirementExportTemplate` |
| Verification | `VerMethod`, `VerTestCase`, `VerTestPlan`, `VerTestRun`, `VerTestResult`, `VerMoc`, `VerBaseline`, `VerEvidence` |
| Architecture | `Architecture`, `SystemFunction`, `UseCase`, `Actor`, `Diagram` |
| Traceability | `TraceLink`, `Dependency` |
| Issues | `Issue`, `IssueComment`, `IssueSubscription` |
| Tasks | `Task`, `TaskTemplate`, `BoardColumn`, `TaskAnalytics` |
| Parameters | `Parameter`, `ParameterVersion` |
| Change requests | `ChangeRequest`, `RequirementChangeRequestLink` |
| Certification | `CertContext`, `CertObjective`, `CertBaseline`, `CertPlan`, `CertMilestone`, `CertSignOff` |
| Export / Templates | `ExportJob`, `CorporateDocxTemplate`, `ExcelColumnMapping`, `ScheduledExport` |
| Config management | `Baseline`, `AuditLog` |
| Inventory | `Item`, `Warehouse`, `UOM`, `Purchase`, `Sales`, `Customer`, `Supplier` |
| Compliance | `ComplianceRule`, `ComplianceFinding` |

## Soft deletes
`Requirement` and `RequirementExportTemplate` use `deletedAt: DateTime?`.
- Always filter `WHERE deletedAt IS NULL` unless working with archives.
- A daily scheduled job (`cleanup.service.ts`) permanently purges old soft-deleted records.
- Restore endpoint available via `POST /api/v1/requirements/:id/restore`.

## Seeding (run from `backend/`)
```bash
npm run seed:users       # create initial user accounts
npm run seed:demo        # full demo project — all entity types populated
npm run seed:mocs        # method of compliance reference data
npm run seed:test-case   # sample test cases
npm run seed:test-plan   # sample test plans
npm run seed:test-run    # sample test runs
```
