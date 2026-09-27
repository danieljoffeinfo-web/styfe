#!/usr/bin/env bash
# Applies the migrations and seed to a throwaway local Postgres and checks the
# numbers, so schema changes can be verified without touching the real project.
#
#   ./scripts/verify-sql.sh
#
# Needs postgresql-client and a postgres server binary (Debian/Ubuntu:
# `apt-get install postgresql`). It never talks to Supabase.
set -euo pipefail

if [ "$(id -u)" = "0" ]; then
  echo "Postgres will not run as root. Run this as your normal user." >&2
  exit 1
fi

PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1)}"
PGDATA="${PGDATA:-/var/tmp/styfe-verify-pgdata}"
PORT="${PORT:-5433}"
SOCK="${SOCK:-/tmp}"
PSQL="psql -h $SOCK -p $PORT -U postgres -v ON_ERROR_STOP=1 -q"

cleanup() { "$PGBIN/pg_ctl" -D "$PGDATA" stop -m immediate >/dev/null 2>&1 || true; }
trap cleanup EXIT

rm -rf "$PGDATA"
"$PGBIN/initdb" -D "$PGDATA" -U postgres --auth=trust >/dev/null
"$PGBIN/pg_ctl" -D "$PGDATA" -l "$PGDATA/log" -o "-p $PORT -k $SOCK" start >/dev/null
sleep 2

createdb -h "$SOCK" -p "$PORT" -U postgres styfe_verify
export PGDATABASE=styfe_verify

$PSQL -d styfe_verify -f supabase/test/harness.sql
for f in supabase/migrations/*.sql; do
  echo "  applying $(basename "$f")"
  $PSQL -d styfe_verify -c "set client_min_messages = warning" -f "$f"
done

$PSQL -d styfe_verify -c "insert into auth.users (email) values ('danieljoffeinfo@gmail.com');"
$PSQL -d styfe_verify -c "set client_min_messages = warning" -f seed/seed.sql
echo "  seed applied; running it again to prove it is idempotent"
$PSQL -d styfe_verify -c "set client_min_messages = warning" -f seed/seed.sql

$PSQL -d styfe_verify -f supabase/test/checks.sql
echo "  SQL verified."
