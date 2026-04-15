# Disaster Recovery Runbook

**Engineering Project Development Tool**

| Field | Value |
|-------|-------|
| RPO (Recovery Point Objective) | 24 hours |
| RTO (Recovery Time Objective) | 4 hours |
| Backup frequency | Daily (00:00 UTC via backup sidecar cron) |
| Backup retention | 30 days |
| Last drill date | _Not yet performed — schedule first drill before going live_ |
| Runbook owner | Platform / DevOps team |

---

## 1. When to use this runbook

Invoke this runbook when any of the following occur:

- The database container (`engineering-tool-db`) is corrupted, deleted, or unrecoverable
- A migration was applied that destroyed data (bad schema change)
- Accidental `docker-compose down -v` was run in production
- A serious data integrity incident is detected (mass deletion, truncation, etc.)
- You are performing a planned restore drill

---

## 2. Stop the application safely

Before restoring, stop the backend to prevent writes to the database during restoration.

```bash
# If running via docker-compose
docker-compose stop backend

# If running manually (find the process)
# Windows
Get-Process node | Stop-Process -Force
# Linux/Mac
pkill -f "tsx watch"
```

Leave the database container running — you need it for the restore.

---

## 3. Find the correct backup file

Backups are stored in the `./backups/` directory on the host (mounted into the backup sidecar).

```bash
# List available backups, newest first
ls -lt backups/engineering-tool-*.sql.gz | head -10

# Example output:
# -rw-r--r-- 1 root root 1.2M Apr 15 00:01 backups/engineering-tool-20260415_000100.sql.gz
# -rw-r--r-- 1 root root 1.1M Apr 14 00:01 backups/engineering-tool-20260414_000100.sql.gz
```

Choose the newest backup file that pre-dates the incident.

**RPO note:** Daily backups mean the maximum data loss is 24 hours. If the incident happened at 10:00 and the last backup was at 00:01, up to 9h59m of data may be unrecoverable from backup alone. Check application logs for any transactions that occurred since the backup to assess actual data loss.

---

## 4. Verify the backup file is intact

Before restoring, verify the gzip file is not corrupted:

```bash
gunzip -t backups/engineering-tool-20260415_000100.sql.gz
echo "Exit code: $?"
# Exit code 0 = file is valid
# Non-zero = file is corrupted — try the next-oldest backup
```

---

## 5. Restore the database

Use the provided restore script. It will prompt for confirmation before overwriting data.

```bash
./scripts/restore.sh backups/engineering-tool-20260415_000100.sql.gz
```

The script will:
1. Verify the backup file exists
2. Prompt "Type 'yes' to continue" (this overwrites all current data)
3. Run `gunzip -c <file> | psql ... engineering_tool`
4. Print the verification command on success

**Manual equivalent** (if the script is unavailable):

```bash
PGPASSWORD=engineering_password \
  gunzip -c backups/engineering-tool-20260415_000100.sql.gz \
  | psql -h localhost -p 5432 -U engineering_user engineering_tool
```

**Expected duration:** 2–10 minutes depending on database size. Large databases may take longer.

---

## 6. Verify data integrity post-restore

Run these checks immediately after the restore completes:

```bash
# Connect to the database
docker exec -it engineering-tool-db \
  psql -U engineering_user -d engineering_tool

# Inside psql — run these queries:

-- Row counts (should match pre-incident numbers roughly)
SELECT 'Project'       AS table, COUNT(*) FROM "Project"      UNION ALL
SELECT 'Requirement'   AS table, COUNT(*) FROM "Requirement"  UNION ALL
SELECT 'User'          AS table, COUNT(*) FROM "User"         UNION ALL
SELECT 'Parameter'     AS table, COUNT(*) FROM "Parameter"    UNION ALL
SELECT 'Issue'         AS table, COUNT(*) FROM "Issue"        UNION ALL
SELECT 'Task'          AS table, COUNT(*) FROM "Task";

-- Check latest modification timestamps (should be close to backup timestamp)
SELECT MAX("updatedAt") AS latest_update FROM "Requirement";
SELECT MAX("createdAt") AS latest_user   FROM "User";

-- Verify no orphaned requirements (soft-deleted cleanup)
SELECT COUNT(*) AS soft_deleted_count
FROM "Requirement"
WHERE "deletedAt" IS NOT NULL;

\q
```

Check the API health endpoint:

```bash
curl http://localhost:5000/api/health/db
# Expected: {"ok":true,"projectCount":<N>}
```

---

## 7. Restart the application

Once data integrity is confirmed:

```bash
# Full restart using start.ps1 (Windows)
.\start.ps1

# Or start backend only (if only the backend was stopped)
docker-compose start backend
```

Verify the application responds:

```bash
curl http://localhost:5000/api/health
# Expected: {"status":"ok","message":"Server is running"}
```

Log into the frontend at `http://localhost:3000` and verify a known project and its requirements are visible.

---

## 8. Post-incident actions

After a successful restore:

1. **Record the incident** — document what happened, when, and what was lost
2. **Notify affected users** — inform anyone who may have lost data since the last backup
3. **Root-cause analysis** — determine what caused the incident and create a GitHub issue to prevent recurrence
4. **Update this runbook** — if the procedure required any deviation, update this document
5. **Re-enable automated backups** — verify the backup cron job is still running after the restore

---

## 9. Monthly restore drill

**Goal:** Confirm backups are restorable and measure actual RTO.

**Procedure:**

1. Choose a recent backup file (the previous day's, not today's)
2. Stand up a separate staging instance:
   ```bash
   # Start a fresh postgres container on a different port for the drill
   docker run --rm -d \
     --name drill-db \
     -e POSTGRES_USER=engineering_user \
     -e POSTGRES_PASSWORD=engineering_password \
     -e POSTGRES_DB=engineering_tool \
     -p 5433:5432 \
     postgres:15-alpine
   ```
3. Restore into the staging instance:
   ```bash
   PGPASSWORD=engineering_password \
     gunzip -c backups/engineering-tool-<date>.sql.gz \
     | psql -h localhost -p 5433 -U engineering_user engineering_tool
   ```
4. Run the integrity checks from step 6 against port 5433
5. Record the start and end times — this is your measured RTO
6. Tear down the staging container: `docker stop drill-db`
7. Update the "Last drill date" field at the top of this document

**Target:** Measured RTO under 4 hours. If consistently over, the RTO target must be revised.

---

## 10. Backup health monitoring

The backup sidecar logs success/failure to stdout. Monitor for these patterns:

```
[Backup] Done. Latest: /backups/engineering-tool-YYYYMMDD_HHMMSS.sql.gz  ← success
[Backup] ...                                                               ← any absence = failure
```

**Daily check:** Verify that a backup file was created within the last 25 hours:

```bash
# Returns exit code 0 if a fresh backup exists, 1 if missing
LATEST=$(ls -t backups/engineering-tool-*.sql.gz 2>/dev/null | head -1)
if [ -z "$LATEST" ]; then
  echo "ALERT: No backup files found"
  exit 1
fi
AGE_HOURS=$(( ( $(date +%s) - $(stat -c %Y "$LATEST") ) / 3600 ))
if [ "$AGE_HOURS" -gt 25 ]; then
  echo "ALERT: Latest backup is ${AGE_HOURS}h old (threshold: 25h) — ${LATEST}"
  exit 1
fi
echo "OK: Latest backup is ${AGE_HOURS}h old — ${LATEST}"
```

Add this check to your monitoring cron (e.g. run at 02:00 UTC, one hour after the backup window).

---

## Related documents

- `scripts/backup.sh` — backup script run by the sidecar container
- `scripts/restore.sh` — interactive restore script
- `docker-compose.yml` — backup sidecar configuration
- GitHub issue [#22](https://github.com/chriertcafdle-beep/ToolDevelopment/issues/22) — backup infrastructure
- GitHub issue [#33](https://github.com/chriertcafdle-beep/ToolDevelopment/issues/33) — this runbook
