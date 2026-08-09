#!/usr/bin/env bash
#
# Brings up a throwaway Postgres and a production build of the site against it,
# so write paths can be exercised without touching the real database.
#
# There is no test database anywhere: the only Postgres this project has is the
# one on Zeabur holding real signups, and poking at that to check a code change
# is how you end up cleaning rows out of production afterwards.
#
#   ./scripts/smoke-db.sh start   # http://127.0.0.1:3111, empty database
#   ./scripts/smoke-db.sh psql    # a shell on that database
#   ./scripts/smoke-db.sh stop    # stops both and deletes the data directory
#
# Everything it creates lives under .smoke/ and is disposable.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA="$ROOT/.smoke/pgdata"
LOGS="$ROOT/.smoke"
PORT=55432
APP_PORT=3111
# The Unix socket path has a 103-byte limit and a data directory deep in a repo
# blows through it, so the socket goes somewhere short instead.
SOCKET=/tmp/vt-smoke-pg

export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"

DB_URL="postgresql://vt@127.0.0.1:$PORT/vibethursday"

start() {
  mkdir -p "$LOGS" "$SOCKET"

  if [ ! -d "$DATA" ]; then
    initdb -D "$DATA" -U vt --auth=trust -E UTF8 > "$LOGS/initdb.log" 2>&1
  fi

  pg_ctl -D "$DATA" -o "-p $PORT -k $SOCKET" -l "$LOGS/pg.log" start > /dev/null 2>&1 || true
  sleep 2
  createdb -h 127.0.0.1 -p "$PORT" -U vt vibethursday 2>/dev/null || true

  # A production build, not `next dev`: dev recompiles per route and the first
  # request to each page times out often enough to look like a real failure.
  ( cd "$ROOT" && pnpm build > "$LOGS/build.log" 2>&1 )

  DATABASE_URL="$DB_URL" \
  ADMIN_TOKEN="smoke-only-admin-token-not-a-secret" \
  MEMBER_SECRET="smoke-only-member-secret-not-a-secret" \
    npx next start -p "$APP_PORT" > "$LOGS/next.log" 2>&1 &

  sleep 5
  echo "app       http://127.0.0.1:$APP_PORT"
  echo "database  $DB_URL"
}

stop() {
  pkill -f "next start -p $APP_PORT" 2>/dev/null || true
  pg_ctl -D "$DATA" stop -m fast > /dev/null 2>&1 || true
  rm -rf "$DATA" "$SOCKET"
  echo "stopped, data directory deleted"
}

case "${1:-start}" in
  start) start ;;
  stop) stop ;;
  psql) psql -h 127.0.0.1 -p "$PORT" -U vt -d vibethursday ;;
  *) echo "usage: $0 [start|stop|psql]" >&2; exit 1 ;;
esac
