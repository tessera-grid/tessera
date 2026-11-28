// Сборка сайта документации (ADR 0113, §7): строгая проверка справочника, сайт Astro и
// публичный Storybook рядом в `website/dist/storybook/`. Зависимости сайта ставятся в
// `website/` отдельно: `npm ci --prefix website`.
//   npm run docs:build                    — всё
//   npm run docs:build -- --no-storybook  — без Storybook (быстрая проверка сайта)

import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const website = join(root, 'website')
const withStorybook = !process.argv.includes('--no-storybook')

const run = (command, args, cwd = root) => {
  const { status } = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (status !== 0) process.exit(status ?? 1)
}

if (!existsSync(join(website, 'node_modules'))) {
  console.error(
    '[docs:build] website dependencies are missing: npm ci --prefix website',
  )
  process.exit(1)
}

run(process.execPath, ['scripts/check-api.mjs'], website)
run('npx', ['astro', 'build'], website)

if (withStorybook) {
  run('npm', ['run', 'build-storybook:public'])
  const target = join(website, 'dist', 'storybook')
  rmSync(target, { recursive: true, force: true })
  cpSync(join(root, 'storybook-public'), target, { recursive: true })
  console.log('[docs:build] Storybook copied to website/dist/storybook')
}
