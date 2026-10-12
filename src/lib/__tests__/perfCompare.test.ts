import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import {
  type Side,
  bootstrapRatio,
  exitCodeOf,
  prepareWorktree,
  removeWorktree,
  roundOrder,
  runRounds,
  samplesOf,
  verdictOf,
} from '../../../scripts/perfTools'

// Сравнение перф-кейсов с базой вперемешку (ADR 0099, PF12–PF14, PF18).

const git = (cwd: string, ...args: string[]) =>
  execFileSync(
    'git',
    ['-c', 'user.email=perf@test', '-c', 'user.name=perf', ...args],
    { cwd, encoding: 'utf8' },
  ).trim()

const temps: string[] = []
afterEach(() => {
  for (const dir of temps.splice(0))
    rmSync(dir, { recursive: true, force: true })
})

/** Репозиторий с коммитом lockfile и «node_modules» с меткой. */
const makeRepo = () => {
  const repo = mkdtempSync(join(tmpdir(), 'tessera-compare-repo-'))
  temps.push(repo)
  git(repo, 'init', '-q')
  writeFileSync(join(repo, 'package-lock.json'), '{"v":1}\n')
  writeFileSync(join(repo, '.gitignore'), 'node_modules\n')
  git(repo, 'add', '.')
  git(repo, 'commit', '-q', '-m', 'init')
  mkdirSync(join(repo, 'node_modules'))
  writeFileSync(join(repo, 'node_modules', 'marker'), 'keep')
  return repo
}

const worktrees = (repo: string) =>
  git(repo, 'worktree', 'list', '--porcelain')
    .split('\n')
    .filter(line => line.startsWith('worktree '))

describe('perf:compare', () => {
  it('PF12: рабочее дерево ref во временном каталоге; node_modules — ссылкой при совпадающем lockfile, иначе остановка или npm ci по --install; дерево удаляется по завершении и при ошибке, ссылка снимается первой', () => {
    const repo = makeRepo()

    // Совпадающий lockfile — ссылка на node_modules проекта.
    const tree = prepareWorktree(repo, 'HEAD')
    expect(tree.linked).toBe(true)
    expect(tree.dir.startsWith(tmpdir())).toBe(true)
    expect(readFileSync(join(tree.dir, 'node_modules', 'marker'), 'utf8')).toBe(
      'keep',
    )
    expect(worktrees(repo)).toHaveLength(2)
    removeWorktree(repo, tree)
    expect(existsSync(tree.dir)).toBe(false)
    expect(readFileSync(join(repo, 'node_modules', 'marker'), 'utf8')).toBe(
      'keep',
    )
    expect(worktrees(repo)).toHaveLength(1)

    // Другой lockfile — без --install остановка, дерево не создаётся.
    writeFileSync(join(repo, 'package-lock.json'), '{"v":2}\n')
    expect(() => prepareWorktree(repo, 'HEAD')).toThrow(/--install/)
    expect(worktrees(repo)).toHaveLength(1)

    // С --install — npm ci в дереве, без ссылки.
    const installed: string[] = []
    const own = prepareWorktree(repo, 'HEAD', {
      install: true,
      npmCi: dir => installed.push(dir),
    })
    expect(installed).toEqual([own.dir])
    expect(own.linked).toBe(false)
    removeWorktree(repo, own)
    expect(existsSync(own.dir)).toBe(false)

    // Ошибка установки — дерево удаляется.
    let failedDir = ''
    expect(() =>
      prepareWorktree(repo, 'HEAD', {
        install: true,
        npmCi: dir => {
          failedDir = dir
          throw new Error('npm ci упал')
        },
      }),
    ).toThrow('npm ci упал')
    expect(existsSync(failedDir)).toBe(false)
    expect(worktrees(repo)).toHaveLength(1)
  })

  it('PF13: раунды вперемешку — порядок сторон чередуется; минимум 5 раундов, кейс с неопределённым вердиктом добирает до 15', async () => {
    expect([1, 2, 3].map(roundOrder)).toEqual([
      ['A', 'B'],
      ['B', 'A'],
      ['A', 'B'],
    ])
    const calls: string[] = []
    let tick = 0
    const run = await runRounds({
      cases: ['STABLE', 'NOISY'],
      runSide: async (side: Side, pending: string[], round: number) => {
        calls.push(`${round}${side}:${pending.join(',')}`)
        tick++
        const values = new Map<string, number>()
        if (pending.includes('STABLE')) values.set('STABLE/y/p95', 10)
        // Шум ±50 % вокруг 10 мс: интервал отношения не сужается до вердикта.
        if (pending.includes('NOISY'))
          values.set(
            'NOISY/y/p95',
            tick % 3 === 0 ? 15 : tick % 3 === 1 ? 5 : 10,
          )
        return values
      },
    })
    expect(calls.slice(0, 4)).toEqual([
      '1A:STABLE,NOISY',
      '1B:STABLE,NOISY',
      '2B:STABLE,NOISY',
      '2A:STABLE,NOISY',
    ])
    // После пятого раунда стабильный кейс определён и больше не гоняется.
    expect(calls[10]).toBe('6B:NOISY')
    expect(run.rounds).toBe(15)
    const stable = run.results.find(r => r.caseId === 'STABLE')!
    expect(stable.samplesA).toHaveLength(5)
    expect(stable.verdict).toBe('unchanged')
    const noisy = run.results.find(r => r.caseId === 'NOISY')!
    expect(noisy.samplesA).toHaveLength(15)
    expect(noisy.verdict).toBe('undetermined')
  })

  it('PF14: вердикт по отношению медиан B/A с бутстреп-интервалом 95 % и фиксированным зерном; ненулевой код выхода только на регрессии', () => {
    expect(verdictOf({ low: 1.11, high: 1.4 })).toBe('regression')
    expect(verdictOf({ low: 0.6, high: 0.89 })).toBe('improvement')
    expect(verdictOf({ low: 0.95, high: 1.08 })).toBe('unchanged')
    expect(verdictOf({ low: 0.95, high: 1.2 })).toBe('undetermined')
    expect(verdictOf({ low: 1.05, high: 1.2 })).toBe('undetermined')

    const a = [10, 10.4, 9.8, 10.1, 9.9, 10.2]
    const slower = a.map(v => v * 1.3)
    const interval = bootstrapRatio(a, slower)
    expect(interval.ratio).toBeCloseTo(1.3, 5)
    expect(interval.low).toBeGreaterThan(1.1)
    expect(verdictOf(interval)).toBe('regression')
    // Зерно фиксировано: тот же вход — тот же интервал, даже на разбросанных данных и
    // малом числе повторов, где без зерна перцентили гуляют.
    const noisy = [9, 14, 10, 17, 11, 13, 8, 16, 12, 15]
    const other = noisy.map((v, i) => v * (1 + (i % 3) * 0.2))
    expect(bootstrapRatio(noisy, other, { resamples: 50 })).toEqual(
      bootstrapRatio(noisy, other, { resamples: 50 }),
    )
    expect(verdictOf(bootstrapRatio(a, [...a]))).toBe('unchanged')

    expect(exitCodeOf(['unchanged', 'improvement', 'undetermined'])).toBe(0)
    expect(exitCodeOf(['unchanged', 'regression'])).toBe(1)
  })

  it('PF18: метрика сравнения — значения записей кейса и его базы внутри прогона; кейс без записи — ошибка, а не вердикт', () => {
    const records = [
      {
        id: 'P2',
        metrics: [
          { axis: 'y' as const, metric: 'p95' as const, valueMs: 11 },
          { axis: 'x' as const, metric: 'p95' as const, valueMs: 20 },
        ],
      },
      {
        id: 'GL13-base',
        metrics: [{ axis: 'y' as const, metric: 'p95' as const, valueMs: 9 }],
      },
      {
        id: 'GL13',
        metrics: [{ axis: 'y' as const, metric: 'p95' as const, valueMs: 10 }],
      },
      { id: 'P20', metrics: [{ metric: 'longest' as const, valueMs: 1 }] },
    ]
    expect(Object.fromEntries(samplesOf(records, ['P2', 'GL13']))).toEqual({
      'P2/y/p95': 11,
      'P2/x/p95': 20,
      'GL13-base/y/p95': 9,
      'GL13/y/p95': 10,
    })
    expect(() => samplesOf(records, ['P2', 'I1'])).toThrow(/I1.*невалиден/)
  })
})
