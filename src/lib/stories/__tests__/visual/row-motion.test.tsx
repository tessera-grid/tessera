import * as React from 'react'
import { useEffect, useMemo } from 'react'

import axe from 'axe-core'
import { commands, server, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test } from 'vitest'

import { DEFAULT_LABELS } from '../../../core/localization'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { columns } from '../../__mocks__/columns'
import { getData } from '../../__mocks__/data'
import {
  argsToPlugins,
  type FeatureToggles,
} from '../../__mocks__/utils/argsToPlugins'
import { composed } from '../stories'
import { Stories, humanClick, settleRowMotion } from '../helpers'
import { measureWork } from '../work.helpers'
import { AXE_OPTIONS } from './a11y-helpers'

// Движение строк (ADR 0107, RM1–RM17, RM19, RM22). Позиции, прозрачность и призраки
// снимаются каждый кадр, пока идёт смена модели: видно и переезд, и его конец.

const BODY = '.data-grid__body'
const BODY_ROW = '.data-grid__body-row'
const GHOST = '[data-row-ghost]'
const TOGGLE = '.row-expand-button'
const HANDLE = '.drag__handler--column'
const SCROLLER = '.data-grid__container'
/** Движение по умолчанию (250 мс) с запасом на кадры, мс. */
const SETTLE_MS = 600

type ExpandingArgs = Partial<Parameters<typeof composed.RowExpanding>[0]>
type Pointer = {
  realDragHold: (from: object, to: object) => Promise<void>
  realMouseUp: () => Promise<void>
  realWheel: (
    at: object,
    deltaY: number,
    ticks: number,
    intervalMs: number,
  ) => Promise<void>
  reducedMotion: (reduce: boolean) => Promise<void>
}
const pointer = commands as unknown as Pointer

const bodyOf = () => document.querySelector<HTMLElement>(BODY)!
const rowById = (id: string) =>
  document.querySelector<HTMLElement>(`${BODY_ROW}[data-row-id="${id}"]`)
const rowsTopDown = () =>
  [...document.querySelectorAll<HTMLElement>(BODY_ROW)].sort(
    (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top,
  )
/** Корень грида в любой роли: table, grid или treegrid. */
const gridRoot = () =>
  document.querySelector<HTMLElement>(
    '[role="table"], [role="grid"], [role="treegrid"]',
  )
const ghosts = () => [...document.querySelectorAll<HTMLElement>(GHOST)]
/** Верх элемента относительно тела, px. */
const topOf = (element: Element) =>
  element.getBoundingClientRect().top - bodyOf().getBoundingClientRect().top
const opacityOf = (element: Element) =>
  Number(getComputedStyle(element).opacity)
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

/** В кадре всё стоит: строки без сдвига и полупрозрачности, призраков нет. */
const still = () =>
  ghosts().length === 0 &&
  [...document.querySelectorAll<HTMLElement>(BODY_ROW)].every(row => {
    const { translate, opacity } = getComputedStyle(row)
    return (translate === 'none' || translate === '0px') && opacity === '1'
  })

/** Позиция пройдена плавно: есть кадры строго между стартом и концом. */
const passesBetween = (tops: number[], from: number, to: number) =>
  tops.filter(
    top => top > Math.min(from, to) + 1 && top < Math.max(from, to) - 1,
  ).length > 2

/** Длительность движения строк в тесте, мс: окно, чтобы вмешаться посреди переезда. */
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

const renderExpanding = async (args: ExpandingArgs = {}) => {
  const screen = await render(<composed.RowExpanding {...args} />)
  await expect.poll(() => rowsTopDown().length).toBeGreaterThan(3)
  return screen
}

/** Первая раскрываемая строка и строка сразу под ней. */
const parentAndBelow = () => {
  const rows = rowsTopDown()
  const parent = rows.find(row => row.querySelector(TOGGLE))!
  return {
    parent,
    parentId: parent.dataset.rowId!,
    belowId: rows[rows.indexOf(parent) + 1].dataset.rowId!,
    toggle: () =>
      rowById(parent.dataset.rowId!)!.querySelector<HTMLElement>(TOGGLE)!,
  }
}

// --- Хост с доступом к таблице: сортировка, страницы, данные, scrollToRow --------

type MotionTable = {
  setSorting: (sorting: { id: string; desc: boolean }[]) => void
  setPageIndex: (index: number) => void
  scrollToRow: (id: string) => Promise<boolean>
}

/** 40 строк с перестановкой `age = 7i mod 40`: сортировка по возрасту — известный порядок. */
const AGE_DATA = getData(40).map((row: object, i: number) => ({
  ...row,
  age: (i * 7) % 40,
}))

interface HostProps {
  toggles?: FeatureToggles
  data?: unknown[]
  width?: number
  rowHeight?: number
  onTable: (table: MotionTable) => void
}

const Host = ({
  toggles = {},
  data = AGE_DATA,
  width = 900,
  rowHeight,
  onTable,
}: HostProps) => {
  const plugins = useMemo(() => argsToPlugins(toggles), [toggles])
  const table = useCreateTable({
    columns: columns as never,
    data: data as never,
    getRowId: (row: { id: string }) => row.id,
    plugins: plugins as never,
    rowHeight,
  })
  useEffect(() => {
    onTable(table as unknown as MotionTable)
  })
  return (
    <div style={{ width, height: 440 }}>
      <DataGrid table={table} height={420} />
    </div>
  )
}

const mountHost = async (props: Omit<HostProps, 'onTable'> = {}) => {
  const box: { table?: MotionTable } = {}
  const screen = await render(
    <Host {...props} onTable={table => (box.table = table)} />,
  )
  await expect.poll(() => rowsTopDown().length).toBeGreaterThan(3)
  return { table: () => box.table!, screen }
}

const SORTING: FeatureToggles = { enableColumnSorting: true }
const byAge = [{ id: 'age', desc: false }]
const id = (i: number) => `item-id-${i}`

/** Сдвиг строки от dnd-kit во встроенном стиле, px; нет — \`null\`. */
const targetOf = (row: HTMLElement) => {
  const match = /,\s*(-?[\d.]+)px,\s*0px\)$/.exec(row.style.transform)
  return match ? Number(match[1]) : null
}

/** Отставание строки от её сдвига dnd-kit в кадре, px. */
const lagOf = (row: HTMLElement) => {
  const target = targetOf(row)
  const shown = new DOMMatrix(getComputedStyle(row).transform).m42
  return target === null ? 0 : Math.abs(shown - target)
}

/** Кадр перетаскивания: слот и соседи. */
const dragFrame = (scroller: HTMLElement) => {
  const rows = [...document.querySelectorAll<HTMLElement>(BODY_ROW)]
  const slot = rows.find(row => row.dataset.rowDraggable === 'true')
  return {
    top: scroller.scrollTop,
    scrolling: scroller.hasAttribute('data-scrolling'),
    fast: scroller.hasAttribute('data-fast-scrolling'),
    slotOpacity: slot ? opacityOf(slot) : null,
    slotLag: slot ? lagOf(slot) : 0,
    slotTarget: slot ? targetOf(slot) : null,
    neighbourLag: Math.max(0, ...rows.filter(row => row !== slot).map(lagOf)),
    skeletons: document.querySelectorAll(`${BODY_ROW} [class*="skeleton"]`)
      .length,
  }
}

/**
 * Взять первую строку и держать в зоне автопрокрутки у нижнего края: `depth` — доля
 * зоны от её границы (зона — пятая часть высоты), выборка по кадрам.
 */
const dragToEdge = async (depth = 1) => {
  await render(<composed.RowDragging />)
  await expect.poll(() => rowsTopDown().length).toBeGreaterThan(4)
  const [first] = rowsTopDown()
  await userEvent.hover(first)
  const hr = first.querySelector<HTMLElement>(HANDLE)!.getBoundingClientRect()
  const from = { x: hr.left + hr.width / 2, y: hr.top + hr.height / 2 }
  const scroller = document.querySelector<HTMLElement>(SCROLLER)!
  const box = scroller.getBoundingClientRect()
  const zone = box.height / 5
  const edge = {
    x: from.x,
    y: Math.min(box.bottom - 4, box.bottom - zone * (1 - depth)),
  }
  const frames = await sampleFrames(
    () => dragFrame(scroller),
    () => pointer.realDragHold(from, edge),
    SETTLE_MS * 2,
  )
  return { frames, scroller, rowSize: first.getBoundingClientRect().height }
}

describe('Движение строк (ADR 0107)', () => {
  test('RM1: раскрытие — строки ниже съезжают к новым местам, дети проявляются; в конце — места модели', async () => {
    await renderExpanding()
    const { parent, belowId, toggle } = parentAndBelow()
    const before = new Set(rowsTopDown().map(row => row.dataset.rowId))
    const startTop = topOf(rowById(belowId)!)
    const rowSize = parent.getBoundingClientRect().height

    const frames = await sampleFrames(
      () => {
        const children = [...document.querySelectorAll<HTMLElement>(BODY_ROW)]
          .filter(row => !before.has(row.dataset.rowId))
          .map(opacityOf)
        return {
          below: topOf(rowById(belowId)!),
          childOpacity: children.length > 0 ? Math.min(...children) : null,
        }
      },
      () => userEvent.click(toggle()),
    )

    const childCount = rowsTopDown().filter(
      row => !before.has(row.dataset.rowId),
    ).length
    expect(childCount).toBeGreaterThan(0)
    const endTop = topOf(rowById(belowId)!)
    expect(endTop - startTop).toBeCloseTo(childCount * rowSize, 0)
    const tops = frames.map(frame => frame.below)
    expect(passesBetween(tops, startTop, endTop)).toBe(true)
    expect(tops.at(-1)).toBeCloseTo(endTop, 0)
    const opacities = frames
      .map(frame => frame.childOpacity)
      .filter((value): value is number => value !== null)
    expect(opacities.some(value => value < 0.9)).toBe(true)
    expect(opacities.at(-1)).toBe(1)
  })

  test('RM2: сворачивание — дети гаснут призраками на местах, строки ниже поднимаются; призраки уходят', async () => {
    await renderExpanding()
    const { parent, belowId, toggle } = parentAndBelow()
    await userEvent.click(toggle())
    await settleRowMotion()
    const startTop = topOf(rowById(belowId)!)
    const endTop = topOf(parent) + parent.getBoundingClientRect().height

    const frames = await sampleFrames(
      () => ({
        below: topOf(rowById(belowId)!),
        ghosts: ghosts().map(ghost => ({
          top: topOf(ghost),
          opacity: opacityOf(ghost),
        })),
      }),
      () => userEvent.click(toggle()),
    )

    const withGhosts = frames.filter(frame => frame.ghosts.length > 0)
    expect(withGhosts.length).toBeGreaterThan(2)
    // Призраки стоят на местах детей и гаснут.
    const ghostTops = withGhosts[0].ghosts.map(ghost => ghost.top)
    expect(Math.min(...ghostTops)).toBeGreaterThanOrEqual(endTop - 1)
    expect(Math.max(...ghostTops)).toBeLessThan(startTop)
    const opacities = withGhosts.flatMap(frame =>
      frame.ghosts.map(ghost => ghost.opacity),
    )
    expect(opacities.some(value => value > 0.1 && value < 0.9)).toBe(true)
    expect(
      passesBetween(
        frames.map(frame => frame.below),
        startTop,
        endTop,
      ),
    ).toBe(true)
    expect(frames.at(-1)!.ghosts).toEqual([])
    expect(topOf(rowById(belowId)!)).toBeCloseTo(endTop, 0)
  })

  test('RM3: призраки вне доступности и ввода — inert и aria-hidden, без ролей, не в aria-rowcount, указатель мимо; axe без нарушений', async () => {
    await renderExpanding()
    const { toggle } = parentAndBelow()
    await userEvent.click(toggle())
    await settleRowMotion()
    const rowCountExpanded = gridRoot()!.getAttribute('aria-rowcount')
    slowMotion(4000)

    await userEvent.click(toggle())
    await expect.poll(() => ghosts().length).toBeGreaterThan(0)
    const ghost = ghosts()[0]
    expect(ghost.closest('[aria-hidden="true"][inert]')).not.toBeNull()
    expect(ghost.querySelector('[role], [tabindex], [id]')).toBeNull()
    expect(ghost.matches(BODY_ROW)).toBe(false)
    expect(ghost.querySelector('.data-grid__body-cell')).toBeNull()
    // aria-rowcount — строки модели: свернулись — стало меньше, призраки не в счёте.
    const rowCount = gridRoot()!.getAttribute('aria-rowcount')
    expect(Number(rowCount)).toBeLessThan(Number(rowCountExpanded))
    // Указатель проходит сквозь призрака.
    const rect = ghost.getBoundingClientRect()
    const hit = document.elementFromPoint(
      rect.left + 40,
      rect.top + rect.height / 2,
    )
    expect(hit?.closest(GHOST) ?? null).toBeNull()
    const result = await axe.run(gridRoot()!, AXE_OPTIONS)
    expect(result.violations.map(violation => violation.id)).toEqual([])
    expect(ghosts().length).toBeGreaterThan(0)
    slowStyle?.remove()
    await expect.poll(() => ghosts().length, { timeout: 6000 }).toBe(0)
    expect(gridRoot()!.getAttribute('aria-rowcount')).toBe(rowCount)
  })

  test('RM4: сортировка — уцелевшие строки переезжают, строка издалека въезжает от края окна, уходящая вдаль уезжает к краю', async () => {
    // Медленно: в тяжёлом коммите сортировки движок пропускает первые кадры выборки.
    slowMotion(1500)
    const { table } = await mountHost({ toggles: SORTING })
    const windowBottom = Math.max(
      ...rowsTopDown().map(
        row => topOf(row) + row.getBoundingClientRect().height,
      ),
    )
    const rowSize = rowById(id(0))!.getBoundingClientRect().height
    // id(1): возраст 7 — с 1-го места на 7-е; id(23): возраст 1 — с 23-го (далеко за
    // окном) на 1-е; id(2): возраст 14 — с 2-го места далеко вниз.
    expect(rowById(id(23))).toBeNull()
    const startSurvivor = topOf(rowById(id(1))!)
    const startLeaving = topOf(rowById(id(2))!)

    const frames = await sampleFrames(
      () => ({
        survivor: rowById(id(1)) && topOf(rowById(id(1))!),
        far: rowById(id(23)) && topOf(rowById(id(23))!),
        ghostTops: ghosts().map(topOf),
      }),
      () => table().setSorting(byAge),
      1900,
    )

    expect(
      passesBetween(
        frames.map(frame => frame.survivor ?? startSurvivor),
        startSurvivor,
        7 * rowSize,
      ),
    ).toBe(true)
    // Издалека: строка въезжает от нижнего края окна — не появляется из-за него (со
    // старого места, 23-я строка) и начинает путь у края.
    const far = frames
      .map(frame => frame.far)
      .filter((top): top is number => top !== null)
    expect(Math.max(...far)).toBeLessThanOrEqual(windowBottom + 1)
    expect(Math.max(...far)).toBeGreaterThan(windowBottom - 3 * rowSize)
    expect(far.at(-1)).toBeCloseTo(1 * rowSize, 0)
    // Вдаль: призрак едет от старого места вниз к краю окна.
    const leaving = frames
      .map(frame => frame.ghostTops.find(top => top >= startLeaving - 1))
      .filter((top): top is number => top !== undefined)
    expect(leaving.length).toBeGreaterThan(2)
    expect(Math.max(...leaving)).toBeGreaterThan(startLeaving + rowSize)
    expect(frames.at(-1)!.ghostTops).toEqual([])
  })

  test('RM5: поиск — прошедшие строки переезжают, ушедшие гаснут призраками, вернувшиеся проявляются', async () => {
    await render(
      <composed.Filtering
        enableToolbar
        quickSearchDebounceMs={0}
        columnFilteringDebounceMs={0}
      />,
    )
    await expect.poll(() => rowsTopDown().length).toBeGreaterThan(5)
    const input = () =>
      document.querySelector<HTMLInputElement>('[data-testid="quick-search"]')!
    await expect
      .poll(() => document.querySelector('[data-testid="quick-search"]'))
      .toBeTruthy()
    const tops = () =>
      new Map(rowsTopDown().map(row => [row.dataset.rowId!, topOf(row)]))
    const start = tops()
    const rowSize = rowsTopDown()[0].getBoundingClientRect().height

    const leaving = await sampleFrames(
      () => ({ tops: tops(), ghostOpacity: ghosts().map(opacityOf) }),
      () => userEvent.fill(input(), 'alice'),
      SETTLE_MS + 300,
    )
    // Прошедшая поиск строка, поднявшаяся хотя бы на две строки.
    const end = tops()
    expect(end.size).toBeLessThan(start.size)
    const kept = [...end].find(
      ([rowId, top]) => (start.get(rowId) ?? 0) - top >= 2 * rowSize,
    )![0]
    expect(
      passesBetween(
        leaving.map(frame => frame.tops.get(kept) ?? start.get(kept)!),
        start.get(kept)!,
        end.get(kept)!,
      ),
    ).toBe(true)
    const faded = leaving.flatMap(frame => frame.ghostOpacity)
    expect(faded.some(value => value > 0.1 && value < 0.9)).toBe(true)

    const returning = await sampleFrames(
      () =>
        Math.min(
          ...rowsTopDown()
            .filter(row => !end.has(row.dataset.rowId!))
            .map(opacityOf),
          1,
        ),
      () => userEvent.fill(input(), ''),
      SETTLE_MS + 300,
    )
    expect(returning.some(value => value < 0.9)).toBe(true)
    expect(returning.at(-1)).toBe(1)
  })

  test('RM6: замена — смена страницы, первая загрузка, скелет → данные и новый набор — без движения', async () => {
    // Первая загрузка.
    let screen!: Awaited<ReturnType<typeof mountHost>>['screen']
    const box: { table?: MotionTable } = {}
    const firstLoad = await sampleFrames(still, async () => {
      screen = await render(
        <Host
          toggles={{ enablePagination: true, paginationInitialPageSize: 10 }}
          onTable={table => (box.table = table)}
        />,
      )
    })
    expect(firstLoad.every(Boolean)).toBe(true)
    await expect.poll(() => rowsTopDown().length).toBeGreaterThan(3)

    // Страница.
    const page = await sampleFrames(still, () => box.table!.setPageIndex(1))
    expect(rowById(id(10))).not.toBeNull()
    expect(page.every(Boolean)).toBe(true)

    // Новый набор с другими id.
    const fresh = getData(30).map((row: { id: string }) => ({
      ...row,
      id: `fresh-${row.id}`,
    }))
    const newSet = await sampleFrames(still, () =>
      screen.rerender(<Host data={fresh} onTable={() => {}} />),
    )
    expect(rowById('fresh-item-id-0')).not.toBeNull()
    expect(newSet.every(Boolean)).toBe(true)
    await screen.unmount()

    // Скелет → данные.
    const skeleton = await render(<composed.RowExpanding loading="initial" />)
    const loaded = await sampleFrames(still, () =>
      skeleton.rerender(<composed.RowExpanding loading={false} />),
    )
    expect(rowsTopDown().length).toBeGreaterThan(3)
    expect(loaded.every(Boolean)).toBe(true)
  })

  test('RM7: геометрия без смены модели — высота строк, ширина контейнера и прокрутка — без движения', async () => {
    const { screen } = await mountHost()
    const height = await sampleFrames(still, () =>
      screen.rerender(<Host rowHeight={70} onTable={() => {}} />),
    )
    expect(rowById(id(0))!.getBoundingClientRect().height).toBe(70)
    expect(height.every(Boolean)).toBe(true)

    const width = await sampleFrames(still, () =>
      screen.rerender(<Host rowHeight={70} width={600} onTable={() => {}} />),
    )
    expect(width.every(Boolean)).toBe(true)

    const scroller = document.querySelector<HTMLElement>(SCROLLER)!
    const scroll = await sampleFrames(still, () => {
      scroller.scrollTop = 700
    })
    expect(scroller.scrollTop).toBe(700)
    expect(scroll.every(Boolean)).toBe(true)
  })

  test('RM8: приход ленивых детей — строки ниже съезжают, дети проявляются, подсветка прихода видна', async () => {
    let resolve!: (rows: unknown[]) => void
    const roots = [
      { id: 'lazy', firstName: 'lazy', lastName: 'Doe', childCount: 2 },
      { id: 'leaf', firstName: 'leaf', lastName: 'Doe' },
    ]
    await render(
      <composed.RowExpanding
        dataOverride={roots}
        rowExpandingHasChildren={
          ((row: { original: { childCount?: number } }) =>
            (row.original.childCount ?? 0) > 0) as never
        }
        rowExpandingLoadChildren={
          (() => new Promise(done => (resolve = done))) as never
        }
      />,
    )
    await expect.poll(() => rowById('leaf')).not.toBeNull()
    await userEvent.click(rowById('lazy')!.querySelector<HTMLElement>(TOGGLE)!)
    await sleep(100)
    const startTop = topOf(rowById('leaf')!)
    const rowSize = rowById('leaf')!.getBoundingClientRect().height

    const frames = await sampleFrames(
      () => ({
        leaf: topOf(rowById('leaf')!),
        child: rowById('lazy-c0') && opacityOf(rowById('lazy-c0')!),
        arrived: !!document.querySelector(`${BODY_ROW}[data-arrived]`),
      }),
      () =>
        resolve([
          { id: 'lazy-c0', firstName: 'c0', lastName: 'Doe' },
          { id: 'lazy-c1', firstName: 'c1', lastName: 'Doe' },
        ]),
    )

    expect(
      passesBetween(
        frames.map(frame => frame.leaf),
        startTop,
        startTop + 2 * rowSize,
      ),
    ).toBe(true)
    const child = frames
      .map(frame => frame.child)
      .filter((value): value is number => value !== null)
    expect(child.some(value => value < 0.9)).toBe(true)
    expect(child.at(-1)).toBe(1)
    expect(frames.some(frame => frame.arrived)).toBe(true)
  })

  test('RM9: перетаскивание — соседи и слот-заливка сдвигаются переходом, только пока строку тащат', async () => {
    await render(<composed.RowDragging />)
    await expect.poll(() => rowsTopDown().length).toBeGreaterThan(4)
    const [first, second, , fourth] = rowsTopDown()
    const neighbourId = second.dataset.rowId!
    // Вне сессии переходов `transform` у строк нет.
    expect(getComputedStyle(second).transitionProperty).not.toContain(
      'transform',
    )
    const startTop = topOf(second)
    const rowSize = second.getBoundingClientRect().height

    await userEvent.hover(first)
    const handle = first.querySelector<HTMLElement>(HANDLE)!
    const hr = handle.getBoundingClientRect()
    const tr = fourth.getBoundingClientRect()
    const from = { x: hr.left + hr.width / 2, y: hr.top + hr.height / 2 }
    const frames = await sampleFrames(
      () => ({
        neighbour: topOf(rowById(neighbourId)!),
        fill: document.querySelector(`${BODY_ROW}[data-row-draggable="true"]`)
          ? topOf(
              document.querySelector(`${BODY_ROW}[data-row-draggable="true"]`)!,
            )
          : null,
      }),
      () =>
        pointer.realDragHold(from, { x: from.x, y: tr.top + tr.height / 2 }),
    )
    try {
      expect(
        passesBetween(
          frames.map(frame => frame.neighbour),
          startTop,
          startTop - rowSize,
        ),
      ).toBe(true)
      const fill = frames
        .map(frame => frame.fill)
        .filter((top): top is number => top !== null)
      expect(new Set(fill.map(Math.round)).size).toBeGreaterThan(3)
      expect(
        getComputedStyle(rowById(neighbourId)!).transitionProperty,
      ).toContain('transform')
    } finally {
      await pointer.realMouseUp()
    }
    await settleRowMotion()
  })

  test('RM24: умеренная прокрутка во время перетаскивания — слот виден и вместе с соседями сдвигается коротким переходом: без скачков, соседи отстают не больше строки, слот — двух', async () => {
    const { frames, rowSize } = await dragToEdge(0.3)
    try {
      const scrolled = frames.filter(frame => frame.scrolling)
      expect(scrolled.length).toBeGreaterThan(10)
      expect(scrolled.every(frame => frame.slotOpacity === 1)).toBe(true)
      // Кадр смены цели: без перехода слот уже на новом месте, с переходом — в пути.
      const changed = scrolled.filter(
        (frame, i) => i > 0 && frame.slotTarget !== scrolled[i - 1].slotTarget,
      )
      expect(changed.length).toBeGreaterThan(3)
      const lags = changed.map(frame => frame.slotLag).sort((a, b) => a - b)
      expect(lags[lags.length >> 1]).toBeGreaterThan(rowSize * 0.3)
      // Две строки: переход и кадр, в котором dnd-kit уже сменил цель.
      expect(
        Math.max(...scrolled.map(frame => frame.slotLag)),
      ).toBeLessThanOrEqual(rowSize * 2 + 1)
      expect(
        Math.max(...scrolled.map(frame => frame.neighbourLag)),
      ).toBeLessThanOrEqual(rowSize + 1)
    } finally {
      await pointer.realMouseUp()
    }
    await settleRowMotion()
  })

  test('RM25: указатель у самого края во время перетаскивания включает быструю прокрутку — пришедшие строки скелетами, слот скрыт; прокрутка стихла — слот проявляется на своём месте', async () => {
    const { frames, scroller } = await dragToEdge()
    try {
      const fast = frames.filter(frame => frame.fast)
      expect(fast.length).toBeGreaterThan(5)
      expect(frames.some(frame => frame.skeletons > 0)).toBe(true)
      expect(fast.every(frame => frame.slotOpacity === 0)).toBe(true)
      // Прокрутка упёрлась в конец и стихла под неподвижным указателем.
      await expect
        .poll(
          () =>
            scroller.scrollTop + scroller.clientHeight >=
            scroller.scrollHeight - 1,
          { timeout: 10_000 },
        )
        .toBe(true)
      const after = (
        await sampleFrames(
          () => dragFrame(scroller),
          () => undefined,
          SETTLE_MS * 2,
        )
      ).filter(frame => !frame.fast)
      expect(
        after.some(
          ({ slotOpacity }) =>
            slotOpacity !== null && slotOpacity > 0 && slotOpacity < 1,
        ),
      ).toBe(true)
      expect(after.at(-1)!.slotOpacity).toBe(1)
      const shown = after.filter(frame => (frame.slotOpacity ?? 0) > 0)
      expect(Math.max(...shown.map(frame => frame.slotLag))).toBeLessThan(1)
    } finally {
      await pointer.realMouseUp()
    }
    await settleRowMotion()
  })

  test('RM27: умеренная автопрокрутка — указатель у границы зоны: без быстрой прокрутки и скелетов', async () => {
    const drag = await dragToEdge(0.3)
    try {
      expect(drag.scroller.scrollTop).toBeGreaterThan(0)
      expect(drag.frames.some(frame => frame.fast)).toBe(false)
      expect(drag.frames.every(frame => frame.skeletons === 0)).toBe(true)
    } finally {
      await pointer.realMouseUp()
    }
    await settleRowMotion()
  })

  test('RM10: бросок мышью — облако долетает до слота, слот проявляется строкой, повторного переезда нет', async () => {
    await render(<composed.RowDragging />)
    await expect.poll(() => rowsTopDown().length).toBeGreaterThan(4)
    const [first, , , fourth] = rowsTopDown()
    const movedId = first.dataset.rowId!
    await userEvent.hover(first)
    const hr = first.querySelector<HTMLElement>(HANDLE)!.getBoundingClientRect()
    const tr = fourth.getBoundingClientRect()
    const from = { x: hr.left + hr.width / 2, y: hr.top + hr.height / 2 }
    await pointer.realDragHold(from, { x: from.x, y: tr.top + tr.height / 2 })
    await sleep(SETTLE_MS)
    /** Плавающий слой облака dnd-kit: его двигает и гасит анимация броска. */
    const overlay = () => {
      let node = document.querySelector<HTMLElement>('.data-grid-body__row')
      while (node && getComputedStyle(node).position !== 'fixed') {
        node = node.parentElement
      }
      return node
    }

    const frames = await sampleFrames(
      () => ({
        tops: new Map(
          rowsTopDown().map(row => [row.dataset.rowId!, topOf(row)]),
        ),
        moved: rowById(movedId) && opacityOf(rowById(movedId)!),
        overlay: overlay() && {
          top: overlay()!.getBoundingClientRect().top,
          opacity: opacityOf(overlay()!),
        },
        slot: rowById(movedId) && rowById(movedId)!.getBoundingClientRect().top,
      }),
      () => pointer.realMouseUp(),
    )

    const finalTops = new Map(
      rowsTopDown().map(row => [row.dataset.rowId!, topOf(row)]),
    )
    // Ни одна строка после броска не переезжает: в каждом кадре — конечные места.
    for (const frame of frames.slice(1)) {
      for (const [rowId, top] of frame.tops) {
        if (finalTops.has(rowId)) {
          expect(Math.abs(top - finalTops.get(rowId)!), rowId).toBeLessThan(1)
        }
      }
    }
    // Облако летит к слоту и приземляется в нём непогасшим; строка проявляется.
    const flight = frames.filter(frame => frame.overlay !== null)
    expect(
      new Set(flight.map(frame => Math.round(frame.overlay!.top))).size,
    ).toBeGreaterThan(2)
    const landing = flight.at(-1)!
    expect(Math.abs(landing.overlay!.top - landing.slot!)).toBeLessThan(2)
    expect(landing.overlay!.opacity).toBeGreaterThan(0.9)
    const opacities = frames
      .map(frame => frame.moved)
      .filter((value): value is number => value !== null)
    expect(opacities.some(value => value < 0.9)).toBe(true)
    expect(opacities.at(-1)).toBe(1)
  })

  test('RM11: перестановка с клавиатуры и из меню ручки переезжает, как бросок', async () => {
    await render(<composed.RowDragging enableKeyboardNavigation />)
    await expect.poll(() => rowsTopDown().length).toBeGreaterThan(4)
    const [first, second] = rowsTopDown()
    const firstId = first.dataset.rowId!
    const rowSize = first.getBoundingClientRect().height

    // Клавиатура: Alt+Shift+↓ на активной ячейке строки.
    await humanClick(first.querySelector<HTMLElement>('[aria-colindex="3"]')!)
    const keyboard = await sampleFrames(
      () => topOf(rowById(firstId)!),
      () => userEvent.keyboard('{Alt>}{Shift>}{ArrowDown}{/Shift}{/Alt}'),
    )
    expect(passesBetween(keyboard, 0, rowSize)).toBe(true)
    expect(keyboard.at(-1)).toBeCloseTo(rowSize, 0)

    // Меню ручки: «Move up» возвращает строку.
    const handle = rowById(firstId)!.querySelector<HTMLElement>(HANDLE)!
    handle.focus()
    await userEvent.keyboard('{Enter}')
    const item = () =>
      [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
        node => node.textContent?.trim() === DEFAULT_LABELS.moveUp,
      )
    await expect.poll(item).toBeTruthy()
    const menu = await sampleFrames(
      () => topOf(rowById(firstId)!),
      () => userEvent.click(item()!),
    )
    expect(passesBetween(menu, rowSize, 0)).toBe(true)
    expect(menu.at(-1)).toBeCloseTo(0, 0)
    expect(second).toBeTruthy()
  })

  test('RM12: прокрутка, быстрая прокрутка или scrollToRow посреди движения доводят его до конца за кадр', async () => {
    slowMotion(4000)
    const { table } = await mountHost({ toggles: SORTING })
    const scroller = document.querySelector<HTMLElement>(SCROLLER)!
    const interrupt = async (
      sorting: { id: string; desc: boolean }[],
      act: () => Promise<unknown> | unknown,
    ) => {
      table().setSorting(sorting)
      await expect.poll(() => still()).toBe(false)
      const scrolled = scroller.scrollTop
      await act()
      // Колесо Chromium прокручивает асинхронно — ждём сдвига прокрутки.
      await expect.poll(() => scroller.scrollTop).not.toBe(scrolled)
      await nextFrame()
      await nextFrame()
      return still()
    }

    // Прокрутка.
    expect(
      await interrupt(byAge, () => {
        scroller.scrollTop = 120
      }),
    ).toBe(true)
    // Быстрая прокрутка колесом. Порядок без сортировки: часть строк окна уцелела (RM6).
    const rect = scroller.getBoundingClientRect()
    expect(
      await interrupt([], () =>
        pointer.realWheel(
          { x: rect.left + 100, y: rect.top + rect.height / 2 },
          400,
          6,
          8,
        ),
      ),
    ).toBe(true)
    // scrollToRow.
    expect(await interrupt(byAge, () => table().scrollToRow(id(0)))).toBe(true)
  })

  test('RM13: новая смена посреди движения стартует с текущего видимого положения, без скачка', async () => {
    slowMotion(800)
    await renderExpanding()
    const { belowId, toggle } = parentAndBelow()
    const frames = await sampleFrames(
      () => topOf(rowById(belowId)!),
      async () => {
        await userEvent.click(toggle())
        await sleep(300)
        await userEvent.click(toggle())
      },
      1300,
    )
    const steps = frames.slice(1).map((top, i) => Math.abs(top - frames[i]))
    const travel = Math.max(...frames) - Math.min(...frames)
    expect(travel).toBeGreaterThan(20)
    // Разворот без скачка: шаг кадра — малая доля пути.
    expect(Math.max(...steps)).toBeLessThan(travel / 3)
    expect(frames.at(-1)).toBeCloseTo(frames[0], 0)
  })

  test('RM14: prefers-reduced-motion — без движения, проявления и призраков', async () => {
    await pointer.reducedMotion(true)
    try {
      await renderExpanding()
      const { toggle } = parentAndBelow()
      const expand = await sampleFrames(still, () => userEvent.click(toggle()))
      expect(expand.every(Boolean)).toBe(true)
      const collapse = await sampleFrames(still, () =>
        userEvent.click(toggle()),
      )
      expect(collapse.every(Boolean)).toBe(true)
    } finally {
      await pointer.reducedMotion(false)
    }
  })

  test('RM15: enableRowAnimation: false — смены модели мгновенны', async () => {
    await renderExpanding({ enableRowAnimation: false })
    const { toggle } = parentAndBelow()
    const expand = await sampleFrames(still, () => userEvent.click(toggle()))
    expect(expand.every(Boolean)).toBe(true)
    const collapse = await sampleFrames(still, () => userEvent.click(toggle()))
    expect(collapse.every(Boolean)).toBe(true)
  })

  test('RM16: длительность — токен --tsr-comp-row-motion-duration из базового, кривая — общая', async () => {
    await renderExpanding()
    const { belowId, toggle } = parentAndBelow()
    const timingOf = async () => {
      await userEvent.click(toggle())
      // Движение строки — анимация по `translate`.
      const moving = () =>
        rowById(belowId)!
          .getAnimations()
          .find(animation =>
            (animation.effect as KeyframeEffect)
              .getKeyframes()
              .some(frame => 'translate' in frame),
          )
      await expect.poll(moving).toBeTruthy()
      const transition = moving()!
      const timing = transition.effect!.getComputedTiming()
      await settleRowMotion()
      return timing
    }
    const base = getComputedStyle(gridRoot()!)
      .getPropertyValue('--tsr-comp-motion-easing')
      .trim()
    const standard = await timingOf()
    expect(standard.duration).toBe(250)
    expect((standard.easing ?? '').replace(/\s/g, '')).toBe(
      base.replace(/\s/g, ''),
    )
    await userEvent.click(parentAndBelow().toggle())
    await settleRowMotion()

    const style = document.createElement('style')
    style.textContent =
      '.data-grid-theme { --tsr-comp-motion-duration: 300ms; }'
    document.head.append(style)
    try {
      expect((await timingOf()).duration).toBe(500)
    } finally {
      style.remove()
    }
  })

  test('RM17: фокус после смены модели там же, что без движения; во время движения не теряется, не уходит из грида и в призраков', async () => {
    /** Где фокус после раскрытия (фокус ниже родителя) и сворачивания (фокус в ребёнке). */
    const focusTrail = async (enableRowAnimation: boolean) => {
      const screen = await renderExpanding({
        enableKeyboardNavigation: true,
        enableRowAnimation,
      })
      const { parentId, toggle } = parentAndBelow()
      const focusCell = (row: HTMLElement) =>
        humanClick(row.querySelector<HTMLElement>('[aria-colindex="3"]')!)
      const read = () => ({
        inGrid: !!gridRoot()?.contains(document.activeElement),
        inGhost: !!document.activeElement?.closest(GHOST),
      })
      const where = () => {
        const cell = document.activeElement as HTMLElement
        return `${cell.closest(BODY_ROW)?.getAttribute('data-row-id')}:${cell.getAttribute('aria-colindex')}`
      }

      await focusCell(rowsTopDown()[3])
      const expand = await sampleFrames(read, () => toggle().click())
      const afterExpand = where()
      const rows = rowsTopDown()
      const child = rows[rows.indexOf(rowById(parentId)!) + 1]
      await focusCell(child)
      const collapse = await sampleFrames(read, () => toggle().click())
      const afterCollapse = where()
      await screen.unmount()
      return { frames: [...expand, ...collapse], afterExpand, afterCollapse }
    }

    const instant = await focusTrail(false)
    const moving = await focusTrail(true)
    expect(moving.afterExpand).toBe(instant.afterExpand)
    expect(moving.afterCollapse).toBe(instant.afterCollapse)
    expect(moving.frames.every(frame => frame.inGrid)).toBe(true)
    expect(moving.frames.some(frame => frame.inGhost)).toBe(false)
  })

  test('RM28: поле правки, открытое в едущей строке, берёт фокус без прокрутки грида', async () => {
    await render(
      <Stories.AllFeatures
        height={500}
        columnCount={6}
        dataCount={30}
        enableKeyboardNavigation
        enableCellEditing
        cellEditingCanEditCell={() => true}
      />,
    )
    await expect.poll(() => rowsTopDown().length).toBeGreaterThan(4)
    const [first] = rowsTopDown()
    const cell = first.querySelector<HTMLElement>(
      '.data-grid__body-cell[data-column-id="age"]',
    )!
    await humanClick(cell)
    await expect.poll(() => cell.contains(document.activeElement)).toBe(true)
    const scroller = document.querySelector<HTMLElement>(SCROLLER)!
    // Строка посреди переезда снизу, как при сортировке издалека (RM4).
    const glide = first.animate(
      [{ translate: '0 900px' }, { translate: '0 0' }],
      { duration: 3000 },
    )
    try {
      await userEvent.keyboard('{F2}')
      await expect.poll(() => cell.querySelector('input')).not.toBeNull()
      expect(document.activeElement).toBe(cell.querySelector('input'))
      expect(scroller.scrollTop).toBe(0)
    } finally {
      glide.cancel()
      await userEvent.keyboard('{Escape}')
    }
  })

  test('RM19: движение не перерисовывает строки покадрово — коммитов React столько же при длительности 250 мс и 3 с', async ({
    skip,
  }) => {
    skip(
      server.browser !== 'chromium',
      'счётчики работы — трейс CDP, только Chromium',
    )
    await renderExpanding()
    const { toggle } = parentAndBelow()
    const grid = gridRoot()!
    const commitsOf = async () => {
      const work = await measureWork(grid, () => toggle().click(), {
        quietFrames: 10,
      })
      await settleRowMotion()
      await userEvent.click(toggle())
      await settleRowMotion()
      return work.commits
    }
    const standard = await commitsOf()
    slowMotion(3000)
    const slow = await commitsOf()
    expect(standard).toBeGreaterThan(0)
    expect(slow).toBe(standard)
  })

  test('RM22: грид не мешает View Transitions приложения — без startViewTransition и view-transition-name, внутри <ViewTransition> строки двигаются', async () => {
    const original = document.startViewTransition
    let calls = 0
    if (original) {
      document.startViewTransition = ((
        ...args: Parameters<typeof original>
      ) => {
        calls++
        return original.apply(document, args)
      }) as typeof original
    }
    try {
      // `ViewTransition` есть с React 19.3; на React 18 — без обёртки.
      const ViewTransition = (
        React as unknown as {
          ViewTransition?: React.ComponentType<{ children: React.ReactNode }>
        }
      ).ViewTransition
      const story = <composed.RowExpanding />
      await render(
        ViewTransition ? <ViewTransition>{story}</ViewTransition> : story,
      )
      await expect.poll(() => rowsTopDown().length).toBeGreaterThan(3)
      const { belowId, toggle } = parentAndBelow()
      const startTop = topOf(rowById(belowId)!)
      const frames = await sampleFrames(
        () => topOf(rowById(belowId)!),
        () => userEvent.click(toggle()),
      )
      expect(passesBetween(frames, startTop, frames.at(-1)!)).toBe(true)
      expect(calls).toBe(0)
      for (const row of document.querySelectorAll(BODY_ROW)) {
        expect(getComputedStyle(row).viewTransitionName).toBe('none')
      }
    } finally {
      if (original) document.startViewTransition = original
    }
  })
})
