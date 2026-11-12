import { useState } from 'react'
import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'

import { definePlugin } from '../core/definePlugin'
import type { StoryProps } from './DataGridStory.types'
import { StoryComponent } from './DataGridStory'
import { dataGridMeta } from './dataGridMeta'
import {
  afterRows,
  centerOf,
  guideNext,
  headCell,
  headKebab,
  pollUntil,
  settle,
  stepDone,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import { untilDone } from './__mocks__/cellGestures'
import { holdGrip, separatorOf } from './__mocks__/columnGrip'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import {
  GuideStory,
  type GuideStoryStep,
  type StepRun,
  guideArgs,
  stepAction,
} from './demos/GuideStory'
import { WithConsole } from './demos/StoryConsole'
import { createConsoleLog } from './demos/consoleLog'

/**
 * Ширина колонок (ADR 0013, ADR 0111): протяжка ручки на границе заголовков, кнопки
 * заголовка уходят в меню узкой колонки; ширина по умолчанию от приложения (ADR 0077).
 * `Playground` — песочница, остальное — сценарии.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Columns/Resizing',
} satisfies Meta<StoryProps>

export default meta

const NOT_COLUMNS = 'На ширину колонок не влияет'

/** Колонки с ручкой ширины на границе заголовков в покое. */
export const ColumnResizingPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  parameters: showControls(
    [
      'enableColumnSizing',
      'columnSizingAutosizeOnData',
      'enableColumnSorting',
      'enableHeaderActionMenu',
    ],
    { rowHeight: NOT_COLUMNS, headerHeight: NOT_COLUMNS },
  ),
  args: {
    enableColumnSizing: true,
    dataCount: 30,
    containerHeight: '400',
    height: '300',
    maxHeight: '300',
  },
  render: function Render(args) {
    const [consoleLog] = useState(createConsoleLog)
    return (
      <WithConsole log={consoleLog} args={args}>
        <StoryComponent {...normalizeArgs(args)} />
      </WithConsole>
    )
  },
}

// --- Общее для шагов ------------------------------------------------------------------

const HEAD = '.data-grid__head-cell[data-column-id]'

const rect = (element: Element) => element.getBoundingClientRect()

interface SizingApi {
  setColumnSizing: (sizing: Record<string, number>) => void
}

let sizingApi: SizingApi | null = null

/** Отдаёт таблицу шагам истории — ширину меняют, как протяжкой ручки. */
const columnSizingHost = definePlugin<{ enabled?: boolean }>()({
  id: 'resizingColumnSizingHost',
  setup: () => table => {
    sizingApi = table as unknown as SizingApi
    return () => {
      sizingApi = null
    }
  },
})

/** Ширина колонок шага: таблица отдаёт её, когда готова. */
const withWidths = (sizing: Record<string, number>) =>
  afterRows((_, signal) => {
    let tries = 0
    const run = () => {
      if (signal.aborted) return
      if (sizingApi) sizingApi.setColumnSizing(sizing)
      else if (++tries < 40) setTimeout(run, 50)
    }
    run()
  })

// --- ADR 0013 S1: ширина колонки ------------------------------------------------------

const RESIZED = 'firstName'
/** Шире — кнопки заголовка помещаются; уже — минимальная ширина колонки. */
const START = 310
const WIDE = 420
const NARROW = 150
/** Насколько шаг протяжки уводит ручку вправо: до краевой зоны автопрокрутки не доходит. */
const HOLD_SHIFT = 80

const GRIP = '.resize__handler--column'
/** Линия границы колонки при протяжке (ADR 0197). */
const RESIZE_LINE = '[data-column-resize-line]:not([hidden])'

/** Шаг ADR 0197, RL12: ручку First Name тянут вправо, не доходя до краевой зоны. */
const holdResize = async (root: HTMLElement, step: StepRun) => {
  await pollUntil(() => !!sizingApi, step.signal)
  sizingApi!.setColumnSizing({ [RESIZED]: START })
  await pollUntil(
    () => Math.round(rect(headCell(root, RESIZED)).width) === START,
    step.signal,
  )
  await holdGrip(root, step, RESIZED, from => from.x + HOLD_SHIFT)
  await pollUntil(() => !!root.querySelector(RESIZE_LINE), step.signal)
}

const RESIZE: readonly GuideStoryStep[] = [
  {
    title: 'Колонки в таблице',
    hint: 'Таблица отображает колонки с ручкой изменения ширины на границе заголовков. Ручка появляется при наведении на заголовок.',
    enter: withWidths({ [RESIZED]: START }),
  },
  {
    title: 'Пользователь тянет ручку',
    hint: 'Пользователь нажал на ручку ширины и тянет её вправо. От ручки вниз через всю таблицу идёт синяя линия: она показывает, где встанет граница колонки относительно значений в строках.',
    states: ['head.resizeLine'],
    enter: stepAction(holdResize),
  },
  {
    title: 'Пользователь растянул колонку',
    hint: 'Пользователь потянул ручку на границе колонок. Колонка стала шире, а колонки правее сдвинулись вслед за её краем.',
    enter: withWidths({ [RESIZED]: WIDE }),
  },
  {
    title: 'Пользователь сузил колонку',
    hint: 'Колонка стала уже, и кнопкам заголовка не хватает места: они уходят в меню колонки.',
    enter: withWidths({ [RESIZED]: NARROW }),
  },
]

/** ADR 0013, S1: пользователь меняет ширину колонки — соседи сдвигаются, кнопки уходят в меню. */
export const ResizingColumns: StoryObj<StoryProps> = {
  name: 'Resize columns',
  parameters: {
    scenario: '0013/S1',
    requirements: ['GB9', 'RL12'],
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Ширина колонки"
      steps={RESIZE}
      args={guideArgs(
        {
          enableColumnSizing: true,
          enableColumnSorting: true,
          enableColumnFiltering: true,
          enableColumnPinning: true,
          enableHeaderActionMenu: true,
          headerActionMenuThreshold: 10,
          extraPlugins: [columnSizingHost()],
          columnCount: 4,
          dataCount: 20,
          height: '360',
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    // В Storybook сценарий проходит человек; `play` — только в тестах каталога.
    if (globals.catalog !== true) return
    const width = () => Math.round(rect(headCell(canvas, RESIZED)).width)
    const kebab = () => headKebab(canvas, RESIZED)
    // Кнопка сортировки в ряду заголовка: в узкой колонке она уходит в кебаб (GB6).
    const sortInline = () =>
      headCell(canvas, RESIZED).querySelector('.column-sort__button')
    let neighbour = 0
    await step(RESIZE[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() =>
        expect(
          headCell(canvas, RESIZED).querySelector('.resize__handler--column'),
        ).not.toBeNull(),
      )
      await until(() => expect(width()).toBe(START))
      await until(() => expect(sortInline()).not.toBeNull())
      neighbour = rect(headCell(canvas, 'lastName')).left
    })
    await step(RESIZE[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      // Линия идёт от ручки вниз через всю таблицу — от верха заголовка ниже строк.
      const line = document.querySelector<HTMLElement>(RESIZE_LINE)!
      await expect(line).not.toBeNull()
      const head = rect(headCell(canvas, RESIZED))
      const stroke = rect(
        headCell(canvas, RESIZED).querySelector(`${GRIP} [role="separator"]`)!,
      )
      // Низ видимой части таблицы: последняя видимая строка, не ниже области прокрутки.
      const scroller = canvas.querySelector<HTMLElement>(
        '.data-grid__container',
      )!
      const area =
        rect(scroller).top + scroller.clientTop + scroller.clientHeight
      const rows = [...canvas.querySelectorAll('.data-grid__body-row')]
      const visibleBottom = Math.min(
        area,
        Math.max(...rows.map(row => rect(row).bottom)),
      )
      await expect(Math.abs(rect(line).top - head.top)).toBeLessThanOrEqual(1)
      await expect(
        Math.abs(rect(line).bottom - visibleBottom),
      ).toBeLessThanOrEqual(1)
      await expect(
        Math.abs(
          rect(line).left +
            rect(line).width / 2 -
            (stroke.left + stroke.width / 2),
        ),
      ).toBeLessThanOrEqual(1)
      // Ручку тянут вправо: колонка шире исходной.
      await expect(width()).toBe(START + HOLD_SHIFT)
    })
    await step(RESIZE[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(document.querySelector(RESIZE_LINE)).toBeNull())
      await until(() => expect(width()).toBe(WIDE))
      await expect(rect(headCell(canvas, 'lastName')).left).toBeGreaterThan(
        neighbour,
      )
      await settle()
    })
    await step(RESIZE[3]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(width()).toBe(NARROW))
      await until(() => expect(sortInline()).toBeNull())
      await expect(kebab()).not.toBeNull()
      await settle()
    })
  },
}

// --- ADR 0197 S1: протяжка за край области ------------------------------------------

const scrollerOf = (root: ParentNode) =>
  root.querySelector<HTMLElement>('.data-grid__container')!

/** Правый край видимой области прокрутки. */
const areaRight = (scroller: HTMLElement) =>
  rect(scroller).left + scroller.clientLeft + scroller.clientWidth

/** Указатель держат в краевой зоне автопрокрутки, у самого края. */
const EDGE_GAP = 8

/** Колонка, которую тянут за край, — самая правая, видимая целиком у начала таблицы. */
let edgeColumn: string | null = null

const widthOf = (root: HTMLElement, id: string) =>
  Math.round(rect(headCell(root, id)).width)
const maxOf = (root: ParentNode, id: string) =>
  Number(separatorOf(root, id)?.getAttribute('aria-valuemax'))

/** Ширины по умолчанию, таблица у начала. */
const resetEdge = afterRows(root => {
  sizingApi?.setColumnSizing({})
  scrollerOf(root).scrollLeft = 0
})

/** Тянуть ручку к правому краю и держать, пока колонка не дорастёт до наибольшей ширины. */
const holdAtEdge = async (root: HTMLElement, step: StepRun) => {
  await pollUntil(() => !!sizingApi, step.signal)
  sizingApi!.setColumnSizing({})
  const scroller = scrollerOf(root)
  scroller.scrollLeft = 0
  await pollUntil(() => !!root.querySelector(`${HEAD} ${GRIP}`), step.signal)
  const right = areaRight(scroller)
  const id = [...root.querySelectorAll<HTMLElement>(HEAD)]
    .filter(cell => cell.querySelector(GRIP) && rect(cell).right < right - 60)
    .sort((a, b) => rect(a).left - rect(b).left)
    .at(-1)!.dataset.columnId!
  edgeColumn = id
  const held = await holdGrip(root, step, id, () => right - EDGE_GAP)
  await pollUntil(() => widthOf(root, id) >= maxOf(root, id), step.signal)
  return held
}

const PAST_EDGE: readonly GuideStoryStep[] = [
  {
    title: 'Колонки за краем',
    hint: 'Таблица шире видимой области: часть колонок справа скрыта, к ним прокручивают по горизонтали.',
    enter: resetEdge,
  },
  {
    title: 'Пользователь тянет ручку к краю',
    hint: 'Пользователь тянет ручку ширины к правому краю таблицы и держит её там. Таблица сама прокручивается вправо, колонка растёт, а граница остаётся под указателем, пока колонка не достигнет наибольшей ширины.',
    states: ['head.resizeLine'],
    enter: stepAction(async (root, step) => {
      await holdAtEdge(root, step)
    }),
  },
  {
    title: 'Пользователь отпустил ручку',
    hint: 'Пользователь отпустил ручку. Колонка осталась новой ширины, а таблица — там, куда её прокрутила протяжка.',
    // С прошлого шага ручку отпускает уход с него; переход сразу сюда тянет и отпускает сам.
    enter: stepAction(async (root, step) => {
      const id = edgeColumn
      if (
        id &&
        scrollerOf(root).scrollLeft > 0 &&
        widthOf(root, id) >= maxOf(root, id)
      ) {
        return
      }
      const held = await holdAtEdge(root, step)
      held.release()
    }),
  },
]

/** ADR 0197, S1: ручку тянут за край области — таблица прокручивается, колонка растёт. */
export const ResizingPastEdge: StoryObj<StoryProps> = {
  name: 'Resize past the edge',
  parameters: {
    scenario: '0197/S1',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Протяжка за край"
      steps={PAST_EDGE}
      args={guideArgs(
        {
          enableColumnSizing: true,
          extraPlugins: [columnSizingHost()],
          columnCount: 12,
          dataCount: 20,
          height: '360',
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    // В Storybook сценарий проходит человек; `play` — только в тестах каталога.
    if (globals.catalog !== true) return
    const scroller = () => scrollerOf(canvas)
    await step(PAST_EDGE[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() =>
        expect(scroller().scrollWidth).toBeGreaterThan(scroller().clientWidth),
      )
      await until(() => expect(scroller().scrollLeft).toBe(0))
    })
    let scrolled = 0
    await step(PAST_EDGE[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      const id = edgeColumn!
      // Таблица прокрутилась, колонка дорасла до наибольшей ширины, граница у указателя.
      await expect(scroller().scrollLeft).toBeGreaterThan(0)
      await expect(widthOf(canvas, id)).toBe(maxOf(canvas, id))
      await expect(
        Math.abs(
          rect(headCell(canvas, id)).right - (areaRight(scroller()) - EDGE_GAP),
        ),
      ).toBeLessThanOrEqual(2)
      await until(() =>
        expect(document.querySelector(RESIZE_LINE)).not.toBeNull(),
      )
      scrolled = scroller().scrollLeft
    })
    await step(PAST_EDGE[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      const id = edgeColumn!
      // Отпущено: линии нет, ширина и прокрутка те же.
      await until(() => expect(document.querySelector(RESIZE_LINE)).toBeNull())
      await expect(widthOf(canvas, id)).toBe(maxOf(canvas, id))
      await expect(scroller().scrollLeft).toBe(scrolled)
      await settle()
    })
  },
}

// --- ADR 0077 S3: ширина колонок по умолчанию -----------------------------------------

const STRETCHED = 320

const COLUMNS: readonly GuideStoryStep[] = [
  {
    title: 'Ширина по умолчанию',
    hint: 'Приложение задало ширину колонок по умолчанию. Колонки без своей ширины получили её, а колонка со своей шириной осталась прежней.',
  },
  {
    title: 'Пользователь растянул колонку',
    hint: 'Пользователь растянул одну из колонок шире остальных.',
    enter: withWidths({ name: STRETCHED }),
  },
  {
    title: 'Новая ширина по умолчанию',
    hint: 'Приложение уменьшило ширину по умолчанию. Сузилась только колонка без своей ширины: растянутая пользователем и колонка со своей шириной не изменились.',
    props: () => ({ defaultColumn: { size: 140 } }),
    enter: withWidths({ name: STRETCHED }),
  },
]

const DEFAULT_COLUMN_WIDTH_ARGS = {
  defaultColumn: { size: 220 },
  columnsOverride: [
    { id: 'name', accessorKey: 'name', header: 'Name' },
    { id: 'company', accessorKey: 'company', header: 'Company' },
    { id: 'city', accessorKey: 'city', header: 'City', size: 100 },
  ],
  dataOverride: [
    { id: '1', name: 'Ann', company: 'Acme', city: 'Oslo' },
    { id: '2', name: 'Bob', company: 'Globex', city: 'Rome' },
  ],
  enableColumnSizing: true,
  extraPlugins: [columnSizingHost()],
} satisfies Partial<StoryProps>

/** ADR 0077, S3: ширина колонок по умолчанию и её смена — растянутые остаются. */
export const ResizingDefaultColumnWidth: StoryObj<StoryProps> = {
  name: 'Default column width',
  parameters: {
    scenario: '0077/S3',
    requirements: ['CW3'],
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Ширина колонок по умолчанию"
      steps={COLUMNS}
      args={guideArgs(DEFAULT_COLUMN_WIDTH_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const widths = () =>
      ['name', 'company', 'city'].map(id =>
        Math.round(rect(headCell(canvas, id)).width),
      )
    await step(COLUMNS[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(sizingApi).not.toBeNull())
      await until(() => expect(widths()).toEqual([220, 220, 100]))
    })
    await step(COLUMNS[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(widths()).toEqual([STRETCHED, 220, 100]))
    })
    await step(COLUMNS[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(widths()).toEqual([STRETCHED, 140, 100]))
    })
    await settle()
  },
}

// --- ADR 0217 S1: подгонка по содержимому ---------------------------------------------

/** Колонки и строки гайда: значения разной длины. */
const FIT_COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name' },
  { id: 'company', accessorKey: 'company', header: 'Company' },
  { id: 'city', accessorKey: 'city', header: 'City' },
]
const FIT_ROWS = Array.from({ length: 20 }, (_, index) => ({
  id: String(index),
  name: index === 2 ? 'Annabelle Featherstonehaugh' : 'Person ' + index,
  company: index === 4 ? 'Northwind Logistics International' : 'Acme',
  city: index % 2 ? 'Oslo' : 'Lisbon',
}))

/** Имя и компания узкие — текст обрезан многоточием; город шире своего текста. */
const NARROW_WIDTHS = { name: 70, company: 70, city: 160 }

/** Все колонки по содержимому: узкие расширились, широкая сузилась. */
const allFitted = (root: HTMLElement) =>
  fittedWidth(root, 'name') > NARROW_WIDTHS.name &&
  fittedWidth(root, 'company') > NARROW_WIDTHS.company &&
  fittedWidth(root, 'city') < NARROW_WIDTHS.city

const fittedWidth = (root: HTMLElement, id: string) =>
  Math.round(rect(headCell(root, id)).width)

/** Шаг из любого состояния: сначала узкие колонки, затем действие пользователя. */
const fromNarrow =
  (
    done: (root: HTMLElement) => boolean,
    act: (root: HTMLElement) => void,
  ): GuideStoryStep['enter'] =>
  (root, app) => {
    let narrowed = false
    return untilDone(done, current => {
      if (!sizingApi) return
      if (!narrowed) {
        sizingApi.setColumnSizing(NARROW_WIDTHS)
        narrowed = true
      } else act(current)
    })(root, app)
  }

const dblclickGrip = (root: HTMLElement, id: string) =>
  headCell(root, id)
    .querySelector('.resize__handler--column')
    ?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))

const autosizeAllItem = () =>
  document.querySelector<HTMLElement>(
    '[role="menuitem"][data-action-id="columnSizing.autosizeAll"]',
  )

const AUTOSIZE: readonly GuideStoryStep[] = [
  {
    title: 'Колонки обрезают текст',
    hint: 'Имя и компания не помещаются в узкие колонки и обрезаны многоточием, а колонка города шире своего текста.',
    enter: withWidths(NARROW_WIDTHS),
  },
  {
    title: 'Пользователь дважды щёлкнул по ручке',
    hint: 'Пользователь дважды щёлкнул по ручке на границе первой колонки. Колонка стала шириной по самому длинному значению среди видимых строк, остальные остались прежними.',
    enter: fromNarrow(
      root =>
        fittedWidth(root, 'name') > NARROW_WIDTHS.name &&
        fittedWidth(root, 'company') === NARROW_WIDTHS.company,
      root => dblclickGrip(root, 'name'),
    ),
  },
  {
    title: 'Пользователь подогнал все колонки',
    hint: 'Пользователь выбрал в меню колонки «Подогнать все колонки»: каждая колонка стала шириной по своему содержимому — узкие расширились, слишком широкая сузилась.',
    enter: fromNarrow(
      root => allFitted(root) && !autosizeAllItem(),
      root => {
        const item = autosizeAllItem()
        if (item) item.click()
        else headKebab(root, 'city')?.click()
      },
    ),
  },
]

/** ADR 0217, S1: двойной клик по ручке подгоняет колонку, пункт кебаба — все колонки. */
export const AutosizeColumns: StoryObj<StoryProps> = {
  name: 'Autosize columns',
  parameters: { scenario: '0217/S1', ...guideControls() },
  render: args => (
    <GuideStory
      title="Ширина по содержимому"
      steps={AUTOSIZE}
      args={guideArgs(
        {
          enableColumnSizing: true,
          enableHeaderActionMenu: true,
          extraPlugins: [columnSizingHost()],
          columnsOverride: FIT_COLUMNS as never,
          dataOverride: FIT_ROWS,
          height: '360',
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(AUTOSIZE[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() =>
        expect(fittedWidth(canvas, 'name')).toBe(NARROW_WIDTHS.name),
      )
    })
    await step(AUTOSIZE[1]!.title, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(fittedWidth(canvas, 'name')).toBeGreaterThan(NARROW_WIDTHS.name),
      )
      await expect(fittedWidth(canvas, 'company')).toBe(NARROW_WIDTHS.company)
      await settle()
    })
    await step(AUTOSIZE[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(allFitted(canvas)).toBe(true))
      await until(() => expect(autosizeAllItem()).toBeNull())
      await settle()
    })
  },
}

// --- ADR 0217 S2: подгонка при приходе данных -----------------------------------------

const DATA_COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name' },
  { id: 'city', accessorKey: 'city', header: 'City' },
]

const rowsOf = (names: string[]) =>
  names.map((name, index) => ({
    id: String(index),
    name,
    city: index % 2 ? 'Oslo' : 'Lisbon',
  }))

const SHORT = rowsOf(['Ann', 'Bob', 'Eve', 'Kim', 'Lee'])
const LONG = rowsOf([
  'Annabelle Featherstonehaugh',
  'Bob',
  'Evelyn Montgomery-Smythe',
  'Kim',
  'Lee',
])

const ON_DATA: readonly GuideStoryStep[] = [
  {
    title: 'Данные пришли',
    hint: 'Таблица получила данные и сама подогнала колонки по содержимому: имена короткие — колонка узкая.',
    props: () => ({ dataOverride: SHORT }),
  },
  {
    title: 'Пришли новые данные',
    hint: 'Приложение передало новые данные с длинными именами. Таблица снова подогнала колонку — теперь она шире.',
    props: () => ({ dataOverride: LONG }),
  },
]

/** ADR 0217, S2: колонки подгоняются по содержимому при приходе данных и на новых данных. */
export const AutosizeOnData: StoryObj<StoryProps> = {
  name: 'Autosize on data',
  parameters: { scenario: '0217/S2', ...guideControls() },
  render: args => (
    <GuideStory
      title="Подгонка при приходе данных"
      steps={ON_DATA}
      args={guideArgs(
        {
          enableColumnSizing: true,
          columnSizingAutosizeOnData: true,
          columnsOverride: DATA_COLUMNS as never,
          height: '300',
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    let short = 0
    await step(ON_DATA[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(fittedWidth(canvas, 'name')).toBeLessThan(150))
      short = fittedWidth(canvas, 'name')
    })
    await step(ON_DATA[1]!.title, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(fittedWidth(canvas, 'name')).toBeGreaterThan(short + 50),
      )
      await settle()
    })
  },
}
