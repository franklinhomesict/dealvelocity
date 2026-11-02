#!/bin/sh
# Nightly pg_dump at 2:30am Central, keeping BACKUP_KEEP_DAYS days. Runs once at startup too.
set -eu
backup() {
  f="/backups/acq_os-$(date +%Y%m%d-%H%M%S).dump"
  if pg_dump -Fc -f "$f.tmp"; then
    mv "$f.tmp" "$f"
    echo "$(date) backup ok: $f ($(du -h "$f" | cut -f1))"
  else
    rm -f "$f.tmp"; echo "$(date) BACKUP FAILED" >&2
  fi
  find /backups -name 'acq_os-*.dump' -mtime +"${BACKUP_KEEP_DAYS:-14}" -delete
}
backup
while true; do
  now=$(date +%s)
  next=$(date -d "$(date +%Y-%m-%d) 02:30" +%s 2>/dev/null || echo $((now + 86400)))
  [ "$next" -le "$now" ] && next=$((next + 86400))
  sleep $((next - now))
  backup
done
