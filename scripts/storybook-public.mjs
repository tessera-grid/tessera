// Публичный набор историй (ADR 0117 §8, ADR 0113 DC11) — без песочниц `*.dev` и историй
// только для снимков `*.vr`: `dev` — живой Storybook глазами посетителя Pages на :6008,
// `build` — публичная сборка в `storybook-public/`.

import { spawnSync } from 'node:child_process'

const MODES = {
  dev: ['dev', '-p', '6008'],
  build: ['build', '--output-dir', 'storybook-public'],
}

const [mode, ...rest] = process.argv.slice(2)
if (!MODES[mode]) {
  console.error(
    `Режим — ${Object.keys(MODES).join(' или ')}, получено: ${mode}`,
  )
  process.exit(1)
}

const { status } = spawnSync(
  process.execPath,
  ['node_modules/storybook/dist/bin/dispatcher.js', ...MODES[mode], ...rest],
  { stdio: 'inherit', env: { ...process.env, STORYBOOK_TARGET: 'public' } },
)
process.exit(status ?? 1)
