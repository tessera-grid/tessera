#!/usr/bin/env bash
set -u

case "${1:-}" in
  engines) exec npm run test:browsers ;;
  [1-4]) shard="$1/4" ;;
  *) echo 'Usage: run.sh {1|2|3|4|engines}' >&2; exit 2 ;;
esac

result=0
for project in unit-touch 'browser (chromium)' 'storybook (chromium)' 'storybook-dark (chromium)'; do
  echo "Starting $project, shard $shard"
  if [[ "$project" == unit-touch ]]; then
    npm test -- --project unit --project 'touch*' --shard="$shard" || result=1
  else
    npm test -- --project "$project" --shard="$shard" || result=1
  fi
done
exit "$result"
