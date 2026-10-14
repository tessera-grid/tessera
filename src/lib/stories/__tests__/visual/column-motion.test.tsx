import { useEffect, useState } from 'react'
import { commands, page, server, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest'

import { DEFAULT_LABELS } from '../../../core/localization'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  columnDragging,
  columnPinning,
  columnSizing,
  keyboardNavigation,
} from '../../../plugins'
import { humanClick, revealedHandleWidth } from '../helpers'
import { measureWork } from '../work.helpers'

// Движение колонок (ADR 0115, CN1–CN11). Позиции ячеек шапки, тела и футера снимаются
// каждый кадр, пока меняется порядок колонок: видно и переезд, и его конец.

type Point = { x: number; y: number }
const pointer = commands as unknown as {
  realDragHold: (from: Point, to: Point, steps?: number) => Promise<void>
  realMouseUp: () => Promise<void>
  reducedMotion: (reduce: boolean) => Promise<void>
}

const WIDTH = 150
/** Движение по умолчанию (250 мс) с запасом на кадры, мс. */
const SETTLE_MS = 600

interface MotionTable {
  setColumnOrder: (order: string[]) => void
  setColumnVisibility: (visibility: Record<string, boolean>) => void
  setColumnPinning: (pinning: { start?: string[]; end?: string[] }) => void
  setColumnSizing: (sizing: Record<string, number>) => void
}

interface HostOptions {
  count?: number
  nested?: boolean
  animate?: boolean
  onColumnDragEnd?: () => void | Promise<void>
}

const leafIds = (count: number) =>
  Array.from({ length: count }, (_, i) => `c${i}`)

const leaf = (id: string) => ({
  id,
  accessorKey: id,
  header: id.toUpperCase(),
  footer: `Σ ${id}`,
  size: WIDTH,
  enableDragging: true,
})

const columnsOf = (ids: string[], nested: boolean) =>
  nested
    ? [
        {
          id: 'g0',
          header: 'Group 0',
          enableDragging: true,
          columns: ids.slice(0, 2).map(leaf),
        },
        {
          id: 'g1',
          header: 'Group 1',
          enableDragging: true,
          columns: ids.slice(2, 4).map(leaf),
        },
        ...ids.slice(4).map(leaf),
      ]
    : ids.map(leaf)

let table: MotionTable
let setIds: (ids: string[]) => void

const Host = ({
  count = 8,
  nested = false,
  animate,
  onColumnDragEnd,
}: HostOptions) => {
  const [ids, set] = useState(() => leafIds(count))
  const [columns, setColumns] = useState(() => columnsOf(ids, nested))
  useEffect(() => {
    setIds = next => {
      set(next)
      setColumns(columnsOf(next, nested))
    }
  }, [nested])
  const [data] = useState(() =>
    Array.from({ length: 30 }, (_, row) =>
      Object.fromEntries([
        ['id', `r${row}`],
        ...leafIds(count).map(id => [id, `${id}-${row}`]),
      ]),
    ),
  )
  const created = useCreateTable({
    columns: columns as never,
    data,
    getRowId: (row: { id: string }) => row.id,
    enableFooter: true,
    enableColumnAnimation: animate,
    plugins: [
      columnDragging({ onColumnDragEnd }),
      columnPinning(),
      columnSizing(),
      keyboardNavigation(),
    ],
  } as never)
  table = created as unknown as MotionTable
  return (
    <div style={{ width: 1200, height: 520 }}>
      <DataGrid table={created} height={500} />
    </div>
  )
}

const mount = async (options: HostOptions = {}) => {
  const screen = await render(<Host {...options} />)
  await expect.poll(() => headOf('c2')).toBeTruthy()
  return screen
}

const viewport = { width: innerWidth, height: innerHeight }
beforeAll(() => page.viewport(1400, 900))
afterAll(() => page.viewport(viewport.width, viewport.height))

const gridRoot = () =>
  document.querySelector<HTMLElement>('[role="table"], [role="grid"]')!
const cellOf = (kind: 'head' | 'body' | 'footer', id: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__${kind}-cell[data-column-id="${id}"]`,
  )
const headOf = (id: string) => cellOf('head', id)
/** Левый край элемента относительно корня таблицы, px. */
const leftOf = (element: Element | null) =>
  element
    ? element.getBoundingClientRect().left -
      gridRoot().getBoundingClientRect().left
    : NaN
/** Левые края ячеек колонки в шапке, теле и футере. */
const columnLefts = (id: string) =>
  (['head', 'body', 'footer'] as const).map(kind => leftOf(cellOf(kind, id)))
const ghostCells = () => [
  ...document.querySelectorAll<HTMLElement>('[data-column-ghosts] > *'),
]

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve))

/** Значения `read` в каждом кадре, пока идёт `act` и `ms` после него. */
const sampleFrames = async <T,>(
  read: () => T,
  act: () => Promise<unknown> | unknown,
  ms = SETTLE_MS,
) => {
  const frames: T[] = []
  let sampling = true
  const sample = () => {
    if (!sampling) return
    frames.push(read())
    requestAnimationFrame(sample)
  }
  requestAnimationFrame(sample)
  await act()
  await sleep(ms)
  sampling = false
  return frames
}

/** Позиция пройдена плавно: есть кадры строго между стартом и концом. */
const passesBetween = (lefts: number[], from: number, to: number) =>
  lefts.filter(
    left => left > Math.min(from, to) + 1 && left < Math.max(from, to) - 1,
  ).length > 2

/** Ни одного кадра между стартом и концом: колонка встала сразу. */
const jumps = (lefts: number[], from: number, to: number) =>
  lefts.every(left => Math.abs(left - from) < 1 || Math.abs(left - to) < 1)

let slowStyle: HTMLStyleElement | undefined
const slowMotion = (ms: number) => {
  slowStyle = document.createElement('style')
  slowStyle.textContent = `.data-grid-theme { --tsr-comp-row-motion-duration: ${ms}ms; }`
  document.head.append(slowStyle)
}
afterEach(() => {
  slowStyle?.remove()
  slowStyle = undefined
})

const moveRightByKeyboard = async (id: string) => {
  headOf(id)!.focus()
  await userEvent.keyboard('{Alt>}{Shift>}{ArrowRight}{/Shift}{/Alt}')
}

const reveal = async (id: string) => {
  await userEvent.hover(headOf(id)!)
  const handle = () =>
    headOf(id)!.querySelector<HTMLElement>('.drag__handler--column')!
  await expect
    .poll(() => handle().parentElement!.getBoundingClientRect().width)
    .toBe(revealedHandleWidth(handle()))
  return handle()
}

const moveRightByMenu = async (id: string) => {
  await userEvent.click(await reveal(id))
  await expect.poll(() => document.querySelector('[role="menu"]')).toBeTruthy()
  const item = [
    ...document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
  ].find(entry => entry.textContent?.trim() === DEFAULT_LABELS.moveRight)!
  await userEvent.click(item)
}

/** Колонка `id` переезжает на одну вправо действием `act`: шапка, тело и футер — плавно. */
const expectGlideRight = async (
  id: string,
  act: () => Promise<unknown> | unknown,
  label: string,
) => {
  const from = columnLefts(id)
  const frames = await sampleFrames(() => columnLefts(id), act)
  const to = columnLefts(id)
  ;(['head', 'body', 'footer'] as const).forEach((kind, i) => {
    expect(to[i] - from[i], `${label}: ${kind} на месте`).toBeCloseTo(WIDTH, 0)
    expect(
      passesBetween(
        frames.map(frame => frame[i]),
        from[i],
        to[i],
      ),
      `${label}: ${kind} едет`,
    ).toBe(true)
  })
}

describe('Движение колонок (ADR 0115)', () => {
  test('CN1: смена порядка колонок — клавиатурой, из меню ручки, setColumnOrder и новыми columns с теми же id — ячейки шапки, тела и футера переезжают плавно', async () => {
    const screen = await mount()
    try {
      await expectGlideRight(
        'c1',
        () => moveRightByKeyboard('c1'),
        'клавиатура',
      )
      await expectGlideRight('c3', () => moveRightByMenu('c3'), 'меню')
      await expectGlideRight(
        'c5',
        () =>
          table.setColumnOrder([
            'c0',
            'c2',
            'c1',
            'c4',
            'c3',
            'c6',
            'c5',
            'c7',
          ]),
        'setColumnOrder',
      )
      table.setColumnOrder([])
      await sleep(SETTLE_MS)
      await expectGlideRight(
        'c0',
        () => setIds(['c1', 'c0', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7']),
        'columns',
      )
    } finally {
      await screen.unmount()
    }
  })

  test('CN2: бросок мышью — после броска ни одна колонка не переезжает повторно', async () => {
    const screen = await mount()
    try {
      const handle = await reveal('c1')
      const r = handle.getBoundingClientRect()
      const from = { x: r.left + r.width / 2, y: r.top + r.height / 2 }
      const target = headOf('c2')!.getBoundingClientRect()
      await pointer.realDragHold(from, {
        x: target.left + target.width * 0.6,
        y: from.y,
      })
      const read = () => [...columnLefts('c1'), ...columnLefts('c2')]
      const frames = await sampleFrames(read, () => pointer.realMouseUp())
      const final = read()
      expect(final[0] - leftOf(headOf('c0'))).toBeCloseTo(2 * WIDTH, 0)
      for (const frame of frames.slice(1)) {
        frame.forEach((left, i) =>
          expect(
            Math.abs(left - final[i]),
            `кадр ${frames.indexOf(frame)}`,
          ).toBeLessThan(1),
        )
      }
    } finally {
      await screen.unmount()
    }
  })

  test('CN3: откат после отказа сервера — колонка едет назад, подсветка danger едет вместе с ней', async () => {
    let reject: (reason: unknown) => void = () => {}
    const screen = await mount({
      onColumnDragEnd: () =>
        new Promise<void>((_, fail) => {
          reject = fail
        }),
    })
    try {
      const home = columnLefts('c1')
      await moveRightByKeyboard('c1')
      await expect
        .poll(() => columnLefts('c1')[0] - home[0])
        .toBeCloseTo(WIDTH, 0)
      await sleep(SETTLE_MS)
      const moved = columnLefts('c1')
      const frames = await sampleFrames(
        () => ({
          lefts: columnLefts('c1'),
          tone: headOf('c1')!.getAttribute('data-column-highlight'),
        }),
        () => reject(new Error('no')),
      )
      ;(['head', 'body', 'footer'] as const).forEach((kind, i) =>
        expect(
          passesBetween(
            frames.map(frame => frame.lefts[i]),
            moved[i],
            home[i],
          ),
          kind,
        ).toBe(true),
      )
      const gliding = frames.filter(
        frame => frame.lefts[0] > home[0] + 1 && frame.lefts[0] < moved[0] - 1,
      )
      expect(gliding.every(frame => frame.tone === 'danger')).toBe(true)
      expect(columnLefts('c1')[0]).toBeCloseTo(home[0], 0)
    } finally {
      await screen.unmount()
    }
  })

  test('CN4: под вложенной шапкой группа едет блоком — у ячейки группы и её листьев один сдвиг', async () => {
    const screen = await mount({ nested: true })
    try {
      const read = () => ['g0', 'c0', 'c1'].map(id => leftOf(headOf(id)))
      const before = read()
      const frames = await sampleFrames(read, () =>
        table.setColumnOrder(['c2', 'c3', 'c0', 'c1', 'c4', 'c5', 'c6', 'c7']),
      )
      const after = read()
      expect(after[0] - before[0]).toBeCloseTo(2 * WIDTH, 0)
      const offsets = frames.map(frame =>
        frame.map((left, i) => left - after[i]),
      )
      expect(
        passesBetween(
          frames.map(frame => frame[0]),
          before[0],
          after[0],
        ),
      ).toBe(true)
      for (const [group, ...leaves] of offsets) {
        for (const offset of leaves)
          expect(Math.abs(offset - group)).toBeLessThan(1)
      }
    } finally {
      await screen.unmount()
    }
  })

  test('CN5: при горизонтальной виртуализации колонка издалека въезжает от края окна, уходящая далеко — уезжает к краю призраком вне доступности и ввода', async () => {
    const screen = await mount({ count: 60 })
    try {
      const ids = leafIds(60)
      // Издалека: c40 встаёт второй.
      const near = ['c0', 'c40', ...ids.slice(1).filter(id => id !== 'c40')]
      const lefts = await sampleFrames(
        () => leftOf(headOf('c40')),
        () => table.setColumnOrder(near),
      )
      const seen = lefts.filter(left => !Number.isNaN(left))
      const edge = Math.max(
        ...[
          ...document.querySelectorAll('.data-grid__head-cell[data-column-id]'),
        ].map(cell => leftOf(cell) + cell.getBoundingClientRect().width),
      )
      const final = leftOf(headOf('c40'))
      expect(final).toBeCloseTo(WIDTH, 0)
      expect(seen[0], 'старт не дальше края окна').toBeLessThanOrEqual(edge + 1)
      expect(passesBetween(seen, seen[0], final)).toBe(true)
      seen
        .slice(1)
        .forEach((left, i) => expect(left).toBeLessThanOrEqual(seen[i] + 1))
      await sleep(SETTLE_MS)

      // Вдаль: c0 уходит в конец — призрак на прежнем месте едет вправо и уходит.
      const far = [...near.filter(id => id !== 'c0'), 'c0']
      const from = leftOf(headOf('c0'))
      const ghosts = await sampleFrames(
        () => {
          const layer = document.querySelector('[data-column-ghosts]')
          const cells = ghostCells()
          return {
            count: cells.length,
            left: cells.length ? leftOf(cells[0]) : NaN,
            hidden:
              layer?.hasAttribute('inert') &&
              layer.getAttribute('aria-hidden') === 'true',
            marked: cells.some(
              cell =>
                cell.querySelector('[role], [data-column-id], [tabindex]') ||
                cell.hasAttribute('role') ||
                cell.hasAttribute('data-column-id'),
            ),
          }
        },
        () => table.setColumnOrder(far),
      )
      const shown = ghosts.filter(frame => frame.count > 0)
      expect(shown.length, 'призрак есть').toBeGreaterThan(2)
      expect(headOf('c0'), 'колонка ушла из окна').toBeNull()
      expect(shown.every(frame => frame.hidden && !frame.marked)).toBe(true)
      expect(shown[0].left).toBeCloseTo(from, 0)
      expect(shown.at(-1)!.left).toBeGreaterThan(from + WIDTH)
      expect(ghostCells(), 'призраки ушли').toHaveLength(0)
    } finally {
      await screen.unmount()
    }
  })

  test('CN6: показ и скрытие, закрепление и открепление, смена ширины — без движения; закреплённые колонки не ездят', async () => {
    const screen = await mount()
    try {
      const check = async (label: string, act: () => void) => {
        const from = leftOf(headOf('c5'))
        const frames = await sampleFrames(() => leftOf(headOf('c5')), act)
        const to = leftOf(headOf('c5'))
        expect(
          Math.abs(to - from),
          `${label}: колонка сдвинулась`,
        ).toBeGreaterThan(1)
        expect(jumps(frames, from, to), label).toBe(true)
      }
      await check('скрытие', () => table.setColumnVisibility({ c1: false }))
      await check('показ', () => table.setColumnVisibility({}))
      await check('ширина', () => table.setColumnSizing({ c1: 300 }))
      await check('закрепление', () =>
        table.setColumnPinning({ start: ['c6'] }),
      )
      await check('открепление', () => table.setColumnPinning({}))

      table.setColumnPinning({ start: ['c3'] })
      await sleep(SETTLE_MS)
      const pinned = leftOf(headOf('c3'))
      const frames = await sampleFrames(
        () => leftOf(headOf('c3')),
        () =>
          table.setColumnOrder([
            'c0',
            'c2',
            'c1',
            'c3',
            'c5',
            'c4',
            'c6',
            'c7',
          ]),
      )
      expect(frames.every(left => Math.abs(left - pinned) < 1)).toBe(true)
    } finally {
      await screen.unmount()
    }
  })

  test('CN7: новая смена порядка посреди движения стартует с текущего положения; прокрутка доводит движение до конца за кадр', async () => {
    slowMotion(1200)
    const screen = await mount({ count: 40 })
    try {
      const frames = await sampleFrames(
        () => leftOf(headOf('c1')),
        async () => {
          await moveRightByKeyboard('c1')
          await sleep(400)
          headOf('c1')!.focus()
          await userEvent.keyboard('{Alt>}{Shift>}{ArrowLeft}{/Shift}{/Alt}')
        },
        1600,
      )
      const steps = frames.slice(1).map((left, i) => Math.abs(left - frames[i]))
      expect(Math.max(...frames) - frames[0], 'колонка ехала').toBeGreaterThan(
        10,
      )
      expect(Math.max(...steps), 'без скачка').toBeLessThan(WIDTH / 3)

      await moveRightByKeyboard('c1')
      await sleep(200)
      const scroller = document.querySelector<HTMLElement>(
        '.data-grid__container',
      )!
      scroller.scrollLeft += 20
      await nextFrame()
      await nextFrame()
      const stopped = leftOf(headOf('c1'))
      await sleep(100)
      expect(leftOf(headOf('c1'))).toBeCloseTo(stopped, 0)
      expect(stopped - leftOf(headOf('c0'))).toBeCloseTo(2 * WIDTH, 0)
    } finally {
      await screen.unmount()
    }
  })

  test('CN8: prefers-reduced-motion и enableColumnAnimation: false — колонки сразу на местах', async () => {
    const instant = async (label: string) => {
      const from = leftOf(headOf('c1'))
      const frames = await sampleFrames(
        () => leftOf(headOf('c1')),
        () => moveRightByKeyboard('c1'),
      )
      const to = leftOf(headOf('c1'))
      expect(to - from, label).toBeCloseTo(WIDTH, 0)
      expect(jumps(frames, from, to), label).toBe(true)
    }
    await pointer.reducedMotion(true)
    try {
      const screen = await mount()
      await instant('уменьшенное движение')
      await screen.unmount()
    } finally {
      await pointer.reducedMotion(false)
    }
    const screen = await mount({ animate: false })
    try {
      await instant('флаг')
    } finally {
      await screen.unmount()
    }
  })

  test('CN9: длительность — токен --tsr-comp-row-motion-duration, кривая — --tsr-comp-motion-easing', async () => {
    const screen = await mount()
    try {
      const timingOf = async (id: string) => {
        await moveRightByKeyboard(id)
        const moving = () =>
          headOf(id)!
            .getAnimations()
            .find(animation =>
              (animation.effect as KeyframeEffect)
                .getKeyframes()
                .some(frame => 'translate' in frame),
            )
        await expect.poll(moving).toBeTruthy()
        const timing = moving()!.effect!.getComputedTiming()
        await sleep(SETTLE_MS)
        return timing
      }
      const easing = getComputedStyle(gridRoot())
        .getPropertyValue('--tsr-comp-motion-easing')
        .trim()
      const standard = await timingOf('c1')
      expect(standard.duration).toBe(250)
      expect((standard.easing ?? '').replace(/\s/g, '')).toBe(
        easing.replace(/\s/g, ''),
      )
      slowMotion(700)
      expect((await timingOf('c3')).duration).toBe(700)
    } finally {
      await screen.unmount()
    }
  })

  test('CN10: движение не меняет фокус — активная ячейка после смены порядка там же, где без движения, и в каждом кадре', async () => {
    const focusTrail = async (animate: boolean) => {
      const screen = await mount({ animate })
      await humanClick(cellOf('body', 'c2')!)
      await expect
        .poll(() => (document.activeElement as HTMLElement).dataset.columnId)
        .toBe('c2')
      const where = () => {
        const cell = (
          document.activeElement as HTMLElement
        ).closest<HTMLElement>('[data-column-id]')
        return `${cell?.closest('[data-row-id]')?.getAttribute('data-row-id')}:${cell?.dataset.columnId}`
      }
      const frames = await sampleFrames(where, () =>
        table.setColumnOrder(['c0', 'c1', 'c3', 'c2', 'c4', 'c5', 'c6', 'c7']),
      )
      const after = where()
      await screen.unmount()
      return { frames, after }
    }
    const instant = await focusTrail(false)
    const moving = await focusTrail(true)
    expect(moving.after).toBe(instant.after)
    expect(moving.frames.every(frame => frame === moving.after)).toBe(true)
  })

  test('CN11: движение не перерисовывает грид покадрово — коммитов React столько же при длительности 250 мс и 3 с', async ({
    skip,
  }) => {
    skip(
      server.browser !== 'chromium',
      'счётчики работы — трейс CDP, только Chromium',
    )
    const screen = await mount()
    try {
      const commitsOf = async () => {
        const work = await measureWork(
          gridRoot(),
          () => moveRightByKeyboard('c1'),
          {
            quietFrames: 10,
          },
        )
        await sleep(SETTLE_MS)
        table.setColumnOrder([])
        await sleep(SETTLE_MS)
        return work.commits
      }
      const standard = await commitsOf()
      slowMotion(3000)
      const slow = await commitsOf()
      expect(standard).toBeGreaterThan(0)
      expect(slow).toBe(standard)
    } finally {
      await screen.unmount()
    }
  })
})
