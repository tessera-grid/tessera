// `npm run test:parallel`: тот же набор, что `npm test`, шардами в отдельных процессах —
// у каждого свой Chromium, файлы внутри шарда по-прежнему идут по одному. Итог
// сводится `--merge-reports` из blob-отчётов шардов. Число шардов — `--shards=N`
// (по умолчанию 4, как в CI), остальные аргументы уходят каждому шарду vitest.
// Лог шарда — `node_modules/.cache/test-parallel/shard-<i>.log`.

import { spawn, spawnSync } from 'node:child_process'
import { createWriteStream, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { availableParallelism } from 'node:os'
import { resolve } from 'node:path'

const VITEST = 'node_modules/vitest/vitest.mjs'
const work = resolve('node_modules/.cache/test-parallel')
const blobs = resolve(work, 'blobs')
// Чистится содержимое, а не сам каталог: на Windows открытый в терминале каталог не удалить.
mkdirSync(work, { recursive: true })
for (const entry of readdirSync(work)) {
  rmSync(resolve(work, entry), { recursive: true, force: true })
}
mkdirSync(blobs)

const args = process.argv.slice(2)
const shardsArg = args.find(arg => arg.startsWith('--shards='))
const shards = shardsArg ? Number(shardsArg.slice('--shards='.length)) : 4
const passThrough = args.filter(arg => arg !== shardsArg)
if (!Number.isInteger(shards) || shards < 1) {
  console.error(`--shards — целое число от 1, получено: ${shardsArg}`)
  process.exit(1)
}

// Ядра делятся между шардами: иначе потоки проекта `unit` каждого шарда отнимают
// процессор у браузеров соседей. Браузерные проекты и так идут в один воркер.
const maxWorkers = Math.max(1, Math.floor(availableParallelism() / shards) - 1)

const started = performance.now()
const elapsed = () => ((performance.now() - started) / 1000).toFixed(0)

const runShard = index =>
  new Promise(done => {
    const log = resolve(work, `shard-${index}.log`)
    const child = spawn(
      process.execPath,
      [
        VITEST,
        'run',
        `--shard=${index}/${shards}`,
        `--maxWorkers=${maxWorkers}`,
        '--reporter=blob',
        `--outputFile=${resolve(blobs, `blob-${index}.json`)}`,
        ...passThrough,
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    )
    const out = createWriteStream(log)
    child.stdout.pipe(out)
    child.stderr.pipe(out)
    child.on('close', status => {
      console.log(
        `Шард ${index}/${shards}: ${status === 0 ? 'ok' : `код ${status}`}, ${elapsed()} с — ${log}`,
      )
      done(status)
    })
  })

console.log(`Шардов: ${shards}, логи — ${work}`)
const statuses = await Promise.all(
  Array.from({ length: shards }, (_, i) => runShard(i + 1)),
)

const merged = spawnSync(
  process.execPath,
  [VITEST, 'run', `--merge-reports=${blobs}`],
  { stdio: 'inherit' },
).status
console.log(`Всего: ${elapsed()} с`)

process.exit(statuses.every(status => status === 0) && merged === 0 ? 0 : 1)
