import { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { expect, spyOn } from 'storybook/test'

import { __resetLogger } from '../util/logger'
import { DATA_GRID_THEME_CLASS } from '../ui/theme'
import { StoryComponent } from './DataGridStory'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import {
  consoleText,
  guideNext,
  settle,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { DemoStory, type DemoStoryStep, guideArgs } from './demos/DemoStory'
import { WithConsole } from './demos/StoryConsole'
import { createConsoleLog } from './demos/consoleLog'
import { shellText } from './demos/storyShell'

/**
 * Геометрия таблицы от приложения: высота на странице (ADR 0131, S1–S4), высота строк и
 * шапки (ADR 0077, S1, S2, S4). Сценарий проигрывается панелью над гридом, в тестах шаги
 * проходит `play` (ADR 0117); консоль — под гридом (ADR 0124).
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Core/Sizing',
} satisfies Meta<StoryProps>

export default meta

/**
 * Таблица в покое в рамке контейнера приложения. Высота контейнера, `height`,
 * `maxHeight`, `rowHeight` и `headerHeight` — в Controls, на лету; футер — с высотой строк.
 */
export const SizingPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  parameters: showControls(['enableFooter'], {
    columnCount: 'The number of columns does not affect the height',
    defaultColumn: 'The default column width is covered in Columns/Resizing',
  }),
  args: {
    enableFooter: true,
    dataCount: 200,
    containerHeight: '560',
    height: '460',
  },
  render: function Render(args) {
    // Консоль песочницы (ADR 0124): журнал живёт, пока открыта история.
    const [consoleLog] = useState(createConsoleLog)
    return (
      <WithConsole log={consoleLog} args={args}>
        <StoryComponent {...normalizeArgs(args)} containerFrame />
      </WithConsole>
    )
  },
}

// --- Чтение грида в `play` и шагах -------------------------------------------------

const rect = (element: Element) => element.getBoundingClientRect()
const near = (actual: number, expected: number) =>
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1)
const containerOf = (root: ParentNode) =>
  root.querySelector<HTMLElement>('[data-testid="app-container"]')!
const gridOf = (root: ParentNode) =>
  containerOf(root).querySelector<HTMLElement>(`.${DATA_GRID_THEME_CLASS}`)!
const scrollerOf = (root: ParentNode) =>
  root.querySelector<HTMLElement>('.data-grid__container')!
const bodyOf = (root: ParentNode) => root.querySelector('.data-grid__body')
const headOf = (root: ParentNode) =>
  root.querySelector<HTMLElement>('.data-grid__head')!
const footerOf = (root: ParentNode) =>
  root.querySelector<HTMLElement>('.data-grid__footer')!
const rowsOf = (root: ParentNode) => [
  ...root.querySelectorAll<HTMLElement>('.data-grid__body-row'),
]
const rowHeights = (root: ParentNode) =>
  new Set(rowsOf(root).map(row => Math.round(rect(row).height)))
const scrolls = (root: ParentNode) => {
  const scroller = scrollerOf(root)
  return scroller.scrollHeight > scroller.clientHeight
}
/** Строки, видимые в области прокрутки хотя бы частью. */
const rowsInView = (root: ParentNode) => {
  const area = rect(scrollerOf(root))
  return rowsOf(root).filter(row => {
    const box = rect(row)
    return box.bottom > area.top && box.top < area.bottom
  }).length
}
/** Строки, видимые целиком между шапкой и футером. */
const visibleRows = (root: ParentNode) => {
  const top = rect(headOf(root)).bottom
  const bottom = rect(footerOf(root)).top
  return rowsOf(root).filter(
    row => rect(row).top >= top - 1 && rect(row).bottom <= bottom + 1,
  ).length
}
/** Номер первой строки у верха области — под шапкой. */
const firstShown = (root: ParentNode) => {
  const top = rect(headOf(root)).bottom
  return (
    rowsOf(root)
      .filter(row => rect(row).bottom > top + 1)
      .sort((a, b) => rect(a).top - rect(b).top)[0]
      ?.getAttribute('data-index') ?? undefined
  )
}

/** Ячейка в фокусе — активная ячейка клавиатурной навигации. */
const focusedCell = (root: ParentNode) => {
  const active = root.querySelector<HTMLElement>(
    '.data-grid__body-cell[data-kn-cell][data-kn-active="true"]',
  )
  return active && document.activeElement === active ? active : null
}
const rowIndexOf = (cell: Element | null) =>
  Number(cell?.closest('.data-grid__body-row')?.getAttribute('data-index'))

/** Пользователь встал на ячейку первой строки экрана и нажал клавишу листания вниз. */
const pageDown = (root: HTMLElement) => {
  let start: number | undefined
  const run = () => {
    const focused = focusedCell(root)
    if (start !== undefined && rowIndexOf(focused) > start) return
    if (!focused) {
      const first = firstShown(root)
      root
        .querySelector<HTMLElement>(
          `.data-grid__body-row[data-index="${first}"] .data-grid__body-cell[data-kn-cell]`,
        )
        ?.focus()
    } else {
      start ??= rowIndexOf(focused)
      focused.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'PageDown',
          bubbles: true,
          cancelable: true,
        }),
      )
    }
    setTimeout(run, 80)
  }
  setTimeout(run, 0)
}

const recreated = () => {
  const text = consoleText()
  return (
    text.includes(shellText('ru', 'lifecycleRecreated')) ||
    text.includes(shellText('en', 'lifecycleRecreated'))
  )
}

/** Действие шага — после отрисовки строк: первый шаг входит при монтировании грида. */
const afterRows =
  (action: (root: HTMLElement) => void) => (root: HTMLElement) => {
    const run = () =>
      root.querySelector('.data-grid__body-row')
        ? action(root)
        : requestAnimationFrame(run)
    requestAnimationFrame(run)
  }

const scrollToMiddle = afterRows(root => {
  const scroller = scrollerOf(root)
  scroller.scrollTop = (scroller.scrollHeight - scroller.clientHeight) / 2
})

// --- ADR 0131 S1 ---------------------------------------------------------------------

const FIXED: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Своя высота таблицы', en: 'The table height of its own' },
    hint: {
      ru: 'Приложение задало таблице высоту — строки, которые не поместились, прокручиваются внутри.',
      en: 'The app set the table height; rows that do not fit scroll inside it.',
    },
  },
  {
    title: { ru: 'Строк стало меньше', en: 'Fewer rows' },
    hint: {
      ru: 'Осталось три строки — высота таблицы та же, страница не прыгает.',
      en: 'Three rows are left; the table height stays the same, and the page does not jump.',
    },
    props: () => ({ dataCount: 3 }),
  },
]

const FIXED_HEIGHT_ARGS = {
  containerFrame: true,
  containerHeight: '600',
  height: '300',
  dataCount: 100,
} satisfies Partial<StoryProps>

/** ADR 0131, S1: таблица фиксированной высоты — от контейнера и строк не зависит. */
export const SizingFixedHeight: StoryObj<StoryProps> = {
  name: 'Fixed height',
  parameters: {
    scenario: '0131/S1',
    requirements: ['GH1'],
    ...guideControls(),
  },
  render: args => (
    <DemoStory
      title={{ ru: 'Таблица фиксированной высоты', en: 'A fixed-height table' }}
      steps={FIXED}
      args={guideArgs(FIXED_HEIGHT_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    // В Storybook сценарий проходит человек; `play` — только в тестах каталога.
    if (globals.catalog !== true) return
    await step(FIXED[0].title.ru, async () => {
      await waitForRows(canvas)
      await until(() => near(rect(gridOf(canvas)).height, 300))
      await expect(rect(containerOf(canvas)).height).toBe(600)
      await expect(scrolls(canvas)).toBe(true)
    })
    await step(FIXED[1].title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(rowsOf(canvas)).toHaveLength(3))
      near(rect(gridOf(canvas)).height, 300)
      await until(() => expect(scrolls(canvas)).toBe(false))
    })
    await settle()
  },
}

// --- ADR 0131 S2 ---------------------------------------------------------------------

const FILL: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Вся высота блока', en: 'The full block height' },
    hint: {
      ru: 'Таблица занимает весь блок страницы.',
      en: 'The table fills the whole page block.',
    },
  },
  {
    title: { ru: 'Блок вырос', en: 'The block grew' },
    hint: {
      ru: 'Блок страницы стал выше — таблица выросла вместе с ним и показывает больше строк.',
      en: 'The page block got taller; the table grew with it and shows more rows.',
    },
    props: () => ({ containerHeight: '600' }),
  },
  {
    title: { ru: 'Половина блока', en: 'Half of the block' },
    hint: {
      ru: 'Таблица занимает половину блока.',
      en: 'The table takes up half of the block.',
    },
    props: () => ({ height: '50%' }),
  },
]

const FILL_CONTAINER_ARGS = {
  containerFrame: true,
  containerHeight: '400',
  height: '100%',
  dataCount: 100,
} satisfies Partial<StoryProps>

/** ADR 0131, S2: высота в процентах — таблица следует за контейнером. */
export const SizingFillContainer: StoryObj<StoryProps> = {
  name: 'Fill container',
  parameters: {
    scenario: '0131/S2',
    requirements: ['GH2'],
    ...guideControls(),
  },
  render: args => (
    <DemoStory
      title={{
        ru: 'Таблица по высоте контейнера',
        en: 'A table as tall as its container',
      }}
      steps={FILL}
      args={guideArgs(FILL_CONTAINER_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    let body: Element | null = null
    let rows = 0
    await step(FILL[0].title.ru, async () => {
      await waitForRows(canvas)
      await until(() => near(rect(gridOf(canvas)).height, 400))
      near(rect(containerOf(canvas)).height, 400)
      body = bodyOf(canvas)
      // Видимые строки: полоса окна (ADR 0202) держит запас и монтирует их заранее.
      rows = rowsInView(canvas)
    })
    await step(FILL[1].title.ru, async () => {
      await guideNext(canvas)
      await until(() => near(rect(gridOf(canvas)).height, 600))
      near(rect(containerOf(canvas)).height, 600)
      await until(() => expect(rowsInView(canvas)).toBeGreaterThan(rows))
      await until(() => expect(bodyOf(canvas)).toBe(body))
      await until(() => expect(recreated()).toBe(false))
    })
    await step(FILL[2].title.ru, async () => {
      await guideNext(canvas)
      await until(() => near(rect(gridOf(canvas)).height, 300))
      near(rect(containerOf(canvas)).height, 600)
    })
    await settle()
  },
}

// --- ADR 0131 S3 ---------------------------------------------------------------------

const PANEL = 80
const PANEL_GROWN = 200

const FLEX: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Таблица под панелью', en: 'The table below a panel' },
    hint: {
      ru: 'Над таблицей — панель приложения. Таблица занимает остаток блока до его низа, даже когда строк мало.',
      en: 'An app panel sits above the table. The table takes up the rest of the block down to its bottom, even when there are few rows.',
    },
  },
  {
    title: { ru: 'Панель выросла', en: 'The panel grew' },
    hint: {
      ru: 'Панель стала выше — таблица уменьшилась на столько же, её низ остался у низа блока.',
      en: 'The panel got taller; the table shrank by the same amount, and its bottom stayed at the bottom of the block.',
    },
    props: () => ({ appPanelHeight: PANEL_GROWN }),
  },
]

const FLEX_LAYOUT_ARGS = {
  containerFrame: true,
  appPanelHeight: PANEL,
  containerHeight: '600',
  height: 'auto',
  // Строк меньше, чем места: по строкам таблица до низа контейнера не дошла бы.
  dataCount: 5,
} satisfies Partial<StoryProps>

/** ADR 0131, S3: `height: 'auto'` — остаток flex-колонки под панелью приложения. */
export const SizingFlexLayout: StoryObj<StoryProps> = {
  name: 'Flex layout',
  parameters: {
    scenario: '0131/S3',
    requirements: ['GH3'],
    ...guideControls(),
  },
  render: args => (
    <DemoStory
      title={{
        ru: 'Таблица в раскладке страницы',
        en: 'A table in the page layout',
      }}
      steps={FLEX}
      args={guideArgs(FLEX_LAYOUT_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const panel = () =>
      canvas.querySelector<HTMLElement>('[data-testid="app-panel"]')!
    const fitsBelowPanel = () => {
      near(rect(gridOf(canvas)).top, rect(panel()).bottom + 8)
      near(rect(gridOf(canvas)).bottom, rect(containerOf(canvas)).bottom)
    }
    let height = 0
    await step(FLEX[0].title.ru, async () => {
      await waitForRows(canvas)
      await until(() => near(rect(panel()).height, PANEL))
      await until(fitsBelowPanel)
      height = rect(gridOf(canvas)).height
    })
    await step(FLEX[1].title.ru, async () => {
      await guideNext(canvas)
      await until(() => near(rect(panel()).height, PANEL_GROWN))
      await until(fitsBelowPanel)
      near(rect(gridOf(canvas)).height, height - (PANEL_GROWN - PANEL))
    })
    await settle()
  },
}

// --- ADR 0131 S4 ---------------------------------------------------------------------

const MAX_HEIGHT = 400

const CONTENT: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Три строки', en: 'Three rows' },
    hint: {
      ru: 'Высоты нет ни у блока, ни у таблицы — таблица по высоте заголовков и строк, пустого места под строками нет.',
      en: 'Neither the block nor the table has a height; the table is as tall as its headers and rows, with no empty space below the rows.',
    },
  },
  {
    title: { ru: 'Строк стало много', en: 'Many rows now' },
    hint: {
      ru: 'Пришло 100 строк — таблица выросла до своего предела, остальные строки прокручиваются внутри.',
      en: '100 rows arrived; the table grew up to its limit, and the remaining rows scroll inside it.',
    },
    props: () => ({ dataCount: 100 }),
  },
]

const CONTENT_HEIGHT_ARGS = {
  containerFrame: true,
  maxHeight: String(MAX_HEIGHT),
  dataCount: 3,
} satisfies Partial<StoryProps>

/** ADR 0131, S4: таблица без высоты — по строкам, с пределом роста `maxHeight`. */
export const SizingContentHeight: StoryObj<StoryProps> = {
  name: 'Content height',
  parameters: {
    scenario: '0131/S4',
    requirements: ['GH4'],
    ...guideControls(),
  },
  render: args => (
    <DemoStory
      title={{ ru: 'Высота по числу строк', en: 'Height by row count' }}
      steps={CONTENT}
      args={guideArgs(CONTENT_HEIGHT_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(CONTENT[0].title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(rowsOf(canvas)).toHaveLength(3))
      const scroller = scrollerOf(canvas)
      const last = rowsOf(canvas).at(-1)!
      near(
        rect(last).bottom,
        rect(scroller).top + scroller.clientTop + scroller.clientHeight,
      )
      await expect(scrolls(canvas)).toBe(false)
      await expect(rect(gridOf(canvas)).height).toBeLessThan(MAX_HEIGHT)
    })
    await step(CONTENT[1].title.ru, async () => {
      await guideNext(canvas)
      await until(() => near(rect(gridOf(canvas)).height, MAX_HEIGHT))
      await expect(scrolls(canvas)).toBe(true)
    })
    await settle()
  },
}

// --- ADR 0077 S1 ---------------------------------------------------------------------

const ROWS: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Высота по умолчанию', en: 'Default height' },
    hint: {
      ru: 'Строки и строка итогов — обычной высоты.',
      en: 'The rows and the totals row have the normal height.',
    },
  },
  {
    title: {
      ru: 'Таблица прокручена к середине',
      en: 'The table is scrolled to the middle',
    },
    hint: {
      ru: 'Пользователь прокрутил таблицу к середине.',
      en: 'The user scrolled the table to the middle.',
    },
    enter: scrollToMiddle,
  },
  {
    title: { ru: 'Компактные строки', en: 'Compact rows' },
    hint: {
      ru: 'Приложение сделало строки компактнее — помещается больше строк, сверху та же строка, что и раньше.',
      en: 'The app made the rows more compact; more rows fit, and the same row stays at the top.',
    },
    props: () => ({ rowHeight: 40 }),
  },
  {
    title: { ru: 'Просторные строки', en: 'Spacious rows' },
    hint: {
      ru: 'Приложение сделало строки просторнее — помещается меньше строк, сверху та же строка.',
      en: 'The app made the rows more spacious; fewer rows fit, and the same row stays at the top.',
    },
    props: () => ({ rowHeight: 64 }),
  },
  {
    title: { ru: 'Меньше минимума', en: 'Below the minimum' },
    hint: {
      ru: 'Приложение попросило строки ниже минимума — строки остались минимальной высоты: ниже не поместятся кнопки строки. В режиме разработки — предупреждение в консоли.',
      en: 'The app asked for rows below the minimum; the rows kept the minimum height, since row buttons would not fit in anything shorter. In development mode, a warning appears in the console.',
    },
    props: () => ({ rowHeight: 30 }),
  },
  {
    title: { ru: 'Листание страницами', en: 'Paging' },
    hint: {
      ru: 'Пользователь нажал клавишу листания вниз — таблица пролистала на экран строк новой высоты.',
      en: 'The user pressed the page-down key; the table moved down by a screen of rows of the new height.',
    },
    keyboard: true,
    enter: pageDown,
  },
]

const ROW_HEIGHT_ARGS = {
  // Таблица ниже строк: есть что прокрутить к середине.
  height: '460',
  dataCount: 200,
  enableFooter: true,
  enableKeyboardNavigation: true,
} satisfies Partial<StoryProps>

/** ADR 0077, S1: приложение меняет высоту строк на лету. */
export const SizingRowHeight: StoryObj<StoryProps> = {
  name: 'Row height',
  parameters: {
    scenario: '0077/S1',
    ...guideControls(),
  },
  render: args => (
    <DemoStory
      title={{ ru: 'Высота строк', en: 'Row height' }}
      steps={ROWS}
      args={guideArgs(ROW_HEIGHT_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const rowsAre = (height: number) =>
      until(() => {
        expect(rowHeights(canvas)).toEqual(new Set([height]))
        expect(Math.round(rect(footerOf(canvas)).height)).toBe(height)
      })
    let body: Element | null = null
    let visible = 0
    let first: string | undefined
    await step(ROWS[0].title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(ROWS[1].title.ru, async () => {
      await guideNext(canvas)
      await waitForRows(canvas)
      await until(() => expect(scrollerOf(canvas).scrollTop).toBeGreaterThan(0))
      await rowsAre(50)
      const viewport = await until(() => {
        const firstRow = firstShown(canvas)
        const rowCount = visibleRows(canvas)
        // После скачка scrollTop виртуализатор может ещё держать прежнее окно.
        expect(firstRow).toBeDefined()
        expect(rowCount).toBeGreaterThan(0)
        return { firstRow, rowCount }
      })
      body = bodyOf(canvas)
      visible = viewport.rowCount
      first = viewport.firstRow
    })
    await step(ROWS[2].title.ru, async () => {
      await guideNext(canvas)
      await rowsAre(40)
      await until(() => expect(visibleRows(canvas)).toBeGreaterThan(visible))
      // Сверху та же строка (RH10).
      await until(() => expect(firstShown(canvas)).toBe(first))
      await until(() => expect(bodyOf(canvas)).toBe(body))
      await until(() => expect(recreated()).toBe(false))
      visible = visibleRows(canvas)
    })
    await step(ROWS[3].title.ru, async () => {
      await guideNext(canvas)
      await rowsAre(64)
      await until(() => expect(visibleRows(canvas)).toBeLessThan(visible))
      await until(() => expect(firstShown(canvas)).toBe(first))
    })
    await step(ROWS[4].title.ru, async () => {
      // Предупреждение печатается раз за сессию: прежние прогоны его не гасят.
      __resetLogger()
      const warn = spyOn(console, 'warn').mockImplementation(() => {})
      try {
        await guideNext(canvas)
        await rowsAre(40)
        await until(() =>
          expect(warn).toHaveBeenCalledWith(
            expect.stringContaining('rowHeight: 30 is below the minimum 40px'),
          ),
        )
      } finally {
        warn.mockRestore()
      }
    })
    await step(ROWS[5].title.ru, async () => {
      const page = visibleRows(canvas)
      await guideNext(canvas)
      // Активная строка ушла вниз на экран строк новой высоты (RH6).
      await until(() =>
        expect(rowIndexOf(focusedCell(canvas))).toBeGreaterThanOrEqual(
          Number(firstShown(canvas)) + page - 2,
        ),
      )
    })
    await settle()
  },
}

// --- ADR 0077 S2 ---------------------------------------------------------------------

/** Вложенная шапка мока: Info → More Info → Age — три строки. */
const HEAD_DEPTH = 3
const headHeight = (row: number) => HEAD_DEPTH * row + HEAD_DEPTH - 1

const HEADER: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Шапка высотой строк', en: 'A header as tall as the rows' },
    hint: {
      ru: 'Заголовки в несколько уровней — каждый уровень высотой со строку.',
      en: 'Headers have several levels; each level is as tall as a row.',
    },
  },
  {
    title: { ru: 'Высокие заголовки', en: 'Tall headers' },
    hint: {
      ru: 'Приложение сделало заголовки выше — каждый уровень выше строки, строки прежние.',
      en: 'The app made the headers taller; each level is taller than a row, and the rows are unchanged.',
    },
    props: () => ({ headerHeight: 72 }),
  },
]

const HEADER_HEIGHT_ARGS = {
  rowHeight: 44,
  headerNesting: 'nested',
} satisfies Partial<StoryProps>

/** ADR 0077, S2: шапка выше строк — для длинных заголовков вложенной шапки. */
export const SizingHeaderHeight: StoryObj<StoryProps> = {
  name: 'Header height',
  parameters: {
    scenario: '0077/S2',
    ...guideControls(),
  },
  render: args => (
    <DemoStory
      title={{ ru: 'Высота заголовков', en: 'Header height' }}
      steps={HEADER}
      args={guideArgs(HEADER_HEIGHT_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(HEADER[0].title.ru, async () => {
      await waitForRows(canvas)
      await until(() =>
        expect(Math.round(rect(headOf(canvas)).height)).toBe(headHeight(44)),
      )
      await expect(rowHeights(canvas)).toEqual(new Set([44]))
    })
    await step(HEADER[1].title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(Math.round(rect(headOf(canvas)).height)).toBe(headHeight(72)),
      )
      await expect(rowHeights(canvas)).toEqual(new Set([44]))
    })
    await settle()
  },
}

// --- ADR 0077 S4 ---------------------------------------------------------------------

/** Тема приложения: свои токены высоты поверх темы грида. */
const APP_THEME = 'sizing-app-theme'
const APP_THEME_CSS = `.${APP_THEME}.${DATA_GRID_THEME_CLASS} { --tsr-comp-row-height: 40px; --tsr-comp-head-row-height: 64px; }`

const THEME: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Высота по умолчанию', en: 'Default height' },
    hint: {
      ru: 'Строки и заголовки — обычной высоты.',
      en: 'The rows and the headers have the normal height.',
    },
  },
  {
    title: { ru: 'Тема приложения', en: 'The app theme' },
    hint: {
      ru: 'Тема приложения задала свою высоту строк и заголовков — таблица без своих настроек взяла её.',
      en: 'The app theme set its own height for rows and headers; the table without its own settings took it.',
    },
    props: () => ({ gridClassName: APP_THEME }),
  },
  {
    title: {
      ru: 'Таблица главнее темы',
      en: 'The table overrides the theme',
    },
    hint: {
      ru: 'Приложение задало высоту строк самой таблице — она главнее темы; заголовки по-прежнему из темы.',
      en: 'The app set the row height on the table itself; it overrides the theme, and the headers still come from the theme.',
    },
    props: () => ({ rowHeight: 56 }),
  },
]

/** ADR 0077, S4: высоту строк и шапки задаёт тема приложения в CSS. */
export const SizingThemeTokens: StoryObj<StoryProps> = {
  name: 'Theme tokens',
  parameters: {
    scenario: '0077/S4',
    ...guideControls(),
  },
  render: args => (
    <>
      <style>{APP_THEME_CSS}</style>
      <DemoStory
        title={{
          ru: 'Высота из темы приложения',
          en: 'Height from the app theme',
        }}
        steps={THEME}
        args={guideArgs({}, args)}
      />
    </>
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const sizes = (row: number, head: number) =>
      until(() => {
        expect(rowHeights(canvas)).toEqual(new Set([row]))
        expect(Math.round(rect(headOf(canvas)).height)).toBe(head)
      })
    await step(THEME[0].title.ru, async () => {
      await waitForRows(canvas)
      await sizes(50, 50)
    })
    await step(THEME[1].title.ru, async () => {
      await guideNext(canvas)
      await sizes(40, 64)
    })
    await step(THEME[2].title.ru, async () => {
      await guideNext(canvas)
      await sizes(56, 64)
    })
    await settle()
  },
}
