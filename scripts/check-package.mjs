// Пакет глазами потребителя (ADR 0091, EV7–EV9): архив `npm pack` проверяют publint и
// arethetypeswrong, поля для реестра на месте (ADR 0103, CI12), входы `dist` начинаются
// с `'use client'`, а приложения-фикстуры во временной папке ставят архив из npm и
// проходят типы, сборку и запуск в Node.
// Запуск: после `npm run build` — `npm run check:package` (нужна сеть).

import { execFileSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { publint } from 'publint'
import { formatMessage } from 'publint/utils'

import { FIXTURES, missingMetadata, missingUseClient } from './packageChecks.ts'

const root = process.cwd()
const failures = []
const run = (command, args, cwd) =>
  execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  })

const work = mkdtempSync(join(tmpdir(), 'tessera-check-package-'))
try {
  // Архив — то, что получит потребитель.
  run('npm', ['pack', '--pack-destination', work, '--silent'], root)
  const tarball = join(
    work,
    readdirSync(work).find(file => file.endsWith('.tgz')),
  )

  const metadata = missingMetadata(root)
  if (metadata.length > 0) {
    failures.push(`нет полей пакета: ${metadata.join(', ')}`)
  }

  const directives = missingUseClient(resolve(root, 'dist'))
  if (directives.length > 0) {
    failures.push(`без 'use client': ${directives.join(', ')}`)
  }

  const { messages, pkg } = await publint({ pkgDir: root, pack: 'npm' })
  for (const message of messages.filter(m => m.type !== 'suggestion')) {
    failures.push(`publint: ${formatMessage(message, pkg)}`)
  }

  try {
    run(
      'npx',
      [
        'attw',
        tarball,
        '--profile',
        'node16',
        '--exclude-entrypoints',
        './style.css',
      ],
      root,
    )
  } catch (error) {
    failures.push(`arethetypeswrong:\n${error.stdout ?? error.message}`)
  }

  for (const fixture of FIXTURES) {
    const dir = join(work, fixture.name)
    mkdirSync(dir)
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify(
        {
          name: `fixture-${fixture.name}`,
          private: true,
          type: 'module',
          dependencies: {
            ...fixture.dependencies,
            '@mstrvtt/tessera': `file:${tarball.split('\\').join('/')}`,
          },
        },
        null,
        2,
      ),
    )
    for (const [file, content] of Object.entries(fixture.files)) {
      writeFileSync(join(dir, file), content)
    }
    try {
      run(
        'npm',
        ['install', '--no-audit', '--no-fund', '--loglevel=error'],
        dir,
      )
    } catch (error) {
      failures.push(
        `${fixture.name}: npm install\n${error.stderr ?? error.message}`,
      )
      continue
    }
    for (const [command, ...args] of fixture.commands) {
      try {
        run(command, args, dir)
        console.log(`✓ ${fixture.name}: ${[command, ...args].join(' ')}`)
      } catch (error) {
        failures.push(
          `${fixture.name}: ${[command, ...args].join(' ')}\n${error.stdout ?? ''}${error.stderr ?? error.message}`,
        )
      }
    }
  }
} finally {
  rmSync(work, { recursive: true, force: true })
}

if (failures.length > 0) {
  console.error(`[check-package] ${failures.length} проблем:\n`)
  for (const failure of failures) console.error(`${failure}\n`)
  process.exit(1)
}
console.log(
  `[check-package] OK — publint, arethetypeswrong, 'use client', фикстуры: ${FIXTURES.map(f => f.name).join(', ')}`,
)
