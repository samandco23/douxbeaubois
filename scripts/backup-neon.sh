#!/usr/bin/env sh
set -eu
umask 077

connection_url="${DATABASE_URL_DIRECT:-${DATABASE_URL:-}}"
if [ -z "$connection_url" ]; then
  echo "Set DATABASE_URL_DIRECT (recommended) or DATABASE_URL." >&2
  exit 1
fi
if ! command -v pg_dump >/dev/null 2>&1; then
  echo "Install PostgreSQL client tools to use pg_dump." >&2
  exit 1
fi

timestamp=$(date -u +%Y%m%d-%H%M%S)
backup_file=${1:-"backups/doux-beau-bois-$timestamp.dump"}
mkdir -p "$(dirname "$backup_file")"
pg_dump --format=custom --no-owner --no-privileges --file "$backup_file" "$connection_url"
chmod 600 "$backup_file"
echo "Backup created: $backup_file"
