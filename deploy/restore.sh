#!/usr/bin/env bash
# Restore a backup into the running stack:  ./deploy/restore.sh backups/acq_os-YYYYmmdd-HHMMSS.dump
# Replaces the current database contents. The app is stopped during the restore.
set -euo pipefail
f="${1:?usage: deploy/restore.sh <backup.dump>}"
[ -f "$f" ] || { echo "No such file: $f" >&2; exit 1; }
read -r -p "This REPLACES all current data with $f. Type RESTORE to continue: " ok
[ "$ok" = "RESTORE" ] || { echo "Cancelled."; exit 1; }
dc() { docker compose --env-file .env.production "$@"; }
dc stop app
dc exec -T db sh -c 'dropdb -U acq --if-exists acq_os_restore && createdb -U acq acq_os_restore'
dc exec -T db pg_restore -U acq -d acq_os_restore --no-owner < "$f"
dc exec -T db psql -U acq -d postgres -v ON_ERROR_STOP=1 -c "select pg_terminate_backend(pid) from pg_stat_activity where datname='acq_os';" -c "alter database acq_os rename to acq_os_before_restore_$(date +%Y%m%d%H%M%S);" -c "alter database acq_os_restore rename to acq_os;"
dc start app
echo "✓ Restored $f. The previous database was kept as acq_os_before_restore_* (drop it once you've verified)."
