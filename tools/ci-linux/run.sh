#!/usr/bin/env bash
set -u

case "${1:-}" in
  checks)
    set -e
    # check:requirements перечисляет файлы рабочего дерева через git ls-files.
    git rev-parse --git-dir >/dev/null 2>&1 || git init --quiet
    # Кэши привязаны к версиям инструментов и конфигам. У каждой версии один писатель.
    if [[ -d /var/cache/tessera-checks ]]; then
      key=$(sha256sum package-lock.json .nvmrc .prettierrc.json .prettierignore eslint.config.js tsconfig.json | sha256sum | cut -d' ' -f1)
      cache="/var/cache/tessera-checks/$key"
      mkdir -p "$cache" node_modules/.cache
      exec 9>"$cache/lock"
      flock 9
      for tool in prettier eslint tsc; do
        mkdir -p "$cache/$tool"
        ln -sfnT "$cache/$tool" "node_modules/.cache/$tool"
      done
    fi
    npm run format:check
    npm run lint
    NODE_OPTIONS=--max-old-space-size=4096 npm run typecheck
    npm run check:requirements
    npm run build
    npm run check:tree-shaking
    npm run check:theme
    exec npm run check:browsers ;;
  guides)
    case "${2:-}" in
      [1-4]|merge) export VITE_CONTRAST_PART="$2" ;;
      *) exit 2 ;;
    esac
    exec npm test -- --project 'browser (chromium)' contrast-guides.test.tsx guide-fresh.test.tsx ;;
  engines) exec npm run test:browsers ;;
  [1-4]) shard="$1/4" ;;
  *) echo 'Usage: run.sh {1|2|3|4|engines|checks|guides {1|2|3|4|merge}}' >&2; exit 2 ;;
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
