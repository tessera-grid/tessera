/**
 * Форк TanStack Virtual (ADR 0143, VF1–VF4; ADR 0145, HV1–HV2): импорт только из вендора, вендор равен
 * upstream с патчем, уведомление MIT в пакете, пересчёт позиций от первого изменённого ключа
 * и подсказка места изменения; пересборка мест после замеров и пачка размеров (ADR 0218, AH34–AH36).
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

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  type ItemsChange,
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
  it('XS13: предел выравнивания остаётся в координатах адаптера прокрутки', () => {
    const { v, options } = setup(BASE)
    v.scrollElement = { scrollHeight: 2000, clientHeight: 500 } as Element
    v.setOptions({ ...options, getElementMaxScrollOffset: () => 12_000 })
    expect(v.getOffsetForAlignment(10_000, 'start')).toBe(10_000)
    expect(v.getOffsetForAlignment(20_000, 'start')).toBe(12_000)

    v.setOptions({ ...options, getElementMaxScrollOffset: () => undefined })
    expect(v.getOffsetForAlignment(10_000, 'start')).toBe(1500)
  })

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

/**
 * Смена ключей с подсказкой `hint` против нового виртуализатора: ключи, которые спросил
 * виртуализатор, и размеры, которые он оценил, — на смене.
 */
const hinted = (
  keys: Key[],
  next: Key[],
  hint: number | ItemsChange | undefined,
  measured: Record<string, number> = {},
) => {
  let current = keys
  let given: number | ItemsChange | undefined
  const asked: number[] = []
  const { v, options, calls } = setup(keys, measured)
  const getItemKey = (index: number) => {
    asked.push(index)
    return current[index]!
  }
  v.setOptions({ ...options, getItemKey, getFirstChangedIndex: () => given })
  v.getTotalSize()
  asked.length = 0
  calls.length = 0
  current = next
  given = hint
  v.setOptions({
    ...options,
    count: next.length,
    getItemKey: index => getItemKey(index),
    getFirstChangedIndex: () => given,
  })
  const updated = layout(v)
  given = undefined
  return {
    updated,
    full: layout(setup(next, measured).v),
    estimated: [...calls],
    asked: [...asked],
  }
}

const INSERTED = [...BASE.slice(0, 400), ...ids(5000, 5), ...BASE.slice(400)]

describe('Подсказка места изменения (ADR 0145)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('HV1: подсказка — пересчёт с неё без сверки ключей, паритет с полным пересчётом и без оценки начала; больше прежней сборки — урезается; undefined — сверка ключей', () => {
    vi.stubEnv('NODE_ENV', 'production')
    const appended = [...BASE, ...ids(1000, 100)]
    for (const [next, hint, from] of [
      [appended, 1000, 1000],
      [INSERTED, 400, 400],
      [appended, 10, 10],
      [appended, 5000, 1000],
    ] as const) {
      const { updated, full, estimated, asked } = hinted(BASE, [...next], hint)
      expect(updated, `${hint}`).toEqual(full)
      expect(Math.min(...estimated), `${hint}`).toBe(from)
      expect(Math.min(...asked), `${hint}`).toBe(from)
    }
    const { updated, full, asked } = hinted(BASE, appended, undefined)
    expect(updated).toEqual(full)
    expect(asked.filter(index => index < 1000)).toHaveLength(1000)
  })

  it('HV2: в dev подсказка дальше изменённого ключа — позиции по сверке и одно предупреждение на виртуализатор; верная — без предупреждения; в prod сверки нет', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const right = hinted(BASE, INSERTED, 400)
    expect(right.updated).toEqual(right.full)
    expect(warn).not.toHaveBeenCalled()

    let current = BASE
    let given: number | undefined
    const { v, options } = setup(BASE)
    v.setOptions({
      ...options,
      getItemKey: index => current[index]!,
      getFirstChangedIndex: () => given,
    })
    v.getTotalSize()
    for (const next of [INSERTED, BASE]) {
      current = next
      given = 900
      v.setOptions({
        ...options,
        count: next.length,
        getItemKey: index => current[index]!,
        getFirstChangedIndex: () => given,
      })
      expect(layout(v)).toEqual(layout(setup(next).v))
    }
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]![0]).toContain('keys differ from index 400')

    vi.stubEnv('NODE_ENV', 'production')
    const wrong = hinted(BASE, INSERTED, 900)
    expect(Math.min(...wrong.asked)).toBe(900)
    expect(wrong.updated).not.toEqual(wrong.full)
  })
})

/** Отрезки прежних ключей в прежнем порядке после `from` — тройки «новое начало, прежнее, длина». */
const runsOf = (keys: Key[], next: Key[], from: number) => {
  const at = new Map(keys.map((key, index) => [key, index]))
  const runs: number[] = []
  for (let i = from; i < next.length; i++) {
    const old = at.get(next[i]!)
    if (old === undefined || old < from) continue
    const last = runs.length - 3
    if (
      last >= 0 &&
      runs[last]! + runs[last + 2]! === i &&
      runs[last + 1]! + runs[last + 2]! === old
    ) {
      runs[last + 2]!++
    } else runs.push(i, old, 1)
  }
  return runs
}
const without = (keys: Key[], drop: number[]) =>
  keys.filter((_, index) => !drop.includes(index))
const MOVED = (() => {
  const next = BASE.slice()
  const [key] = next.splice(10, 1)
  next.splice(600, 0, key!)
  return next
})()
/** Индексы вне отрезков от `from`. */
const outside = (runs: number[], from: number, count: number) =>
  Array.from({ length: count - from }, (_, k) => from + k).filter(index => {
    for (let r = 0; r < runs.length; r += 3) {
      if (index >= runs[r]! && index < runs[r]! + runs[r + 2]!) return false
    }
    return true
  })

describe('Пересчёт позиций сдвигом (ADR 0210)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('VS1: подсказка с отрезками — позиции совпадают с полным пересчётом: разбросанные удаления, вставка, перенос, измеренные размеры; ключ и оценку размера строк отрезков виртуализатор не спрашивает', () => {
    vi.stubEnv('NODE_ENV', 'production')
    const measured = { r150: 55, r650: 70, r999: 12 }
    for (const [label, next, from] of [
      ['удаления', without(BASE, [100, 300, 301, 700]), 100],
      ['вставка', INSERTED, 400],
      ['перенос', MOVED, 10],
    ] as const) {
      const kept = runsOf(BASE, [...next], from)
      const { updated, full, estimated, asked } = hinted(
        BASE,
        [...next],
        { from, kept },
        measured,
      )
      expect(updated, label).toEqual(full)
      const fresh = outside(kept, from, next.length)
      expect(asked, label).toEqual(fresh)
      expect(
        estimated.filter(index => !fresh.includes(index)),
        label,
      ).toEqual([])
    }
  })

  it('VS2: отрезок за пределами сборки отбрасывает подсказку; в dev неверный отрезок — позиции по пересчёту с from и одно предупреждение на виртуализатор', () => {
    vi.stubEnv('NODE_ENV', 'production')
    const removed = without(BASE, [100])
    for (const kept of [
      [100, 101, 900],
      [100, 101, 899, 999, 0, 1],
    ]) {
      const { updated, full, asked } = hinted(BASE, removed, {
        from: 100,
        kept,
      })
      expect(updated, String(kept)).toEqual(full)
      expect(asked, String(kept)).toEqual(outside([], 100, removed.length))
    }
    vi.unstubAllEnvs()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    let current: Key[] = BASE
    let given: ItemsChange | undefined
    const { v, options } = setup(BASE)
    const getItemKey = (index: number) => current[index]!
    v.setOptions({ ...options, getItemKey, getFirstChangedIndex: () => given })
    v.getTotalSize()
    // Отрезок указывает на прежние строки со сдвигом на одну: ключи не совпадают.
    for (const next of [removed, BASE]) {
      current = next
      given = { from: 100, kept: [100, 102, 100] }
      v.setOptions({
        ...options,
        count: next.length,
        getItemKey,
        getFirstChangedIndex: () => given,
      })
      expect(layout(v)).toEqual(layout(setup(next).v))
    }
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]![0]).toContain('kept index 100 from 102')
  })
})

describe('Пересборка мест после замера размеров (ADR 0218)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  /** Виртуализатор над `BASE`, который считает обращения к ключам и оценкам. */
  const counted = () => {
    const asked: number[] = []
    const { v, options, calls } = setup(BASE)
    v.setOptions({
      ...options,
      getItemKey: index => {
        asked.push(index)
        return BASE[index]!
      },
    })
    layout(v)
    asked.length = 0
    calls.length = 0
    return { v, options, asked, calls }
  }
  const SIZES = [
    [5, 70],
    [400, 12],
    [999, 90],
    [5, 45],
  ] as const
  /** Места по последним размерам — нарастающим итогом, без виртуализатора. */
  const expected = (sizes: readonly (readonly [number, number])[]) => {
    const size = new Map(sizes)
    let start = 0
    return BASE.map((key, index) => {
      const item = [key, start, size.get(index) ?? SIZE]
      start += size.get(index) ?? SIZE
      return item
    })
  }

  it('AH34: размеры от resizeItem пересобирают места без ключей и оценок прочих строк — позиции совпадают с полной пересборкой, в том числе при чтении мест между замерами', () => {
    vi.stubEnv('NODE_ENV', 'production')
    const { v, asked, calls } = counted()
    for (const [index, size] of SIZES) {
      v.resizeItem(index, size)
      // Чтение мест между замерами — как перерисовка по уведомлению.
      layout(v)
    }
    expect(layout(v)).toEqual(expected(SIZES))
    expect(new Set(asked)).toEqual(new Set(SIZES.map(([index]) => index)))
    expect(calls).toEqual([])
  })

  it('AH35: resizeItems — одно уведомление на пачку и те же места, что у поштучных resizeItem', () => {
    vi.stubEnv('NODE_ENV', 'production')
    const { v } = counted()
    const onChange = vi.fn()
    v.setOptions({ ...v.options, onChange })
    layout(v)
    v.resizeItems(SIZES)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(layout(v)).toEqual(expected(SIZES))
  })

  it('AH36: опция shouldAdjustScrollPositionOnItemSizeChange решает поправку прокрутки за изменённый размер, как поле экземпляра; без неё — правило виртуализатора', () => {
    for (const [label, predicate, shift] of [
      ['нет', () => false, 0],
      ['да', () => true, 40],
      ['без опции', undefined, 40],
    ] as const) {
      const { v, options } = setup(BASE)
      v.setOptions({
        ...options,
        initialOffset: () => 3000,
        shouldAdjustScrollPositionOnItemSizeChange: predicate,
      })
      layout(v)
      // Строка 10 целиком выше экрана, замер первый.
      v.resizeItem(10, SIZE + 40)
      expect((v.scrollOffset ?? 0) - 3000, label).toBe(shift)
    }
  })
})
