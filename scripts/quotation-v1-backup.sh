#!/usr/bin/env bash
# Quotation Builder V1 - database backup before the security migrations. READ-ONLY on the source.
#
# Production (owner approval required):
#   scripts/quotation-v1-backup.sh --linked --confirm-project-ref <ref> <output-dir>
#   Refuses unless <ref> equals supabase/.temp/project-ref (the linked project) AND the operator
#   typed it. Uses `supabase db dump` (roles, schema, data) - no writes to the database.
# Rehearsal against an isolated stack:
#   scripts/quotation-v1-backup.sh --db-url postgresql://postgres:postgres@127.0.0.1:55522/postgres <output-dir>
#
# Output: roles.sql, schema.sql, data.sql, SHA256SUMS, manifest.txt (timestamp, source, per-table row
# counts parsed from data.sql). Verify with scripts/quotation-v1-restore-verify.sh.
set -euo pipefail
mode=""; ref=""; url=""
while [ $# -gt 1 ]; do
  case "$1" in
    --linked) mode=linked; shift;;
    --confirm-project-ref) ref="$2"; shift 2;;
    --db-url) mode=url; url="$2"; shift 2;;
    *) break;;
  esac
done
out="${1:?output directory required}"
[ -e "$out" ] && { echo "Refusing: $out already exists."; exit 2; }
if [ "$mode" = linked ]; then
  linked=$(cat supabase/.temp/project-ref 2>/dev/null || true)
  [ -n "$ref" ] && [ "$ref" = "$linked" ] || { echo "Refusing: --confirm-project-ref '$ref' does not match the linked project '$linked'."; exit 2; }
  src=(--linked); source_label="linked project $linked"
elif [ "$mode" = url ]; then
  src=(--db-url "$url"); source_label="db-url $(echo "$url" | sed -E 's#//[^@]*@#//***@#')"
else
  echo "Choose --linked --confirm-project-ref <ref> or --db-url <url>."; exit 2
fi
mkdir -p "$out"
supabase db dump "${src[@]}" --role-only -f "$out/roles.sql"
supabase db dump "${src[@]}" -f "$out/schema.sql"
supabase db dump "${src[@]}" --data-only --use-copy -f "$out/data.sql"
( cd "$out" && sha256sum roles.sql schema.sql data.sql > SHA256SUMS )
{
  echo "created_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "source=$source_label"
  echo "policies_in_schema=$(grep -ciE '^create policy' "$out/schema.sql" || true)"
  echo "# rows per table (from COPY blocks in data.sql)"
  awk '/^COPY /{t=$2; n=0; next} /^\\\.$/{if(t!="") print t"="n; t=""; next} {if(t!="") n++}' "$out/data.sql" | sort
} > "$out/manifest.txt"
echo "Backup written to $out"; cat "$out/SHA256SUMS"
