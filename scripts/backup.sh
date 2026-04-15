#!/bin/sh
# PostgreSQL backup script for engineering-tool
# Runs inside the backup sidecar container via cron
#
# Off-host upload: set S3_BACKUP_BUCKET (e.g. "my-company-backups/engineering-tool")
# and provide AWS credentials via AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY,
# AWS_DEFAULT_REGION in docker-compose.yml / .env.
# If S3_BACKUP_BUCKET is unset or empty, backups remain local-only.
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

# --- Off-host upload (S3) ---
if [ -n "${S3_BACKUP_BUCKET}" ]; then
  if command -v aws > /dev/null 2>&1; then
    S3_KEY="s3://${S3_BACKUP_BUCKET}/engineering-tool-${TIMESTAMP}.sql.gz"
    echo "[Backup] Uploading to ${S3_KEY} ..."
    if aws s3 cp "${BACKUP_FILE}" "${S3_KEY}" --no-progress; then
      echo "[Backup] S3 upload succeeded: ${S3_KEY}"
      # Prune S3 objects older than retention window (days -> seconds)
      CUTOFF=$(date -d "-${RETENTION_DAYS} days" +%Y-%m-%dT%H:%M:%S 2>/dev/null \
               || date -v-"${RETENTION_DAYS}"d +%Y-%m-%dT%H:%M:%S 2>/dev/null \
               || echo "")
      if [ -n "${CUTOFF}" ]; then
        aws s3 ls "s3://${S3_BACKUP_BUCKET}/" 2>/dev/null \
          | awk '{print $4}' \
          | grep '^engineering-tool-' \
          | while read -r obj; do
              obj_date=$(echo "${obj}" | sed 's/engineering-tool-\([0-9]\{8\}\)_.*/\1/' | \
                         sed 's/\([0-9]\{4\}\)\([0-9]\{2\}\)\([0-9]\{2\}\)/\1-\2-\3/')
              if [ "${obj_date}" \< "${CUTOFF%T*}" ]; then
                echo "[Backup] Pruning S3 object: ${obj}"
                aws s3 rm "s3://${S3_BACKUP_BUCKET}/${obj}"
              fi
            done
      fi
    else
      echo "[Backup] WARNING: S3 upload FAILED for ${S3_KEY} — local copy retained." >&2
    fi
  else
    echo "[Backup] WARNING: S3_BACKUP_BUCKET is set but 'aws' CLI is not available in PATH." >&2
    echo "[Backup] WARNING: Off-host upload skipped — local copy retained." >&2
  fi
else
  echo "[Backup] WARNING: S3_BACKUP_BUCKET is not set — backup is LOCAL ONLY." >&2
  echo "[Backup] WARNING: Disk failure will cause both DB and backup loss. Set S3_BACKUP_BUCKET to enable off-host upload." >&2
fi

# Prune local backups older than retention window
find "${BACKUP_DIR}" -name "engineering-tool-*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete
echo "[Backup] Pruned local backups older than ${RETENTION_DAYS} days"

LATEST=$(ls -1t "${BACKUP_DIR}"/engineering-tool-*.sql.gz 2>/dev/null | head -1)
echo "[Backup] Done. Latest local: ${LATEST}"
