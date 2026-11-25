import { useState } from 'react'

import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'

import { StoryComponent } from './DataGridStory'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { vrStates } from './__mocks__/catalog'
import { guideNext, settle, until } from './__mocks__/catalogPlay'
import { expandAllType } from './__mocks__/utils/argTypes'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { DemoStory, type DemoStoryStep, guideArgs } from './demos/DemoStory'
import { WithConsole } from './demos/StoryConsole'
import { createConsoleLog } from './demos/consoleLog'

/**
 * Скелет первой загрузки (ADR 0060): по истории на клиентский сценарий S1–S3. Сценарий
 * проигрывается панелью над гридом — «Воспроизвести» или по шагам; в тестах шаги
 * проходит `play` (ADR 0117, §6).
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Data loading/Skeleton',
} satisfies Meta<StoryProps>

export default meta

/**
 * Область грида фиксированной высоты, как у приложения: строк скелета — по высоте, и
 * со скелетом и с данными грид одного размера.
 */
const FIXED_HEIGHT = {
  containerHeight: '600',
  height: '500',
  maxHeight: '500',
} as const

/** `expandAll` без переключателя — дерево шага «Иерархия данных» (как в `Tree data`). */
const EXPAND_ALL_CONTROL = {
  expandAll: { ...expandAllType, if: null as unknown as undefined },
}

/** Грид открыт, данных ещё нет — как у настоящего приложения. */
const OPENED: DemoStoryStep = {
  title: {
    ru: 'Таблица открыта, данные загружаются',
    en: 'The table is open and data is loading',
  },
  hint: {
    ru: 'Данных ещё нет: на месте строк — скелет по раскладке таблицы.',
    en: 'There is no data yet: in place of the rows is a skeleton that follows the table layout.',
  },
  props: () => ({ loading: 'initial', dataOverride: [] }),
}

/** Ответ сервера: данные и конец загрузки приходят одним обновлением. */
const ANSWERED: DemoStoryStep = {
  title: { ru: 'Данные получены', en: 'Data received' },
  hint: {
    ru: 'Строки встают на место скелета, колонки не сдвигаются.',
    en: "The rows take the skeleton's place, and the columns do not shift.",
  },
  props: ({ rows }) => ({ loading: false, dataOverride: rows }),
}

// --- Чтение грида в `play` -------------------------------------------------------

const SKELETON_ROW = '.data-grid__body-row--skeleton'
const SKELETON_CELL = '.data-grid__body-cell--skeleton'

const all = (root: ParentNode, selector: string) => [
  ...root.querySelectorAll<HTMLElement>(selector),
]
const skeletonRows = (canvas: HTMLElement) => all(canvas, SKELETON_ROW)
const dataRows = (canvas: HTMLElement) =>
  all(canvas, `.data-grid__body-row:not(${SKELETON_ROW})`)
const headCells = (canvas: HTMLElement) => all(canvas, '.data-grid__head-cell')
/** Полоска или квадрат скелета внутри ячейки. */
const shapeOf = (cell: Element) =>
  cell.querySelector<HTMLElement>('span[style*="width"]')
const scrollerOf = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('.data-grid__container')!

const box = (element: Element) => {
  const rect = element.getBoundingClientRect()
  return { left: Math.round(rect.left), width: Math.round(rect.width) }
}
const geometry = (cells: HTMLElement[]) =>
  cells.map(cell => ({ id: cell.dataset.columnId, ...box(cell) }))

type Geometry = ReturnType<typeof geometry>

/**
 * Места колонок, что смонтированы в обоих окнах: окно колонок в покое и после роста полосы разное
 * (ADR 0202, §1а), сдвиг — это смена места общей колонки.
 */
const shared = (now: Geometry, before: Geometry) => [
  now.filter(cell => before.some(other => other.id === cell.id)),
  before.filter(cell => now.some(other => other.id === cell.id)),
]

const waitSkeleton = (canvas: HTMLElement) =>
  until(() => expect(skeletonRows(canvas).length).toBeGreaterThan(0))
const waitData = (canvas: HTMLElement) =>
  until(() => {
    expect(skeletonRows(canvas)).toHaveLength(0)
    expect(dataRows(canvas).length).toBeGreaterThan(0)
  })

// --- S1 ------------------------------------------------------------------------------

/**
 * Шаги по SL6: колонок ещё нет (тулбар — ADR 0122), скелет плоский, затем деревом, с
 * линиями и с переключателем (ADR 0119); смена на данные без сдвига.
 */
const DATA_ARRIVES = [
  {
    ...OPENED,
    title: {
      ru: 'Ожидание списка колонок от сервера',
      en: 'Waiting for the column list from the server',
    },
    hint: {
      ru: 'Структура таблицы еще неизвестна. Тулбар, тело таблицы и статусбар находятся в состоянии загрузки.',
      en: 'The table structure is not known yet. The toolbar, the table body, and the status bar are in a loading state.',
    },
    props: () => ({
      loading: 'initial',
      dataOverride: [],
      columnsOverride: [],
    }),
  },
  {
    title: { ru: 'Данные загружаются', en: 'Data is loading' },
    hint: {
      ru: 'Список колонок был загружен или известен заранее, но данных пока нет. Некоторые фичи уже доступны, но таблица еще не готова к взаимодействию.',
      en: 'The column list has loaded or was known in advance, but there is no data yet. Some features are already available, but the table is not ready for interaction yet.',
    },
    props: () => ({ columnsOverride: undefined }),
  },
  {
    title: { ru: 'Иерархия данных', en: 'Data hierarchy' },
    hint: {
      ru: 'Скелеты поддерживают отображение вложенных строк. В этом режиме случайным строкам в первой колонке добавляются отступы.',
      en: 'Skeletons can show nested rows. In this mode, random rows get an indent in the first column.',
    },
    props: () => ({ enableRowExpandingModel: true, expandAll: true }),
  },
  {
    title: { ru: 'Линии дерева', en: 'Tree lines' },
    hint: {
      ru: 'Чтобы визуально выразить иерархическую структуру данных, вложенным строкам добавляются линии дерева.',
      en: 'To show the hierarchical structure of the data visually, nested rows get tree lines.',
    },
    props: () => ({ enableTreeLines: true }),
  },
  {
    title: { ru: 'Раскрытие строк', en: 'Row expanding' },
    hint: {
      ru: 'Для сворачивания/разворачивания строк слева появляется колонка со скелетами. После загрузки данных на ее месте появятся реальные кнопки.',
      en: 'A column of skeletons appears on the left for collapsing and expanding rows. Once the data loads, real buttons will appear in its place.',
    },
    props: () => ({ enableRowExpanding: true }),
  },
  {
    ...ANSWERED,
    hint: {
      ru: 'Скелеты заменяются данными и кнопками. Таблица готова к работе.',
      en: 'The skeletons are replaced by data and buttons. The table is ready to use.',
    },
  },
] as const satisfies readonly DemoStoryStep[]

/**
 * Всё, что видно на скелете: служебные колонки (выбор, перетаскивание, действия;
 * раскрытие — шагом «Раскрытие строк»), закрепление, итоги, панели над таблицей и под ней
 * с функциями тулбара до прихода данных (ADR 0122).
 */
const DATA_ARRIVES_ARGS = {
  ...FIXED_HEIGHT,
  // Дерево в данных: после загрузки колонка раскрытия остаётся на месте.
  dataNesting: 'nested',
  enableRowSelection: true,
  rowSelectionSelectedCount: true,
  enableRowDragging: true,
  enableRowActions: true,
  enableColumnPinning: true,
  pinFirstColumn: true,
  enableFooter: true,
  enablePagination: true,
  enableQuickSearch: true,
  enableColumnFiltering: true,
  enableColumnVisibility: true,
  enableDataExport: true,
} satisfies Partial<StoryProps>

const TOOLBAR_CONTROLS = [
  'enableQuickSearch',
  'enableColumnFiltering',
  'enableColumnVisibility',
  'enableDataExport',
]

const DATA_ARRIVES_CONTROLS = [
  'skeletonOptions',
  'dataNesting',
  'enableRowSelection',
  'rowSelectionSelectedCount',
  'enableRowExpandingModel',
  'enableTreeLines',
  'enableRowExpanding',
  'expandAll',
  'enableRowDragging',
  'enableRowActions',
  'enableColumnPinning',
  'pinFirstColumn',
  'enableFooter',
  'enablePagination',
  ...TOOLBAR_CONTROLS,
]

/**
 * Скелет первой загрузки в покое — снимок каталога `body.skeleton`. Песочница фичи:
 * контролы и функции всех её сценариев, включая тулбар (ADR 0122), и `loading` —
 * скелет, свечение обновления или данные.
 */
export const SkeletonPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  parameters: {
    ...vrStates('body.skeleton'),
    ...showControls([
      'loading',
      'refreshOptions',
      ...DATA_ARRIVES_CONTROLS,
      'paginationInitialPageSize',
    ]),
  },
  args: { ...DATA_ARRIVES_ARGS, loading: 'initial' },
  argTypes: EXPAND_ALL_CONTROL,
  render: function Render(args) {
    // Консоль событий песочницы (ADR 0124): журнал живёт, пока открыта история.
    const [consoleLog] = useState(createConsoleLog)
    return (
      <WithConsole log={consoleLog} args={args}>
        <StoryComponent {...normalizeArgs(args)} />
      </WithConsole>
    )
  },
}

/**
 * S1: получение данных — без колонок скелет из одинаковых колонок, затем повторяет
 * раскладку таблицы со служебными колонками, итогами и панелями; с `tree` —
 * развёрнутыми подстроками, с раскрытием строк — квадратами раскрытия и, с `treeLines`,
 * линиями дерева; пришли данные — всё на тех же местах, без задержки (SL6, SL2, SL8).
 * Функции включает гайд, поэтому контролов нет — вариации в `Playground`.
 */
export const SkeletonDataArrives: StoryObj<StoryProps> = {
  name: 'Data arrives',
  parameters: {
    scenario: '0060/S1',
    requirements: ['SL6', 'SL2', 'SL8'],
    ...guideControls(),
  },
  render: args => (
    <DemoStory
      title={{ ru: 'Получение данных', en: 'Receiving data' }}
      steps={DATA_ARRIVES}
      args={guideArgs(DATA_ARRIVES_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    // В Storybook сценарий проходит человек; `play` — только в тестах каталога.
    if (globals.catalog !== true) return
    const footerSkeleton = () =>
      all(canvas, '.data-grid__footer-cell--skeleton')
    // Подстроки скелета: в какой-то колонке полоски начинаются с разным отступом.
    const indented = () => {
      const lefts = new Map<string, Set<number>>()
      for (const row of skeletonRows(canvas)) {
        for (const cell of all(row, SKELETON_CELL)) {
          const shape = shapeOf(cell)
          if (!shape) continue
          const id = cell.dataset.columnId!
          lefts.set(id, (lefts.get(id) ?? new Set()).add(box(shape).left))
        }
      }
      return [...lefts.values()].some(set => set.size > 1)
    }
    const treeLines = () =>
      all(canvas, `${SKELETON_CELL} span[class]`).some(part =>
        /elbow/i.test(part.className),
      )
    let head: ReturnType<typeof geometry> = []
    let columns: ReturnType<typeof geometry> = []
    let footer: ReturnType<typeof geometry> = []
    let footerShapes = new Set<string>()
    const toolbarPart = (id: string) =>
      canvas.querySelector<HTMLElement>(`[data-testid="${id}"]`)
    /** Бокс в координатах тулбара: панель шагов меняет высоту от шага к шагу. */
    const inToolbar = (element: HTMLElement) => {
      const own = element.getBoundingClientRect()
      const origin = toolbarPart('data-grid-toolbar')!.getBoundingClientRect()
      return {
        left: Math.round(own.left - origin.left),
        top: Math.round(own.top - origin.top),
        width: Math.round(own.width),
        height: Math.round(own.height),
      }
    }
    let exportSlot = { left: 0, top: 0, width: 0, height: 0 }
    let header: HTMLElement | undefined
    const byId = (part: string, row: HTMLElement) =>
      all(row, SKELETON_CELL).find(cell =>
        cell.dataset.columnId?.includes(part),
      )
    const square = async (shape: HTMLElement) => {
      await until(() => expect(box(shape).width).toBe(16))
      await until(() =>
        expect(Math.round(shape.getBoundingClientRect().height)).toBe(16),
      )
    }
    const expandCells = () =>
      skeletonRows(canvas).flatMap(row => byId('rowExpanding', row) ?? [])
    await step(DATA_ARRIVES[0].title.ru, async () => {
      await waitSkeleton(canvas)
      // ADR 0122: без колонок поиск, «Настройки вида» и «Экспорт» — скелеты (ADR 0215).
      for (const id of [
        'quick-search-skeleton',
        'view-settings-skeleton',
        'export-skeleton',
      ]) {
        await until(() => expect(toolbarPart(id), id).not.toBeNull())
      }
      for (const id of ['quick-search', 'view-settings-button']) {
        await until(() => expect(toolbarPart(id), id).toBeNull())
      }
    })
    await step(DATA_ARRIVES[1].title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(toolbarPart('quick-search')).not.toBeNull())
      await until(() =>
        expect(byId('rowSelection', skeletonRows(canvas)[0]!)).toBeDefined(),
      )
      const rows = skeletonRows(canvas)
      // SL2: выбор — квадрат, перетаскивание и действия — пустая ячейка.
      await square(shapeOf(byId('rowSelection', rows[0]!)!)!)
      for (const empty of ['rowDragging', 'rowActions']) {
        await until(() => expect(shapeOf(byId(empty, rows[0]!)!)).toBeNull())
      }
      await until(() => expect(expandCells()).toHaveLength(0))
      await until(() => expect(indented()).toBe(false))
      // ADR 0122: поиск и «Настройки вида» — контролы, «Экспорт» — скелет.
      await until(() => expect(toolbarPart('export-skeleton')).not.toBeNull())
      for (const id of ['quick-search', 'view-settings-button']) {
        await until(() => expect(toolbarPart(id), id).not.toBeNull())
      }
      await until(() => expect(toolbarPart('export-button')).toBeNull())
      exportSlot = inToolbar(toolbarPart('export-skeleton')!)
    })
    await step(DATA_ARRIVES[2].title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(indented()).toBe(true))
      await until(() => expect(expandCells()).toHaveLength(0))
      await until(() => expect(treeLines()).toBe(false))
    })
    await step(DATA_ARRIVES[3].title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(treeLines()).toBe(true))
      await until(() => expect(expandCells()).toHaveLength(0))
    })
    await step(DATA_ARRIVES[4].title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(expandCells().length).toBeGreaterThan(0))
      // SL2: раскрытие — квадрат у строк с подстроками (SL25).
      const shapes = expandCells().flatMap(cell => shapeOf(cell) ?? [])
      await until(() => expect(shapes.length).toBeGreaterThan(0))
      for (const shape of shapes) await square(shape)
      await until(() => expect(indented()).toBe(true))
      await until(() => expect(treeLines()).toBe(true))
      head = geometry(headCells(canvas))
      columns = geometry(all(skeletonRows(canvas)[0]!, SKELETON_CELL))
      header = headCells(canvas)[0]
      // SL8: скелеты итогов — в колонках, где задан footer.
      footer = geometry(footerSkeleton())
      footerShapes = new Set(
        footerSkeleton()
          .filter(cell => shapeOf(cell))
          .map(cell => cell.dataset.columnId!),
      )
      await until(() => expect(footerShapes.size).toBeGreaterThan(0))
    })
    await step(DATA_ARRIVES[5].title.ru, async () => {
      // SL6, без задержки: ни одного состояния DOM без скелета и без строк.
      let empty = 0
      const observer = new MutationObserver(() => {
        if (!skeletonRows(canvas).length && !dataRows(canvas).length) empty++
      })
      observer.observe(canvas, { subtree: true, childList: true })
      await guideNext(canvas)
      observer.disconnect()
      await waitData(canvas)
      await until(() => expect(empty).toBe(0))
      // SL6 и SL2, без сдвига: те же заголовки, места и ширины колонок, служебных тоже.
      await until(() => expect(headCells(canvas)[0]).toBe(header))
      const [headNow, headBefore] = shared(geometry(headCells(canvas)), head)
      await until(() => expect(headNow.length).toBeGreaterThan(1))
      await until(() => expect(headNow).toEqual(headBefore))
      const [cellsNow, cellsBefore] = shared(
        geometry(all(dataRows(canvas)[0]!, '.data-grid__body-cell')),
        columns,
      )
      await until(() => expect(cellsNow.length).toBeGreaterThan(1))
      await until(() => expect(cellsNow).toEqual(cellsBefore))
      // SL8: итоги — ровно в колонках, где был их скелет.
      const loaded = all(canvas, '.data-grid__footer-cell')
      const [footerNow, footerBefore] = shared(geometry(loaded), footer)
      await until(() => expect(footerNow.length).toBeGreaterThan(1))
      await until(() => expect(footerNow).toEqual(footerBefore))
      const ids = new Set(footerNow.map(cell => cell.id))
      const totals = new Set(
        loaded
          .filter(cell => cell.textContent?.trim())
          .map(cell => cell.dataset.columnId!),
      )
      await until(() => expect(totals.size).toBeGreaterThan(0))
      await until(() =>
        expect(totals).toEqual(
          new Set([...footerShapes].filter(id => ids.has(id))),
        ),
      )
      // Скелетов не осталось нигде, панели тоже.
      await until(() =>
        expect(canvas.querySelector('[data-skeleton]')).toBeNull(),
      )
      // «Экспорт» — на месте своего скелета.
      await until(() => expect(toolbarPart('export-button')).not.toBeNull())
      await until(() =>
        expect(inToolbar(toolbarPart('export-button')!)).toEqual(exportSlot),
      )
    })
    await settle()
  },
}

// --- S2 ------------------------------------------------------------------------------

const PAGE_SIZE = 10
const TALL_ROW = 80
const LOW_AREA = '400'
/** Меньше, чем помещается в низкую область: строки не доходят до низа. */
const OWN_ROWS = 2

/** Высокая область: по высоте помещается больше строк, чем страница шага 2. */
const ROWS_COUNT_ARGS = {
  containerHeight: '800',
  height: '650',
  maxHeight: '650',
} satisfies Partial<StoryProps>

const ROWS_COUNT: readonly DemoStoryStep[] = [
  {
    ...OPENED,
    title: { ru: 'Строки по высоте области', en: 'Rows by area height' },
    hint: {
      ru: "rowsCount: 'auto' (по умолчанию) — строк скелета столько, сколько помещается по высоте области прокрутки.",
      en: "rowsCount: 'auto' (the default): there are as many skeleton rows as fit in the height of the scroll area.",
    },
  },
  {
    title: {
      ru: `Размер страницы — ${PAGE_SIZE} строк`,
      en: `Page size: ${PAGE_SIZE} rows`,
    },
    hint: {
      ru: 'Размер страницы жестко ограничен пагинацией. Количество строк скелетов не превышает этого значения.',
      en: 'Pagination strictly limits the page size. The number of skeleton rows does not exceed this value.',
    },
    remount: true,
    props: () => ({
      enablePagination: true,
      paginationInitialPageSize: PAGE_SIZE,
    }),
  },
  {
    title: {
      ru: `Размер строки — ${TALL_ROW}px`,
      en: `Row size: ${TALL_ROW}px`,
    },
    hint: {
      ru: `Увеличенная высота строки (rowHeight: ${TALL_ROW}): строк скелета меньше, но количество также подстраивается под высоту области прокрутки.`,
      en: `A taller row (rowHeight: ${TALL_ROW}): there are fewer skeleton rows, but their number still adapts to the height of the scroll area.`,
    },
    props: () => ({ rowHeight: TALL_ROW }),
  },
  {
    title: {
      ru: `Размер тела таблицы — ${LOW_AREA}px`,
      en: `Table body size: ${LOW_AREA}px`,
    },
    hint: {
      ru: 'Область меньше — строк меньше: расчёт идёт по высоте области прокрутки.',
      en: 'A smaller area means fewer rows: the count follows the height of the scroll area.',
    },
    props: () => ({ height: LOW_AREA, maxHeight: LOW_AREA }),
  },
  {
    title: {
      ru: `Своё число строк — ${OWN_ROWS}`,
      en: `Custom row count: ${OWN_ROWS}`,
    },
    hint: {
      ru: `skeletonOptions: { rowsCount: ${OWN_ROWS} } — фиксированное количество строк, вне зависимости от области прокрутки.`,
      en: `skeletonOptions: { rowsCount: ${OWN_ROWS} }: a fixed number of rows, regardless of the scroll area.`,
    },
    props: () => ({ skeletonOptions: { rowsCount: OWN_ROWS } }),
  },
  {
    ...ANSWERED,
    hint: {
      ru: `Загружено ${OWN_ROWS} строки. Их количество было известно заранее, поэтому сдвиг лейаута минимален.`,
      en: `${OWN_ROWS} rows loaded. Their number was known in advance, so the layout shift is minimal.`,
    },
    props: ({ rows }) => ({
      loading: false,
      dataOverride: rows.slice(0, OWN_ROWS),
    }),
  },
]

/**
 * S2: число строк скелета — по высоте области и высоте строки; с пагинацией — не
 * больше страницы; число в `rowsCount` — ровно столько (SL5).
 */
export const SkeletonRowsCount: StoryObj<StoryProps> = {
  name: 'Rows count',
  parameters: {
    scenario: '0060/S2',
    requirements: ['SL5'],
    ...guideControls(),
  },
  render: args => (
    <DemoStory
      title={{ ru: 'Число строк скелета', en: 'Skeleton row count' }}
      steps={ROWS_COUNT}
      args={guideArgs(ROWS_COUNT_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    /** Сколько строк помещается в область прокрутки под шапкой. */
    const fit = () => {
      const scroller = scrollerOf(canvas)
      const head = canvas.querySelector<HTMLElement>('.data-grid__head')!
      const rowHeight = skeletonRows(canvas)[0]!.offsetHeight
      return Math.ceil((scroller.clientHeight - head.offsetHeight) / rowHeight)
    }
    const count = () => skeletonRows(canvas).length
    const fillsArea = () => {
      const scroller = scrollerOf(canvas)
      return expect(
        skeletonRows(canvas).at(-1)!.getBoundingClientRect().bottom,
      ).toBeGreaterThanOrEqual(
        scroller.getBoundingClientRect().top + scroller.clientHeight - 1,
      )
    }
    let byHeight = 0
    await step(ROWS_COUNT[0]!.title.ru, async () => {
      await waitSkeleton(canvas)
      byHeight = fit()
      await expect(byHeight).toBeGreaterThan(PAGE_SIZE)
      await expect(count()).toBe(byHeight)
      await fillsArea()
    })
    await step(ROWS_COUNT[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(count()).toBe(PAGE_SIZE))
    })
    let tall = 0
    await step(ROWS_COUNT[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(skeletonRows(canvas)[0]!.offsetHeight).toBe(TALL_ROW),
      )
      await until(() => expect(count()).toBe(fit()))
      tall = count()
      await expect(tall).toBeLessThan(PAGE_SIZE)
      await fillsArea()
    })
    let low = 0
    await step(ROWS_COUNT[3]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => {
        expect(count()).toBe(fit())
        expect(count()).toBeLessThan(tall)
      })
      low = count()
      await fillsArea()
    })
    await step(ROWS_COUNT[4]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(count()).toBe(OWN_ROWS))
      // Шаг виден: строк меньше, чем по высоте, и под ними пусто.
      await expect(OWN_ROWS).toBeLessThan(low)
      const scroller = scrollerOf(canvas)
      await expect(
        skeletonRows(canvas).at(-1)!.getBoundingClientRect().bottom,
      ).toBeLessThan(
        scroller.getBoundingClientRect().top + scroller.clientHeight - 1,
      )
    })
    await step(ROWS_COUNT[5]!.title.ru, async () => {
      await guideNext(canvas)
      await waitData(canvas)
      await expect(dataRows(canvas)).toHaveLength(OWN_ROWS)
    })
    await settle()
  },
}

// --- S3 ------------------------------------------------------------------------------

const DEFAULT_COLUMNS = 8

/** Шесть колонок с сервера — помещаются в область; без columnsCount (SL9). */
const COLUMNS_COUNT_ARGS = {
  ...FIXED_HEIGHT,
  columnCount: 6,
  skeletonOptions: { rowsCount: 'auto' },
} satisfies Partial<StoryProps>

const COLUMNS_COUNT: readonly DemoStoryStep[] = [
  {
    ...OPENED,
    title: {
      ru: 'Число колонок неизвестно',
      en: 'The column count is unknown',
    },
    hint: {
      ru: `Колонки придут с сервера, их число неизвестно. По умолчанию отображается ${DEFAULT_COLUMNS} одинаковых колонок на всю ширину.`,
      en: `The columns will come from the server, and their number is unknown. By default, ${DEFAULT_COLUMNS} identical columns fill the full width.`,
    },
    props: () => ({
      loading: 'initial',
      dataOverride: [],
      columnsOverride: [],
    }),
  },
  {
    title: {
      ru: 'Структура таблицы известна заранее',
      en: 'The table structure is known in advance',
    },
    hint: {
      ru: 'Скелет повторяет колонки таблицы — число, порядок, размер.',
      en: "The skeleton mirrors the table's columns: their number, order, and size.",
    },
    props: () => ({ columnsOverride: undefined }),
  },
  {
    ...ANSWERED,
    title: { ru: 'Данные загружены', en: 'Data loaded' },
    hint: {
      ru: 'Вместо скелетов отобразились реальные данные, сдвиг лейаута минимален.',
      en: 'Real data appeared in place of the skeletons, with minimal layout shift.',
    },
  },
]

/**
 * S3: число колонок скелета по мере загрузки — неизвестно — 8 одинаковых, пришли
 * колонки — как у таблицы (SL9).
 */
export const SkeletonColumnsCount: StoryObj<StoryProps> = {
  name: 'Columns count',
  parameters: {
    scenario: '0060/S3',
    requirements: ['SL9'],
    ...guideControls(),
  },
  render: args => (
    <DemoStory
      title={{ ru: 'Число колонок скелета', en: 'Skeleton column count' }}
      steps={COLUMNS_COUNT}
      args={guideArgs(COLUMNS_COUNT_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const cells = () => all(skeletonRows(canvas)[0]!, SKELETON_CELL)
    const widths = () => cells().map(cell => box(cell).width)
    await step(COLUMNS_COUNT[0]!.title.ru, async () => {
      await waitSkeleton(canvas)
      await until(() => expect(widths()).toHaveLength(DEFAULT_COLUMNS))
      await expect(new Set(widths()).size).toBe(1)
    })
    await step(COLUMNS_COUNT[1]!.title.ru, async () => {
      await guideNext(canvas)
      // Колонки таблицы: те же id, что у заголовков; данных ещё нет.
      await until(() =>
        expect(cells().map(cell => cell.dataset.columnId)).toEqual(
          headCells(canvas).map(cell => cell.dataset.columnId),
        ),
      )
      await expect(cells().length).not.toBe(DEFAULT_COLUMNS)
      await expect(dataRows(canvas)).toHaveLength(0)
    })
    await step(COLUMNS_COUNT[2]!.title.ru, async () => {
      await guideNext(canvas)
      await waitData(canvas)
    })
    await settle()
  },
}
