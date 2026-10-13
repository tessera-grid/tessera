// `npm run release -- [patch|minor|major] [--yes]` — выпуск версии;
// `npm run release:draft -- [patch|minor|major]` — только черновик раздела CHANGELOG;
// `node scripts/release.mjs --notes vX.Y.Z` — текст раздела для GitHub Release (CI).
// ADR 0103, CI7–CI11. Инструкция — docs/releasing.md.

import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'

import { releaseNotes, runRelease } from './releaseTools.ts'

const args = process.argv.slice(2)
const option = name => {
  const i = args.indexOf(name)
  return i === -1 ? undefined : args[i + 1]
}

const read = path => (existsSync(path) ? readFileSync(path, 'utf8') : undefined)

const notesTag = option('--notes')
if (notesTag) {
  process.stdout.write(`${releaseNotes(read('CHANGELOG.md'), notesTag)}\n`)
  process.exit(0)
}

const level = args.find(arg => ['patch', 'minor', 'major'].includes(arg))
const unknown = args.filter(
  arg => !['patch', 'minor', 'major', '--yes', '--draft'].includes(arg),
)
if (unknown.length > 0) {
  console.error(
    `Неизвестные аргументы: ${unknown.join(' ')}\n` +
      'Использование: npm run release -- [patch|minor|major] [--yes]\n' +
      '               npm run release:draft -- [patch|minor|major]',
  )
  process.exit(2)
}

const run = (command, commandArgs) =>
  execFileSync(command, commandArgs, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    // npm и gh на Windows — .cmd-обёртки.
    shell: process.platform === 'win32' && command !== 'git',
  })

const edit = path => {
  const editor = run('git', ['var', 'GIT_EDITOR']).trim()
  spawnSync(`${editor} "${path}"`, { stdio: 'inherit', shell: true })
}

const prompt = async question => {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    return await rl.question(question)
  } finally {
    rl.close()
  }
}

process.exitCode = await runRelease(
  {
    level,
    yes: args.includes('--yes'),
    draft: args.includes('--draft'),
  },
  {
    run,
    read,
    write: (path, text) => writeFileSync(path, text),
    edit,
    prompt,
    log: message => console.log(message),
    today: () => new Date().toISOString().slice(0, 10),
  },
)
