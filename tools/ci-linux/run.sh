#!/usr/bin/env bash
set -u

case "${1:-}" in
  guides)
    case "${2:-}" in
      [1-4]|merge) export VITE_CONTRAST_PART="$2" ;;
      *) exit 2 ;;
    esac
    exec npm test -- --project 'browser (chromium)' contrast-guides.test.tsx guide-fresh.test.tsx ;;
  engines) exec npm run test:browsers ;;
  [1-4]) shard="$1/4" ;;
  *) echo 'Usage: run.sh {1|2|3|4|engines|guides {1|2|3|4|merge}}' >&2; exit 2 ;;
esac

result=0
for project in unit-touch 'browser (chromium)' 'storybook (chromium)' 'storybook-dark (chromium)'; do
  echo "Starting $project, shard $shard"
  if [[ "$project" == unit-touch ]]; then
    npm test -- --project unit --project 'touch*' --shard="$shard" || result=1
  elif [[ "$project" == 'browser (chromium)' ]]; then
    TESSERA_SEPARATE_GUIDES=1 npm test -- --project "$project" --shard="$shard" || result=1
    bash "$0" guides "$1" || result=1
  else
    npm test -- --project "$project" --shard="$shard" || result=1
  fi
done
exit "$result"
