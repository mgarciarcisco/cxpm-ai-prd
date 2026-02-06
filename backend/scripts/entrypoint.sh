#!/bin/sh
# Run migrations (retry a few times for DB readiness), then start the app.
set -e
MAX_TRIES=5
SLEEP=3

for i in $(seq 1 $MAX_TRIES); do
  if alembic upgrade head; then
    break
  fi
  if [ "$i" -eq "$MAX_TRIES" ]; then
    echo "Migration failed after $MAX_TRIES attempts."
    exit 1
  fi
  echo "Migration attempt $i failed, retrying in ${SLEEP}s..."
  sleep $SLEEP
done

exec uvicorn app.main:app --host 0.0.0.0 --port 8000
