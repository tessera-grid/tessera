import { userEvent } from 'vitest/browser'
import { beforeAll, describe, expect, test } from 'vitest'

import { getData } from '../../__mocks__/data'
import {
  ALL_PLUGINS,
  Grid,
  click,
  expectFlat,
  frames,
  hover,
  hoverSettled,
  measureSlope,
  mount,
  parkPointer,
  settled,
  waitFor,
  warmUpDocument,
  type GridProps,
} from '../memory.helpers'
import { serverRowModel } from '../../../plugins'
import { rightClick } from '../visual/lazy-helpers'
import { tableLabels } from '../labels'
import { rowExpandingLabels } from '../../../plugins/rowExpanding/labels'
import { cellEditingLabels } from '../../../plugins/cellEditing/labels'
import { columnFilteringLabels } from '../../../plugins/columnFiltering/labels'

// Долгая сессия (ADR 0092, LK7–LK9, LK13): живой грид повторяет одно и то же
// действие; после прогрева узлы, обработчики, куча и состояние таблицы не растут с
// числом повторов.

beforeAll(warmUpDocument)

const SIZE = 1000

const BIG_COLUMNS = Array.from({ length: SIZE }, (_, i) => ({
  id: `c${i}`,
  accessorKey: `c${i}`,
  header: `C${i}`,
  size: 100,
}))
const BIG_DATA = Array.from({ length: SIZE }, (_, row) => {
  const item: Record<string, string> = { id: `r${row}` }
  for (let column = 0; column < SIZE; column++) {
    item[`c${column}`] = `${row}:${column}`
  }
  return item
})

const INLINE: GridProps['toggles'] = {
  ...ALL_PLUGINS,
  enableHeaderActionMenu: false,
}

const scroller = (container: ParentNode) =>
  container.querySelector<HTMLElement>('.data-grid__container')!
const headCell = (container: ParentNode, id: string) =>
  container.querySelector<HTMLElement>(
    `.data-grid__head-cell[data-column-id="${id}"]`,
  )!
const bodyCell = (container: ParentNode, column: string, row = 0) =>
  container.querySelectorAll<HTMLElement>(
    `.data-grid__body-cell[data-column-id="${column}"]`,
  )[row]!
const menu = () => document.querySelector('[role="menu"]')
const popup = () =>
  document.querySelector('[role="dialog"], [role="menu"], [data-side]')

const escape = async () => {
  await userEvent.keyboard('{Escape}')
  await waitFor(() => popup() === null)
}

const flatData = getData(60)

type Api = {
  highlight: (
    target: { row?: string; cell?: { row: string; column: string } },
    options?: { duration?: number; until?: PromiseLike<unknown> },
  ) => unknown
  resetLoadedChildren: (rowId?: string) => void
  store: { state: unknown }
}

/** Грид для LK9 и LK13: ленивые дети, правка и подсветка на одном экземпляре. */
const mountSession = async () => {
  const box: { table?: Api } = {}
  const props = (colorMode: GridProps['colorMode']): GridProps => ({
    data: flatData,
    colorMode,
    onTable: table => (box.table = table as Api),
    toggles: {
      ...INLINE,
      rowExpandingHasChildren: (row: { id: string }) => row.id === 'item-id-1',
      rowExpandingLoadChildren: (row: { id: string }) =>
        Promise.resolve([
          { ...flatData[2], id: `${row.id}-a` },
          { ...flatData[3], id: `${row.id}-b` },
        ]) as never,
      onCellEdit: () => {},
    },
  })
  const mounted = mount(<Grid {...props('auto')} />)
  await settled(mounted.container)
  const { container } = mounted

  let round = 0
  const cycle = async () => {
    const api = box.table!
    // Подсветка с затуханием и с ожиданием промиса — каждый раз другой строки.
    const lit = 4 + (round++ % 40)
    let release!: () => void
    const until = new Promise<void>(resolve => (release = resolve))
    api.highlight({ row: `item-id-${lit}` }, { duration: 50 })
    api.highlight({ row: `item-id-${lit + 1}` }, { until })
    await frames(2)
    release()

    // Приход ленивых детей и их сброс.
    container
      .querySelector<HTMLElement>(
        `.data-grid__body-row[data-row-id="item-id-1"] [aria-label="${rowExpandingLabels(tableLabels).expandRow}"]`,
      )!
      .click()
    await waitFor(
      () => container.querySelector('[data-row-id="item-id-1-a"]') !== null,
    )
    container
      .querySelector<HTMLElement>(
        `.data-grid__body-row[data-row-id="item-id-1"] [aria-label="${rowExpandingLabels(tableLabels).collapseRow}"]`,
      )!
      .click()
    await frames(2)
    api.resetLoadedChildren('item-id-1')

    // Правка ячейки.
    const cell = bodyCell(container, 'country', 2)
    await hover(cell)
    await click(
      cell.querySelector<HTMLElement>(
        `[aria-label="${cellEditingLabels(tableLabels).editCell}"]`,
      )!,
    )
    await waitFor(() => cell.querySelector('input') !== null)
    await userEvent.keyboard('{Control>}a{/Control}Edited{Enter}')
    await waitFor(() => cell.querySelector('input') === null)

    // Смена темы туда и обратно.
    mounted.render(<Grid {...props('dark')} />)
    await frames(2)
    mounted.render(<Grid {...props('auto')} />)
    await new Promise(resolve => setTimeout(resolve, 80))
    await parkPointer()
  }

  return { mounted, cycle, state: () => box.table!.store.state }
}

/** Число записей в состоянии: ключи объектов, элементы массивов, Map и Set. */
const stateSize = (value: unknown, seen = new Set<object>()): number => {
  if (value === null || typeof value !== 'object' || seen.has(value)) {
    return 0
  }
  seen.add(value)
  const items =
    value instanceof Map || value instanceof Set
      ? [...value.values()]
      : Array.isArray(value)
        ? value
        : Object.values(value)
  return items.reduce<number>((sum, item) => sum + 1 + stateSize(item, seen), 0)
}

describe('Утечки в долгой сессии', () => {
  test(`LK7: прокрутка ${SIZE}×${SIZE} вниз и вверх — после прогрева прирост узлов и обработчиков за 2N циклов не больше прироста за N плюс шум`, async () => {
    const mounted = mount(<Grid columns={BIG_COLUMNS} data={BIG_DATA} />)
    await settled(mounted.container)
    const element = scroller(mounted.container)
    const cycle = async () => {
      for (const fraction of [0.25, 0.5, 1, 0.5, 0]) {
        element.scrollTop =
          (element.scrollHeight - element.clientHeight) * fraction
        element.scrollLeft =
          (element.scrollWidth - element.clientWidth) * fraction
        await frames(3)
      }
    }
    try {
      expectFlat(await measureSlope(cycle, { warmup: 2, cycles: 4 }))
    } finally {
      mounted.unmount()
    }
  }, 180_000)

  test('LK8: открытие и закрытие меню, панелей фильтров, экспорта, «Колонок», контекстного меню и тултипов — после прогрева прирост узлов и обработчиков за 2N циклов не больше прироста за N плюс шум', async () => {
    const mounted = mount(<Grid toggles={INLINE} />)
    await settled(mounted.container)
    const { container } = mounted
    const cycle = async () => {
      const head = headCell(container, 'country')
      await hover(head)
      await click(head.querySelector<HTMLElement>('.column-filter__button')!)
      await waitFor(
        () => document.querySelector('[data-testid="filter-panel"]') !== null,
      )
      await escape()

      await click(
        container.querySelector<HTMLElement>('[data-testid="export-button"]')!,
      )
      await waitFor(
        () => document.querySelector('[data-testid="export-panel"]') !== null,
      )
      await escape()

      await click(
        container.querySelector<HTMLElement>(
          '[data-testid="column-visibility-button"]',
        )!,
      )
      await waitFor(() => document.querySelector('[role="dialog"]') !== null)
      await escape()

      rightClick(bodyCell(container, 'country'))
      await waitFor(() => menu() !== null)
      await escape()

      // Кнопка фильтра раскрывается со сдвигом: тултип — когда она встала.
      await hover(head)
      await hoverSettled(
        head.querySelector<HTMLElement>('.column-filter__button')!,
      )
      await waitFor(() =>
        [...document.querySelectorAll('[data-side]')].some(
          el =>
            el.textContent?.trim() ===
            columnFilteringLabels(tableLabels).filter,
        ),
      )
      await parkPointer()
      await waitFor(() => popup() === null)
    }
    try {
      expectFlat(await measureSlope(cycle, { cycles: 4 }))
    } finally {
      mounted.unmount()
    }
  }, 180_000)

  test('LK9: подсветки с until, приход и сброс ленивых детей, правка ячеек и смена темы — после прогрева прирост узлов, обработчиков и кучи после сборки мусора за 2N циклов не больше прироста за N плюс шум', async () => {
    const { mounted, cycle } = await mountSession()
    try {
      expectFlat(await measureSlope(cycle, { cycles: 4 }), [
        'nodes',
        'jsEventListeners',
        'heap',
      ])
    } finally {
      mounted.unmount()
    }
  }, 180_000)

  test('LK13: при живом гриде срезы store и внутренние словари — метки прихода, подсветки, объявления, сессии правки и ожидания — после N и 3N циклов сценариев LK9 одного размера', async () => {
    const { mounted, cycle, state } = await mountSession()
    try {
      const N = 3
      for (let i = 0; i < N; i++) {
        await cycle()
      }
      // Затухания и метки прихода гаснут по таймеру — дожидаемся их.
      await new Promise(resolve => setTimeout(resolve, 1500))
      const afterN = stateSize(state())
      for (let i = 0; i < N * 2; i++) {
        await cycle()
      }
      await new Promise(resolve => setTimeout(resolve, 1500))
      const after3N = stateSize(state())
      expect(after3N, `записей состояния: после N — ${afterN}`).toBe(afterN)
    } finally {
      mounted.unmount()
    }
  }, 180_000)
})

// Серверная модель строк (ADR 0138, SD33): прокрутка по 100 000 строк с вытеснением —
// кэш держит три блока, остальные уходят и приходят заново.
const SERVER_POOL = getData(100)
const SERVER_ROWS = 100_000
const serverPlugins = [
  serverRowModel({
    // Крупные блоки: удержание вытесненного блока заметно выше шума кучи.
    blockSize: 500,
    maxBlocks: 3,
    getRows: ({ start, end }) => ({
      rows: Array.from({ length: end - start }, (_, k) => ({
        ...SERVER_POOL[(start + k) % SERVER_POOL.length],
        id: `s${start + k}`,
      })),
    }),
  }),
]

describe('Утечки серверной модели строк', () => {
  test('SD33: долгая прокрутка с вытеснением блоков — после прогрева прирост узлов, обработчиков и кучи после сборки мусора за 2N циклов не больше прироста за N плюс шум', async () => {
    const mounted = mount(
      <Grid plugins={serverPlugins} rowCount={SERVER_ROWS} />,
    )
    await settled(mounted.container)
    const element = scroller(mounted.container)
    const loaded = () =>
      mounted.container.querySelector('.data-grid__body-row[data-row-id]') !==
        null && !element.hasAttribute('data-fast-scrolling')
    const cycle = async () => {
      for (const fraction of [0.2, 0.6, 0.9, 0.4, 0]) {
        element.scrollTop =
          (element.scrollHeight - element.clientHeight) * fraction
        await frames(2)
        await waitFor(loaded)
      }
    }
    try {
      expectFlat(await measureSlope(cycle, { warmup: 2, cycles: 4 }), [
        'nodes',
        'jsEventListeners',
        'heap',
      ])
    } finally {
      mounted.unmount()
    }
  }, 240_000)
})
