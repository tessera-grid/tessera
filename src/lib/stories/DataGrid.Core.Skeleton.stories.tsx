import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'

import { StoryComponent } from './DataGridStory'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { vrStates } from './__mocks__/catalog'
import { guideNext, settle, until } from './__mocks__/catalogPlay'
import { skeletonOptionsType } from './__mocks__/utils/argTypes'
import { showControls } from './__mocks__/utils/dataGridControls'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { GuideStory, type GuideStoryStep } from './demos/GuideStory'

/**
 * Скелет первой загрузки (ADR 0060): по истории на клиентский сценарий S1–S3. Сценарий
 * проигрывается панелью над гридом — «Воспроизвести» или по шагам; в тестах шаги
 * проходит `play` (ADR 0117, §6).
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Core/Skeleton',
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

/**
 * `skeletonOptions` в Controls истории сценария: загрузку задают шаги, поэтому контрол
 * не ждёт `loading: 'initial'` в аргументах. Условие меты снимает только `null`:
 * `undefined` Storybook при слиянии пропускает, а аргумент под ложным условием до
 * истории не доходит.
 */
const SKELETON_OPTIONS_CONTROL = {
  skeletonOptions: { ...skeletonOptionsType, if: null as unknown as undefined },
}

/** Грид открыт, данных ещё нет — как у настоящего приложения. */
const OPENED: GuideStoryStep = {
  title: 'Таблица открыта, данные загружаются',
  hint: 'Данных ещё нет: на месте строк — скелет по раскладке таблицы.',
  props: () => ({ loading: 'initial', dataOverride: [] }),
}

/** Ответ сервера: данные и конец загрузки приходят одним обновлением. */
const ANSWERED: GuideStoryStep = {
  title: 'Данные получены',
  hint: 'Строки встают на место скелета, колонки не сдвигаются.',
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

const waitSkeleton = (canvas: HTMLElement) =>
  until(() => expect(skeletonRows(canvas).length).toBeGreaterThan(0))
const waitData = (canvas: HTMLElement) =>
  until(() => {
    expect(skeletonRows(canvas)).toHaveLength(0)
    expect(dataRows(canvas).length).toBeGreaterThan(0)
  })

// --- S1 ------------------------------------------------------------------------------

/**
 * Шаги по SL6: скелет плоский, затем деревом, с линиями и с переключателем (ADR 0119);
 * смена на данные без сдвига.
 */
const DATA_ARRIVES = [
  {
    ...OPENED,
    title: 'Данные загружаются',
    hint: 'Вместо данных отображаются скелеты. Названия колонок уже известны заранее. Таблицу можно скроллить по горизонтали.',
  },
  {
    title: 'Иерархия данных',
    hint: 'Плагин rowExpandingModel и expanded: true — дерево придёт развёрнутым: у части строк скелета одна-две подстроки с отступом. Переключателя нет — кнопок раскрытия тоже.',
    props: () => ({ enableRowExpandingModel: true, expandAll: true }),
  },
  {
    title: 'Линии дерева',
    hint: 'Плагин treeLines — у скелета те же линии, что у дерева: поворот к подстроке, продолжение ветки к сестре, отросток у строки с подстроками. Кнопок по-прежнему нет.',
    props: () => ({ enableTreeLines: true }),
  },
  {
    title: 'Раскрытие строк',
    hint: 'Плагин rowExpanding — появляется колонка раскрытия со скелетами кнопок у строк с подстроками.',
    props: () => ({ enableRowExpanding: true }),
  },
  {
    ...ANSWERED,
    hint: 'Скелеты заменяются данными и кнопками.',
  },
] as const satisfies readonly GuideStoryStep[]

/**
 * Всё, что видно на скелете: служебные колонки (выбор, перетаскивание, действия;
 * раскрытие — шагом «Раскрытие строк»), закрепление, итоги, панели над таблицей и под ней.
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
} satisfies Partial<StoryProps>

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
  'enableQuickSearch',
]

/**
 * Скелет первой загрузки в покое — снимок каталога `body.skeleton`. Песочница фичи:
 * контролы всех её сценариев и `loading` — скелет, свечение обновления или данные.
 */
export const SkeletonDefault: StoryObj<StoryProps> = {
  name: 'Default',
  parameters: {
    ...vrStates('body.skeleton'),
    ...showControls(['loading', 'refreshOptions', ...DATA_ARRIVES_CONTROLS]),
  },
  args: { ...DATA_ARRIVES_ARGS, loading: 'initial' },
  render: args => <StoryComponent {...normalizeArgs(args)} />,
}

/**
 * S1: получение данных — скелет повторяет раскладку таблицы со служебными колонками,
 * итогами и панелями; с `tree` — развёрнутыми подстроками, с раскрытием строк —
 * квадратами раскрытия и, с `treeLines`, линиями дерева; пришли данные — всё на тех же
 * местах, без задержки (SL6, SL2, SL8). Функции включаются и выключаются в Controls.
 */
export const SkeletonDataArrives: StoryObj<StoryProps> = {
  name: 'Data arrives',
  parameters: {
    scenario: '0060/S1',
    requirements: ['SL6', 'SL2', 'SL8'],
    ...showControls(DATA_ARRIVES_CONTROLS),
  },
  args: DATA_ARRIVES_ARGS,
  argTypes: SKELETON_OPTIONS_CONTROL,
  render: args => (
    <GuideStory
      title="Получение данных"
      steps={DATA_ARRIVES}
      args={normalizeArgs(args)}
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
    let header: HTMLElement | undefined
    const byId = (part: string, row: HTMLElement) =>
      all(row, SKELETON_CELL).find(cell =>
        cell.dataset.columnId?.includes(part),
      )
    const square = async (shape: HTMLElement) => {
      await expect(box(shape).width).toBe(16)
      await expect(Math.round(shape.getBoundingClientRect().height)).toBe(16)
    }
    const expandCells = () =>
      skeletonRows(canvas).flatMap(row => byId('rowExpanding', row) ?? [])
    await step(DATA_ARRIVES[0].title, async () => {
      await waitSkeleton(canvas)
      const rows = skeletonRows(canvas)
      // SL2: выбор — квадрат, перетаскивание и действия — пустая ячейка.
      await square(shapeOf(byId('rowSelection', rows[0]!)!)!)
      for (const empty of ['rowDragging', 'rowActions']) {
        await expect(shapeOf(byId(empty, rows[0]!)!)).toBeNull()
      }
      await expect(expandCells()).toHaveLength(0)
      await expect(indented()).toBe(false)
    })
    await step(DATA_ARRIVES[1].title, async () => {
      await guideNext(canvas)
      await until(() => expect(indented()).toBe(true))
      await expect(expandCells()).toHaveLength(0)
      await expect(treeLines()).toBe(false)
    })
    await step(DATA_ARRIVES[2].title, async () => {
      await guideNext(canvas)
      await until(() => expect(treeLines()).toBe(true))
      await expect(expandCells()).toHaveLength(0)
    })
    await step(DATA_ARRIVES[3].title, async () => {
      await guideNext(canvas)
      await until(() => expect(expandCells().length).toBeGreaterThan(0))
      // SL2: раскрытие — квадрат у строк с подстроками (SL25).
      const shapes = expandCells().flatMap(cell => shapeOf(cell) ?? [])
      await expect(shapes.length).toBeGreaterThan(0)
      for (const shape of shapes) await square(shape)
      await expect(indented()).toBe(true)
      await expect(treeLines()).toBe(true)
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
      await expect(footerShapes.size).toBeGreaterThan(0)
    })
    await step(DATA_ARRIVES[4].title, async () => {
      // SL6, без задержки: ни одного состояния DOM без скелета и без строк.
      let empty = 0
      const observer = new MutationObserver(() => {
        if (!skeletonRows(canvas).length && !dataRows(canvas).length) empty++
      })
      observer.observe(canvas, { subtree: true, childList: true })
      await guideNext(canvas)
      observer.disconnect()
      await waitData(canvas)
      await expect(empty).toBe(0)
      // SL6 и SL2, без сдвига: те же заголовки, места и ширины колонок, служебных тоже.
      await expect(headCells(canvas)[0]).toBe(header)
      await expect(geometry(headCells(canvas))).toEqual(head)
      await expect(
        geometry(all(dataRows(canvas)[0]!, '.data-grid__body-cell')),
      ).toEqual(columns)
      // SL8: итоги — ровно в колонках, где был их скелет.
      const loaded = all(canvas, '.data-grid__footer-cell')
      await expect(geometry(loaded)).toEqual(footer)
      await expect(
        new Set(
          loaded
            .filter(cell => cell.textContent?.trim())
            .map(cell => cell.dataset.columnId!),
        ),
      ).toEqual(footerShapes)
      // Скелетов не осталось нигде, панели тоже.
      await expect(canvas.querySelector('[class*="skeleton" i]')).toBeNull()
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

const ROWS_COUNT: readonly GuideStoryStep[] = [
  {
    ...OPENED,
    title: 'Строки по высоте области',
    hint: "rowsCount: 'auto' (по умолчанию) — строк скелета столько, сколько помещается по высоте области; последняя может быть обрезана.",
  },
  {
    title: `Разбивка по ${PAGE_SIZE} строк`,
    hint: 'Таблица открыта заново с разбивкой на страницы: строк скелета не больше размера страницы, даже если помещается больше.',
    remount: true,
    props: () => ({
      enablePagination: true,
      paginationInitialPageSize: PAGE_SIZE,
    }),
  },
  {
    title: `Строки по ${TALL_ROW} px`,
    hint: `Строки выше (rowHeight: ${TALL_ROW}): помещается меньше страницы — строк скелета меньше, они по-прежнему доходят до низа.`,
    props: () => ({ rowHeight: TALL_ROW }),
  },
  {
    title: `Область ниже — ${LOW_AREA} px`,
    hint: 'Область меньше — строк меньше: расчёт идёт по высоте области прокрутки.',
    props: () => ({ height: LOW_AREA, maxHeight: LOW_AREA }),
  },
  {
    title: `Своё число строк — ${OWN_ROWS}`,
    hint: `skeletonOptions: { rowsCount: ${OWN_ROWS} } — ровно столько строк, даже если помещается больше: расчёт по высоте не нужен.`,
    props: () => ({ skeletonOptions: { rowsCount: OWN_ROWS } }),
  },
  {
    ...ANSWERED,
    hint: `Пришли ${OWN_ROWS} строки — столько, сколько приложение знало заранее и показало скелетом.`,
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
    ...showControls([], {
      columnCount: 'Число колонок на строки скелета не влияет',
      dataCount:
        'Строки данных приходят только в конце; сценарий — про строки скелета',
      defaultColumn: 'Ширина колонок на строки скелета не влияет',
    }),
  },
  args: { containerHeight: '800', height: '700', maxHeight: '700' },
  render: args => (
    <GuideStory
      title="Число строк скелета"
      steps={ROWS_COUNT}
      args={normalizeArgs(args)}
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
    await step(ROWS_COUNT[0]!.title, async () => {
      await waitSkeleton(canvas)
      byHeight = fit()
      await expect(byHeight).toBeGreaterThan(PAGE_SIZE)
      await expect(count()).toBe(byHeight)
      await fillsArea()
    })
    await step(ROWS_COUNT[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(count()).toBe(PAGE_SIZE))
    })
    let tall = 0
    await step(ROWS_COUNT[2]!.title, async () => {
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
    await step(ROWS_COUNT[3]!.title, async () => {
      await guideNext(canvas)
      await until(() => {
        expect(count()).toBe(fit())
        expect(count()).toBeLessThan(tall)
      })
      low = count()
      await fillsArea()
    })
    await step(ROWS_COUNT[4]!.title, async () => {
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
    await step(ROWS_COUNT[5]!.title, async () => {
      await guideNext(canvas)
      await waitData(canvas)
      await expect(dataRows(canvas)).toHaveLength(OWN_ROWS)
    })
    await settle()
  },
}

// --- S3 ------------------------------------------------------------------------------

const KNOWN_COLUMNS = 4
const DEFAULT_COLUMNS = 8

const COLUMNS_COUNT: readonly GuideStoryStep[] = [
  {
    ...OPENED,
    title: 'Колонки известны',
    hint: 'Скелет повторяет колонки таблицы — число, порядок, ширины; columnsCount не действует.',
  },
  {
    title: 'Колонки придут с сервера — их число известно',
    hint: 'columns: [] и skeletonOptions.columnsCount — столько одинаковых колонок на всю ширину.',
    props: () => ({ columnsOverride: [] }),
  },
  {
    title: 'Число колонок неизвестно',
    hint: `Без columnsCount — ${DEFAULT_COLUMNS} одинаковых колонок.`,
    props: ({ args }) => ({
      skeletonOptions: { ...args.skeletonOptions, columnsCount: undefined },
    }),
  },
  {
    title: 'Сервер прислал колонки и данные',
    hint: 'Скелет сменяется настоящими колонками и строками.',
    props: ({ rows }) => ({
      loading: false,
      columnsOverride: undefined,
      dataOverride: rows,
    }),
  },
]

/**
 * S3: число колонок скелета — известны колонки — как у таблицы; `columns: []` —
 * `columnsCount` одинаковых, без числа — 8 (SL9).
 */
export const SkeletonColumnsCount: StoryObj<StoryProps> = {
  name: 'Columns count',
  parameters: {
    scenario: '0060/S3',
    requirements: ['SL9'],
    ...showControls(['skeletonOptions'], {
      dataCount:
        'Строки данных приходят только в конце; сценарий — про колонки скелета',
      containerHeight: 'Высота области задана историей: сценарий — про колонки',
      height: 'Высота таблицы задана историей: сценарий — про колонки',
      maxHeight: 'Высота таблицы задана историей: сценарий — про колонки',
      rowHeight: 'Высота строк на колонки скелета не влияет',
      headerHeight: 'Высота шапки на колонки скелета не влияет',
      defaultColumn:
        'Ширина колонок таблицы видна на первом шаге и без контрола',
    }),
  },
  args: {
    columnCount: 6,
    skeletonOptions: { rowsCount: 'auto', columnsCount: KNOWN_COLUMNS },
  },
  argTypes: SKELETON_OPTIONS_CONTROL,
  render: args => (
    <GuideStory
      title="Число колонок скелета"
      steps={COLUMNS_COUNT}
      args={{ ...normalizeArgs(args), ...FIXED_HEIGHT }}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const cells = () => all(skeletonRows(canvas)[0]!, SKELETON_CELL)
    const widths = () => cells().map(cell => box(cell).width)
    await step(COLUMNS_COUNT[0]!.title, async () => {
      await waitSkeleton(canvas)
      // Колонки таблицы, а не columnsCount: те же id, что у заголовков.
      await expect(cells().map(cell => cell.dataset.columnId)).toEqual(
        headCells(canvas).map(cell => cell.dataset.columnId),
      )
      await expect(cells().length).not.toBe(KNOWN_COLUMNS)
    })
    await step(COLUMNS_COUNT[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(widths()).toHaveLength(KNOWN_COLUMNS))
      await expect(new Set(widths()).size).toBe(1)
    })
    await step(COLUMNS_COUNT[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(widths()).toHaveLength(DEFAULT_COLUMNS))
      await expect(new Set(widths()).size).toBe(1)
    })
    await step(COLUMNS_COUNT[3]!.title, async () => {
      await guideNext(canvas)
      await waitData(canvas)
    })
    await settle()
  },
}
