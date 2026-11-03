#!/usr/bin/env sh
set -eu
umask 077

backup_file=${1:-}
connection_url="${DATABASE_URL_DIRECT:-${DATABASE_URL:-}}"
if [ -z "$backup_file" ] || [ ! -f "$backup_file" ]; then
  echo "Usage: scripts/restore-neon.sh path/to/backup.dump" >&2
  exit 1
fi
if [ -z "$connection_url" ]; then
  echo "Set DATABASE_URL_DIRECT (recommended) or DATABASE_URL." >&2
  exit 1
fi
if ! command -v pg_restore >/dev/null 2>&1; then
  echo "Install PostgreSQL client tools to use pg_restore." >&2
  exit 1
fi

printf 'This replaces objects contained in the dump on the target database. Type RESTORE to continue: '
read -r confirmation
if [ "$confirmation" != "RESTORE" ]; then
  echo "Restore cancelled."
  exit 1
fi
pg_restore --clean --if-exists --no-owner --no-privileges --dbname "$connection_url" "$backup_file"
echo "Restore completed."
