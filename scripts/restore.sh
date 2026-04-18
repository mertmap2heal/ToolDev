#!/bin/sh
# Restore PostgreSQL from a backup file
# Usage: ./scripts/restore.sh backups/engineering-tool-YYYYMMDD_HHMMSS.sql.gz
set -e

BACKUP_FILE="$1"
DB_HOST="${PGHOST:-localhost}"
DB_PORT="${PGPORT:-5432}"
DB_USER="${PGUSER:-engineering_user}"
DB_NAME="${PGDATABASE:-engineering_tool}"

if [ -z "${BACKUP_FILE}" ]; then
  echo "Usage: $0 <backup-file.sql.gz>"
  echo "Example: $0 backups/engineering-tool-20260415_120000.sql.gz"
  exit 1
fi

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "Error: Backup file not found: ${BACKUP_FILE}"
  exit 1
fi

echo "[Restore] File:     ${BACKUP_FILE}"
echo "[Restore] Database: ${DB_NAME}@${DB_HOST}:${DB_PORT}"
echo "[Restore] WARNING: This OVERWRITES all current data in ${DB_NAME}."
printf "Type 'yes' to continue: "
read CONFIRM
if [ "${CONFIRM}" != "yes" ]; then
  echo "[Restore] Aborted."
  exit 1
fi

gunzip -c "${BACKUP_FILE}" | psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" "${DB_NAME}"
echo "[Restore] Complete. Verify: docker exec engineering-tool-db psql -U ${DB_USER} ${DB_NAME} -c \"SELECT count(*) FROM \\\"Requirement\\\";\""
