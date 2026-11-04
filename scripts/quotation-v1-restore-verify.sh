#!/usr/bin/env bash
# Restores a backup from scripts/quotation-v1-backup.sh into the `postgres` database of a FRESHLY
# STARTED, EMPTY isolated local Supabase stack (Supabase's documented restore: roles, then schema and
# data in one transaction with triggers suspended) and compares it with the backup manifest.
# Never targets production: the container must be a local supabase_db_* container whose public
# schema has no builder tables yet (start one with `supabase start` on an empty volume).
#   scripts/quotation-v1-restore-verify.sh <backup-dir> [container]   (default supabase_db_gr8-quotation-acceptance)
set -euo pipefail
dir="${1:?backup directory required}"; container="${2:-supabase_db_gr8-quotation-acceptance}"
case "$container" in supabase_db_*) ;; *) echo "Refusing: $container is not a local Supabase DB container."; exit 2;; esac
( cd "$dir" && sha256sum -c --quiet SHA256SUMS ) || { echo "Checksum mismatch - backup is not intact."; exit 1; }
existing=$(docker exec "$container" psql -U postgres -Atc "select count(*) from pg_tables where schemaname='public' and tablename like 'builder_%'")
[ "$existing" = "0" ] || { echo "Refusing: target already has $existing builder tables. Use a freshly started empty stack."; exit 2; }
docker exec -i "$container" psql -U postgres -q -v ON_ERROR_STOP=0 < "$dir/roles.sql" > "$dir/restore-roles.log" 2>&1 || true
{ echo "SET session_replication_role = replica;"; cat "$dir/schema.sql" "$dir/data.sql"; } \
  | docker exec -i "$container" psql -U postgres -q -v ON_ERROR_STOP=1 --single-transaction > "$dir/restore.log" 2>&1 \
  || { echo "RESTORE FAILED - see $dir/restore.log"; tail -5 "$dir/restore.log"; exit 1; }
mismatch=0; checked=0
while IFS='=' read -r table expected; do
  case "$table" in ''|\#*|created_at|source|policies_in_schema) continue;; esac
  actual=$(docker exec "$container" psql -U postgres -Atc "select count(*) from $table" 2>/dev/null || echo "missing")
  checked=$((checked+1))
  if [ "$actual" != "$expected" ]; then mismatch=$((mismatch+1)); echo "MISMATCH $table expected=$expected restored=$actual"; fi
done < "$dir/manifest.txt"
policies=$(docker exec "$container" psql -U postgres -Atc "select count(*) from pg_policies where schemaname='public'")
expected_policies=$(grep '^policies_in_schema=' "$dir/manifest.txt" | cut -d= -f2)
echo "tables checked: $checked, row-count mismatches: $mismatch, public policies: $policies (backup: $expected_policies)"
[ "$mismatch" -eq 0 ] && [ "$policies" = "$expected_policies" ] && echo "RESTORE VERIFIED" || { echo "RESTORE NOT VERIFIED"; exit 1; }
