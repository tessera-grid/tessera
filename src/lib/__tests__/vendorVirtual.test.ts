/**
 * Форк TanStack Virtual (ADR 0143, VF1–VF4): импорт только из вендора, вендор равен
 * upstream с патчем, уведомление MIT в пакете, пересчёт позиций от первого изменённого ключа.
 * Запуск: npx vitest run --config vitest.node.config.ts vendorVirtual
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  type VirtualItem,
  Virtualizer,
  type VirtualizerOptions,
} from '../../vendor/tanstack-virtual/virtual-core'

const ROOT = join(__dirname, '..', '..', '..')
const VENDOR = join(ROOT, 'src', 'vendor', 'tanstack-virtual')
/** Файлы вендора, которых нет в upstream. */
const META = ['README.md', 'tessera.patch', 'upstream.json']

const lf = (text: string) => text.replace(/\r\n/g, '\n')
const filesOf = (dir: string): string[] =>
  readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? filesOf(path) : [path]
  })
const posix = (from: string, path: string) =>
  relative(from, path).replace(/\\/g, '/')

const UPSTREAM = /['"]@tanstack\/(?:react-virtual|virtual-core)['"]/

type Opts = VirtualizerOptions<Element, Element>
type Key = VirtualItem['key']

/** Позиции списка с ключами `keys` и измеренными размерами `measured` по ключу. */
const layout = (v: Virtualizer<Element, Element>) => {
  v.getTotalSize()
  return Array.from({ length: v.options.count }, (_, i) => {
    const item = v.measurementsCache[i]!
    return [item.key, item.start, item.size]
  })
}

const SIZE = 30
const setup = (keys: Key[], measured: Record<string, number> = {}) => {
  const calls: number[] = []
  const options: Opts = {
    count: keys.length,
    getScrollElement: () => null,
    estimateSize: index => {
      calls.push(index)
      return SIZE
    },
    getItemKey: index => keys[index]!,
    scrollToFn: () => {},
    observeElementRect: () => {},
    observeElementOffset: () => {},
  }
  const v = new Virtualizer<Element, Element>(options)
  v.getTotalSize()
  for (const [key, size] of Object.entries(measured)) {
    const index = keys.indexOf(key)
    if (index !== -1) v.resizeItem(index, size)
  }
  v.getTotalSize()
  calls.length = 0
  return { v, options, calls }
}

/** Смена ключей на месте против нового виртуализатора с теми же замерами. */
const change = (
  keys: Key[],
  next: Key[],
  measured: Record<string, number> = {},
) => {
  const { v, options, calls } = setup(keys, measured)
  v.setOptions({
    ...options,
    count: next.length,
    getItemKey: index => next[index]!,
  })
  const updated = layout(v)
  const fresh = setup(next, measured)
  return { updated, full: layout(fresh.v), estimated: [...calls] }
}

const ids = (from: number, count: number) =>
  Array.from({ length: count }, (_, k) => `r${from + k}`)
const BASE = ids(0, 1000)

describe('Форк TanStack Virtual (ADR 0143)', () => {
  it('VF1: код грида импортирует виртуализатор только из src/vendor/tanstack-virtual — ни @tanstack/react-virtual, ни @tanstack/virtual-core нет в импортах исходников и в зависимостях пакета', () => {
    const sources = filesOf(join(ROOT, 'src'))
      .filter(file => /\.(ts|tsx|js|mjs)$/.test(file))
      .filter(file => UPSTREAM.test(readFileSync(file, 'utf8')))
      .map(file => posix(ROOT, file))
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
    const declared = [
      'dependencies',
      'devDependencies',
      'peerDependencies',
      'optionalDependencies',
    ].flatMap(field =>
      Object.keys(pkg[field] ?? {}).filter(name =>
        /^@tanstack\/(react-virtual|virtual-core)$/.test(name),
      ),
    )
    expect({ sources, declared }).toEqual({ sources: [], declared: [] })
  })

  it('VF2: вендор равен исходникам upstream с tessera.patch — обратный патч даёт файлы с SHA-256 из upstream.json, и каждый файл вендора, кроме описания, патча и upstream.json, в нём записан', () => {
    const upstream = JSON.parse(
      readFileSync(join(VENDOR, 'upstream.json'), 'utf8'),
    ) as { files: Record<string, string> }
    const dir = mkdtempSync(join(tmpdir(), 'tsr-vendor-'))
    try {
      for (const file of filesOf(VENDOR)) {
        const target = join(dir, posix(VENDOR, file))
        cpSync(file, target)
        writeFileSync(target, lf(readFileSync(file, 'utf8')))
      }
      execFileSync(
        'git',
        ['-c', 'core.autocrlf=false', 'apply', '--reverse', 'tessera.patch'],
        {
          cwd: dir,
        },
      )
      const files = filesOf(dir)
        .map(file => posix(dir, file))
        .filter(name => !META.includes(name))
        .sort()
      const hashes = Object.fromEntries(
        files.map(name => [
          name,
          createHash('sha256')
            .update(lf(readFileSync(join(dir, name), 'utf8')))
            .digest('hex'),
        ]),
      )
      expect(hashes).toEqual(upstream.files)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('VF3: пакет несёт уведомление MIT TanStack Virtual — THIRD_PARTY_LICENSES.txt в поле files с текстом LICENSE вендора', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
    expect(pkg.files).toContain('THIRD_PARTY_LICENSES.txt')
    const notices = lf(
      readFileSync(join(ROOT, 'THIRD_PARTY_LICENSES.txt'), 'utf8'),
    )
    expect(notices).toContain(
      lf(readFileSync(join(VENDOR, 'LICENSE'), 'utf8')).trim(),
    )
  })

  it('VF4: при смене count или getItemKey позиции совпадают с полным пересчётом — дописывание, вставка и удаление в середине, усечение, перестановка, ключи по индексу, измеренные размеры — и пересчитываются с первого изменённого ключа', () => {
    const measured = { r100: 55, r450: 12, r900: 70 }
    const swapped = [...BASE]
    ;[swapped[10], swapped[900]] = [swapped[900]!, swapped[10]!]
    const cases: { name: string; next: Key[]; from: number }[] = [
      { name: 'дописывание', next: [...BASE, ...ids(1000, 100)], from: 1000 },
      {
        name: 'вставка',
        next: [...BASE.slice(0, 400), ...ids(5000, 5), ...BASE.slice(400)],
        from: 400,
      },
      {
        name: 'удаление',
        next: [...BASE.slice(0, 400), ...BASE.slice(403)],
        from: 400,
      },
      { name: 'усечение', next: BASE.slice(0, 600), from: 600 },
      { name: 'перестановка', next: swapped, from: 10 },
    ]
    for (const { name, next, from } of cases) {
      const { updated, full, estimated } = change(BASE, next, measured)
      expect(updated, name).toEqual(full)
      // Начало списка не пересчитывается: размеры спрашиваются только с места изменения.
      expect(
        estimated.filter(index => index < from),
        name,
      ).toEqual([])
    }
    // Ключ по индексу: рост списка пересчитывает только новые строки.
    const byIndex = Array.from({ length: 1000 }, (_, i) => i)
    const grown = Array.from({ length: 1100 }, (_, i) => i)
    const { updated, full, estimated } = change(byIndex, grown)
    expect(updated).toEqual(full)
    expect(Math.min(...estimated)).toBe(1000)
  })
})
