#!/bin/sh
# PostgreSQL backup script for engineering-tool
# Runs inside the backup sidecar container via cron
set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
DB_HOST="${PGHOST:-postgres}"
DB_USER="${PGUSER:-engineering_user}"
DB_NAME="${PGDATABASE:-engineering_tool}"
BACKUP_FILE="${BACKUP_DIR}/engineering-tool-${TIMESTAMP}.sql.gz"

echo "[Backup] Starting at ${TIMESTAMP} (host=${DB_HOST}, db=${DB_NAME}, retention=${RETENTION_DAYS}d)"

pg_dump -h "${DB_HOST}" -U "${DB_USER}" "${DB_NAME}" | gzip > "${BACKUP_FILE}"
echo "[Backup] Written to ${BACKUP_FILE} ($(du -sh "${BACKUP_FILE}" | cut -f1))"

# Prune backups older than retention window
find "${BACKUP_DIR}" -name "engineering-tool-*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete
echo "[Backup] Pruned backups older than ${RETENTION_DAYS} days"

LATEST=$(ls -1t "${BACKUP_DIR}"/engineering-tool-*.sql.gz 2>/dev/null | head -1)
echo "[Backup] Done. Latest: ${LATEST}"
