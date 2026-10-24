import { Meta, StoryObj } from '@storybook/react'
import { useMemo, useState } from 'react'
import { useArgs } from 'storybook/preview-api'
import { expect } from 'storybook/test'

import { definePlugin } from '../core/definePlugin'
import type { ScrollToRowOptions } from '../core/scrollToRow/scrollToRowFeature'
import type { InfiniteScrollLoadContext } from '../plugins'
import { StoryComponent } from './DataGridStory'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { vrStates } from './__mocks__/catalog'
import { pressCell } from './__mocks__/cellGestures'
import {
  guideNext,
  pollUntil,
  settle,
  stepDone,
  until,
} from './__mocks__/catalogPlay'
import { getData } from './__mocks__/data'
import { inCategory } from './__mocks__/utils/argTypes'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import {
  GuideStory,
  type GuideStoryStep,
  guideArgs,
  stepAction,
} from './demos/GuideStory'

/**
 * Футер колонок и его положение (ADR 0118): вид для каталога и по истории на клиентский
 * сценарий S1–S9.
 * `footerPosition` — `pinned` (у низа области) или `inline` (за последней строкой);
 * сценарий проигрывается панелью над гридом, в тестах шаги проходит `play` (ADR 0117).
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Core/Footer',
  tags: ['done'],
} satisfies Meta<StoryProps>

export default meta

/** Область фиксированной высоты, как у приложения: строк больше, чем помещается. */
const FIXED_HEIGHT = {
  containerHeight: '600',
  height: '500',
  maxHeight: '500',
} as const

/** Колонки моков с итогами: Total — последняя, её сумма — в футере. */
const FOOTER_ARGS = {
  ...FIXED_HEIGHT,
  columnCount: 7,
  enableFooter: true,
} satisfies Partial<StoryProps>

const FEED_TOTAL = 1000
const FEED_BLOCK = 50
const FEED_FAILURE = 'Server error: 503 Service Unavailable'

interface FooterDefaultArgs extends StoryProps {
  /** Время ответа «сервера» ленты, мс. */
  serverDelayMs?: number
  /** `always` — «сервер» ленты недоступен: каждый блок отвечает отказом. */
  serverFailMode?: 'never' | 'always'
}

/** Лента песочницы: первая порция — `dataCount` строк, у края «сервер» дописывает блок. */
const FeedGrid = ({
  serverDelayMs = 700,
  serverFailMode = 'never',
  ...props
}: FooterDefaultArgs) => {
  const all = useMemo(() => getData(FEED_TOTAL), [])
  const [loaded, setLoaded] = useState(props.dataCount)
  const rows = useMemo(() => all.slice(0, loaded), [all, loaded])
  const onLoadMore = ({ signal }: InfiniteScrollLoadContext) =>
    new Promise<void>((resolve, reject) =>
      window.setTimeout(() => {
        if (signal.aborted) resolve()
        else if (serverFailMode === 'always') reject(new Error(FEED_FAILURE))
        else {
          setLoaded(count => count + FEED_BLOCK)
          resolve()
        }
      }, serverDelayMs),
    )
  return (
    <StoryComponent
      {...props}
      dataOverride={rows}
      infiniteScrollHasMore={loaded < all.length}
      onLoadMore={onLoadMore}
    />
  )
}

/**
 * Вид строки футера для каталога: грид по содержимому, сумма Total — в футере. Песочница
 * фичи: контролы всех её сценариев; с `enableInfiniteScroll` — лента с «сервером».
 */
export const FooterPlayground: StoryObj<FooterDefaultArgs> = {
  name: 'Playground',
  parameters: {
    ...vrStates('head.footer'),
    ...showControls(
      [
        'enableFooter',
        'footerPosition',
        'enableKeyboardNavigation',
        'enablePagination',
        'paginationInitialPageSize',
        'enableQuickSearch',
        'enableInfiniteScroll',
        'serverDelayMs',
        'serverFailMode',
      ],
      {
        headerHeight: 'Футер встаёт под шапкой при любой её высоте',
        defaultColumn:
          'Футер повторяет ширины колонок, своего поведения у него нет',
      },
    ),
  },
  args: { ...FOOTER_ARGS, serverDelayMs: 700, serverFailMode: 'never' },
  // В группе ленты: после её тумблера.
  argTypes: inCategory('Поиск, фильтры, страницы, экспорт', {
    serverDelayMs: {
      control: { type: 'range', min: 0, max: 5000, step: 100 },
      description: 'Время ответа «сервера» ленты, мс',
      if: { arg: 'enableInfiniteScroll' },
    },
    serverFailMode: {
      control: 'inline-radio',
      options: ['never', 'always'],
      description:
        '`always` — «сервер» ленты недоступен: блок отвечает отказом, «Retry» повторяет запрос',
      if: { arg: 'enableInfiniteScroll' },
    },
  }),
  render: function Render(args) {
    const [, updateArgs] = useArgs()
    const props: FooterDefaultArgs = { ...normalizeArgs(args), updateArgs }
    const { serverDelayMs: _delay, serverFailMode: _fail, ...gridProps } = props
    return props.enableInfiniteScroll ? (
      <FeedGrid key={props.dataCount} {...props} />
    ) : (
      <StoryComponent {...gridProps} />
    )
  },
}

// --- Чтение грида в `play` и шагах -------------------------------------------------

const scrollerOf = (root: ParentNode) =>
  root.querySelector<HTMLElement>('.data-grid__container')!
const footerOf = (root: ParentNode) =>
  root.querySelector<HTMLElement>('.data-grid__footer')!
const rect = (element: Element) => element.getBoundingClientRect()
/** Низ видимой части области прокрутки — без полосы прокрутки. */
const clientBottom = (root: ParentNode) => {
  const scroller = scrollerOf(root)
  return rect(scroller).top + scroller.clientTop + scroller.clientHeight
}
const lastRowOf = (root: ParentNode) =>
  [...root.querySelectorAll<HTMLElement>('.data-grid__body-row')].reduce(
    (found, row) =>
      Number(row.dataset.index) > Number(found.dataset.index) ? row : found,
  )
const near = (actual: number, expected: number) =>
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1)
const waitRows = (canvas: HTMLElement) =>
  until(() =>
    expect(canvas.querySelector('.data-grid__body-row')).not.toBeNull(),
  )

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
const scrollToEnd = afterRows(root => {
  const scroller = scrollerOf(root)
  scroller.scrollTop = scroller.scrollHeight
})

// --- S1 ------------------------------------------------------------------------------

const PINNED: readonly GuideStoryStep[] = [
  {
    title: 'Футер у нижнего края',
    hint: 'Строка футера всегда отображается у нижнего края таблицы.',
  },
  {
    title: 'Прокрутка к середине',
    hint: 'Строка футера перекрывает собой область прокрутки на любой позиции.',
    enter: scrollToMiddle,
  },
]

const PINNED_FOOTER_ARGS = {
  ...FOOTER_ARGS,
  dataCount: 100,
  footerPosition: 'pinned',
} satisfies Partial<StoryProps>

/** S1: длинная таблица с фиксированным футером — он виден при любой прокрутке. */
export const PinnedFooter: StoryObj<StoryProps> = {
  name: 'Pinned',
  parameters: {
    scenario: '0118/S1',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Футер у нижнего края"
      steps={PINNED}
      args={guideArgs(PINNED_FOOTER_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    // В Storybook сценарий проходит человек; `play` — только в тестах каталога.
    if (globals.catalog !== true) return
    await step(PINNED[0].title, async () => {
      await waitRows(canvas)
      await until(() =>
        near(rect(footerOf(canvas)).bottom, clientBottom(canvas)),
      )
    })
    await step(PINNED[1].title, async () => {
      await guideNext(canvas)
      await until(() => expect(scrollerOf(canvas).scrollTop).toBeGreaterThan(0))
      near(rect(footerOf(canvas)).bottom, clientBottom(canvas))
    })
    await settle()
  },
}

// --- S2 ------------------------------------------------------------------------------

const INLINE: readonly GuideStoryStep[] = [
  {
    title: 'Футер за последней строкой',
    hint: 'Строка футера отображается следом за последней строкой таблицы.',
  },
  {
    title: 'Прокрутка к концу',
    hint: 'Строка футера видна, только если пользователь дошёл до конца списка строк.',
    enter: scrollToEnd,
  },
]

const INLINE_FOOTER_ARGS = {
  ...FOOTER_ARGS,
  dataCount: 100,
  footerPosition: 'inline',
} satisfies Partial<StoryProps>

/** S2: футер следом за последней строкой — до него докручивают. */
export const InlineFooter: StoryObj<StoryProps> = {
  name: 'Inline',
  parameters: {
    scenario: '0118/S2',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Футер за последней строкой"
      steps={INLINE}
      args={guideArgs(INLINE_FOOTER_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(INLINE[0].title, async () => {
      await waitRows(canvas)
      await expect(rect(footerOf(canvas)).top).toBeGreaterThanOrEqual(
        clientBottom(canvas),
      )
    })
    await step(INLINE[1].title, async () => {
      await guideNext(canvas)
      await until(() =>
        near(rect(footerOf(canvas)).top, rect(lastRowOf(canvas)).bottom),
      )
      near(rect(footerOf(canvas)).bottom, clientBottom(canvas))
    })
    await settle()
  },
}

// --- S3 ------------------------------------------------------------------------------

/** Ячейка первой строки, целиком видной под шапкой. */
const firstVisibleCell = (root: HTMLElement) => {
  const top = rect(root.querySelector('.data-grid__head')!).bottom
  return [...root.querySelectorAll<HTMLElement>('.data-grid__body-row')]
    .filter(row => rect(row).top >= top)
    .sort((a, b) => rect(a).top - rect(b).top)[0]
    ?.querySelector<HTMLElement>('[data-kn-cell]')
}

/** Действие шага: таблица прокручена к середине, пользователь нажал видимую ячейку. */
const scrollAndPressCell = stepAction(async (root, { signal }) => {
  await pollUntil(() => !!root.querySelector('.data-grid__body-row'), signal)
  const scroller = scrollerOf(root)
  const middle = Math.round((scroller.scrollHeight - scroller.clientHeight) / 2)
  if (Math.abs(scroller.scrollTop - middle) > 1) scroller.scrollTop = middle
  // Строки на новом месте монтируются к следующему кадру.
  await pollUntil(() => !!firstVisibleCell(root), signal)
  const cell = firstVisibleCell(root)!
  pressCell(cell)
  // Ячейка станет активной событием фокуса — без фокуса у страницы оно придёт, когда
  // страницу откроют: холст Storybook при загрузке фокуса не имеет.
  await pollUntil(() => document.activeElement === cell, signal)
})

const SWITCH: readonly GuideStoryStep[] = [
  {
    title: 'Футер у нижнего края',
    hint: 'Строка футера отображается у нижнего края таблицы. Таблица прокручена к середине, ячейка выбрана.',
    enter: scrollAndPressCell,
  },
  {
    title: 'Футер за последней строкой',
    hint: 'Приложение открепляет футер: строка футера уходит следом за последней строкой, прокрутка и выбранная ячейка остаются на месте.',
    props: () => ({ footerPosition: 'inline' }),
  },
]

const FOOTER_POSITION_SWITCH_ARGS = {
  ...FOOTER_ARGS,
  dataCount: 100,
  footerPosition: 'pinned',
  enableKeyboardNavigation: true,
} satisfies Partial<StoryProps>

/** S3: приложение переключает положение футера на лету. */
export const FooterPositionSwitch: StoryObj<StoryProps> = {
  name: 'Position switch',
  parameters: {
    scenario: '0118/S3',
    requirements: ['FT3'],
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Смена положения футера"
      steps={SWITCH}
      args={guideArgs(FOOTER_POSITION_SWITCH_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    let scrollTop = 0
    let body: Element | null = null
    let cell: HTMLElement | undefined
    await step(SWITCH[0].title, async () => {
      await stepDone(canvas)
      expect(scrollerOf(canvas).scrollTop).toBeGreaterThan(0)
      cell = document.activeElement as HTMLElement
      await until(() => expect(cell!.dataset.knActive).toBe('true'))
      await settle()
      scrollTop = scrollerOf(canvas).scrollTop
      body = canvas.querySelector('.data-grid__body')
      await expect(footerOf(canvas).dataset.position).toBe('pinned')
    })
    await step(SWITCH[1].title, async () => {
      await guideNext(canvas)
      // FT3: положение сменилось, а прокрутка, активная ячейка и тело — те же.
      await until(() =>
        expect(footerOf(canvas).dataset.position).toBe('inline'),
      )
      await expect(scrollerOf(canvas).scrollTop).toBe(scrollTop)
      await expect(canvas.querySelector('.data-grid__body')).toBe(body)
      await expect(cell!.isConnected).toBe(true)
      await expect(cell!.dataset.knActive).toBe('true')
      await expect(cell!.tabIndex).toBe(0)
    })
    await settle()
  },
}

// --- S4 ------------------------------------------------------------------------------

/** Фокус на ячейке последней строки, футер — сразу за нижним краем таблицы. */
const focusLastRow = afterRows(root => {
  const scroller = scrollerOf(root)
  scroller.scrollTop = scroller.scrollHeight
  // Строки на новом месте монтируются к следующему кадру.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      scroller.scrollTop -= rect(footerOf(root)).height
      lastRowOf(root)
        .querySelector<HTMLElement>('[data-kn-cell]')
        ?.focus({ preventScroll: true })
    }),
  )
})

/** Стрелка вниз из активной ячейки — как нажатие пользователя. */
const pressArrowDown = (root: HTMLElement) => {
  const active = root.querySelector<HTMLElement>('[data-kn-active="true"]')
  active?.focus({ preventScroll: true })
  active?.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
  )
}

const KEYBOARD: readonly GuideStoryStep[] = [
  {
    title: 'Фокус на последней строке',
    hint: 'Строка футера отображается следом за последней строкой и сейчас скрыта за нижним краем таблицы.',
    enter: focusLastRow,
  },
  {
    title: 'Стрелка вниз',
    hint: 'Фокус переходит на строку футера, таблица автоматически прокручивается до конца.',
    enter: pressArrowDown,
  },
]

const FOOTER_KEYBOARD_ARGS = {
  ...FOOTER_ARGS,
  dataCount: 100,
  footerPosition: 'inline',
  enableKeyboardNavigation: true,
} satisfies Partial<StoryProps>

/** S4: стрелкой — до футера за последней строкой. */
export const FooterKeyboard: StoryObj<StoryProps> = {
  name: 'Keyboard',
  parameters: {
    scenario: '0118/S4',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Футер с клавиатуры"
      steps={KEYBOARD}
      args={guideArgs(FOOTER_KEYBOARD_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(KEYBOARD[0].title, async () => {
      await waitRows(canvas)
      await until(() =>
        expect(
          lastRowOf(canvas).querySelector('[data-kn-active="true"]'),
        ).not.toBeNull(),
      )
      await expect(rect(footerOf(canvas)).top).toBeGreaterThanOrEqual(
        clientBottom(canvas) - 1,
      )
    })
    await step(KEYBOARD[1].title, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(footerOf(canvas).contains(document.activeElement)).toBe(true),
      )
      await expect(rect(footerOf(canvas)).bottom).toBeLessThanOrEqual(
        clientBottom(canvas) + 1,
      )
    })
    await settle()
  },
}

// --- S5 ------------------------------------------------------------------------------

/** «Сервер» ленты отвечает отказом через полсекунды. */
const failingLoad = () =>
  new Promise<void>((_, reject) =>
    window.setTimeout(
      () => reject(new Error('Server error: 503 Service Unavailable')),
      500,
    ),
  )

const FEED: readonly GuideStoryStep[] = [
  {
    title: 'Футер в бесконечной ленте',
    hint: 'Футер отображается в конце загруженной ленты.',
    enter: scrollToEnd,
  },
  {
    title: 'Ошибка получения данных',
    hint: 'Во время загрузки футер отображается после скелетов, а при ошибке — перед строкой с текстом ошибки.',
    props: () => ({ infiniteScrollHasMore: true, onLoadMore: failingLoad }),
    enter: scrollToEnd,
  },
]

const INLINE_FOOTER_INFINITE_SCROLL_ARGS = {
  ...FOOTER_ARGS,
  dataCount: 100,
  footerPosition: 'inline',
  enableInfiniteScroll: true,
} satisfies Partial<StoryProps>

/** S5: лента с футером за последней строкой — ошибка догрузки встаёт под ним. */
export const InlineFooterInfiniteScroll: StoryObj<StoryProps> = {
  name: 'Inline — infinite scroll',
  parameters: {
    scenario: '0118/S5',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Футер в бесконечной ленте"
      steps={FEED}
      args={guideArgs(INLINE_FOOTER_INFINITE_SCROLL_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const errorRow = () =>
      canvas.querySelector<HTMLElement>('[data-testid="infinite-scroll-error"]')
    await step(FEED[0].title, async () => {
      await waitRows(canvas)
      await until(() =>
        near(rect(footerOf(canvas)).top, rect(lastRowOf(canvas)).bottom),
      )
    })
    await step(FEED[1].title, async () => {
      await guideNext(canvas)
      await until(() => expect(errorRow()).not.toBeNull())
      const footer = footerOf(canvas)
      await expect(
        footer.compareDocumentPosition(errorRow()!) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
      await expect(rect(errorRow()!).top).toBeGreaterThanOrEqual(
        rect(footer).bottom - 1,
      )
      // Шаг начат у края — строка ошибки в области целиком (FT17).
      await expect(rect(errorRow()!).bottom).toBeLessThanOrEqual(
        clientBottom(canvas) + 1,
      )
    })
    await settle()
  },
}

// --- S6 ------------------------------------------------------------------------------

interface PageApi {
  setPagination: (pagination: { pageIndex: number; pageSize: number }) => void
}

let pageApi: PageApi | null = null

/** Отдаёт таблицу шагам истории — размер страницы меняется, как из её списка. */
const pageSizeHost = definePlugin<{ enabled?: boolean }>()({
  id: 'footerPageSizeHost',
  setup: () => table => {
    pageApi = table as unknown as PageApi
    return () => {
      pageApi = null
    }
  },
})

const PAGE_ROWS = 100
const SMALL_PAGE = 5
const LARGE_PAGE = 25

const PAGES: readonly GuideStoryStep[] = [
  {
    title: 'Малый размер страницы',
    hint: 'Строки страницы помещаются в таблицу — строка футера видна сразу следом за последней из них.',
  },
  {
    title: 'Большой размер страницы',
    hint: 'Строки страницы не помещаются в таблицу — строка футера видна, когда пользователь докрутит до конца страницы.',
    enter: afterRows(root => {
      pageApi?.setPagination({ pageIndex: 0, pageSize: LARGE_PAGE })
      // Строки новой страницы монтируются к следующему кадру.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          const scroller = scrollerOf(root)
          scroller.scrollTop = scroller.scrollHeight
        }),
      )
    }),
  },
]

const INLINE_FOOTER_PAGINATION_ARGS = {
  ...FOOTER_ARGS,
  dataCount: PAGE_ROWS,
  footerPosition: 'inline',
  enablePagination: true,
  paginationInitialPageSize: SMALL_PAGE,
  extraPlugins: [pageSizeHost()],
} satisfies Partial<StoryProps>

/** S6: футер за последней строкой страницы — при малом и при большом её размере. */
export const InlineFooterPagination: StoryObj<StoryProps> = {
  name: 'Inline — pagination',
  parameters: {
    scenario: '0118/S6',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Футер с пагинацией"
      steps={PAGES}
      args={guideArgs(INLINE_FOOTER_PAGINATION_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const rows = () => canvas.querySelectorAll('.data-grid__body-row')
    await step(PAGES[0].title, async () => {
      await waitRows(canvas)
      await until(() => expect(rows()).toHaveLength(SMALL_PAGE))
      near(rect(footerOf(canvas)).top, rect(lastRowOf(canvas)).bottom)
      await expect(rect(footerOf(canvas)).bottom).toBeLessThanOrEqual(
        clientBottom(canvas),
      )
    })
    await step(PAGES[1].title, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(lastRowOf(canvas).dataset.index).toBe(String(LARGE_PAGE - 1)),
      )
      await until(() => expect(scrollerOf(canvas).scrollTop).toBeGreaterThan(0))
      await until(() =>
        near(rect(footerOf(canvas)).top, rect(lastRowOf(canvas)).bottom),
      )
      near(rect(footerOf(canvas)).bottom, clientBottom(canvas))
    })
    await settle()
  },
}

// --- S7 ------------------------------------------------------------------------------

interface ScrollApi {
  scrollToRow: (rowId: string, options?: ScrollToRowOptions) => Promise<boolean>
}

let scrollApi: ScrollApi | null = null

/** Отдаёт таблицу шагам истории — как приложение держит ссылку на неё. */
const scrollToRowHost = definePlugin<{ enabled?: boolean }>()({
  id: 'footerScrollToRowHost',
  setup: () => table => {
    scrollApi = table as unknown as ScrollApi
    return () => {
      scrollApi = null
    }
  },
})

const SCROLL_ROWS = 100
const LAST_ROW_ID = `item-id-${SCROLL_ROWS - 1}`
const scrollToRowEnd = (rowId: string) =>
  afterRows(() => void scrollApi?.scrollToRow(rowId, { align: 'end' }))

const SCROLL: readonly GuideStoryStep[] = [
  {
    title: 'Середина таблицы',
    hint: 'Строка футера находится не в области прокрутки.',
    enter: scrollToMiddle,
  },
  {
    title: 'Прокрутка к концу',
    hint: 'Программная прокрутка доходит до последней строки, включая строку футера.',
    enter: scrollToRowEnd(LAST_ROW_ID),
  },
]

const INLINE_FOOTER_SCROLL_TO_ROW_ARGS = {
  ...FOOTER_ARGS,
  dataCount: SCROLL_ROWS,
  footerPosition: 'inline',
  extraPlugins: [scrollToRowHost()],
} satisfies Partial<StoryProps>

/** S7: приложение ведёт к строке по нижнему краю — футер не прячется за край. */
export const InlineFooterScrollToRow: StoryObj<StoryProps> = {
  name: 'Inline — scroll to row',
  parameters: {
    scenario: '0118/S7',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Прокрутка к строке"
      steps={SCROLL}
      args={guideArgs(INLINE_FOOTER_SCROLL_TO_ROW_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const rowById = (id: string) =>
      canvas.querySelector<HTMLElement>(
        `.data-grid__body-row[data-row-id="${id}"]`,
      )
    await step(SCROLL[0].title, async () => {
      await waitRows(canvas)
      await until(() => expect(scrollApi).not.toBeNull())
      await until(() => expect(scrollerOf(canvas).scrollTop).toBeGreaterThan(0))
      await expect(rect(footerOf(canvas)).top).toBeGreaterThanOrEqual(
        clientBottom(canvas),
      )
    })
    await step(SCROLL[1].title, async () => {
      await guideNext(canvas)
      await until(() =>
        near(rect(rowById(LAST_ROW_ID)!).bottom, rect(footerOf(canvas)).top),
      )
      near(rect(footerOf(canvas)).bottom, clientBottom(canvas))
    })
    await settle()
  },
}

// --- S8 ------------------------------------------------------------------------------

/** Ввод в поле поиска — как набор пользователя: React слышит событие `input`. */
const typeSearch = (text: string) => (root: HTMLElement) => {
  const input = root.querySelector<HTMLInputElement>(
    '[data-testid="quick-search"]',
  )
  if (!input) return
  Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )!.set!.call(input, text)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

const SEARCH: readonly GuideStoryStep[] = [
  {
    title: 'Футер за последней строкой',
    hint: 'Строка футера отображается следом за последней строкой таблицы.',
  },
  {
    title: 'Данные не найдены',
    hint: 'Поиск не нашёл ни одной записи. Футер отображается под заглушкой.',
    enter: typeSearch('zzz'),
  },
]

const INLINE_FOOTER_EMPTY_SEARCH_ARGS = {
  ...FOOTER_ARGS,
  dataCount: 100,
  footerPosition: 'inline',
  enableQuickSearch: true,
} satisfies Partial<StoryProps>

/** S8: поиск ничего не нашёл — заглушка и футер не накладываются. */
export const InlineFooterEmptySearch: StoryObj<StoryProps> = {
  name: 'Inline — empty search',
  parameters: {
    scenario: '0118/S8',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Футер и заглушка поиска"
      steps={SEARCH}
      args={guideArgs(INLINE_FOOTER_EMPTY_SEARCH_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const stub = () =>
      canvas.querySelector<HTMLElement>('[data-testid="filter-stub"]')
    const head = () => canvas.querySelector<HTMLElement>('.data-grid__head')!
    await step(SEARCH[0].title, async () => {
      await waitRows(canvas)
      await until(() =>
        expect(
          canvas.querySelector('[data-testid="quick-search"]'),
        ).not.toBeNull(),
      )
    })
    await step(SEARCH[1].title, async () => {
      await guideNext(canvas)
      await until(() => expect(stub()).not.toBeNull())
      const footer = footerOf(canvas)
      // Итоги — по найденным строкам: их нет.
      const sumOf = (column: string) =>
        footer
          .querySelector(`[data-column-id="${column}"]`)
          ?.textContent?.trim()
      await expect(sumOf('visits')).toBe('0')
      await expect(sumOf('total')).toBe('0$')
      await until(() =>
        expect(rect(stub()!).bottom).toBeLessThanOrEqual(rect(footer).top + 1),
      )
      await expect(rect(stub()!).top).toBeGreaterThanOrEqual(
        rect(head()).bottom - 1,
      )
      await expect(
        stub()!.compareDocumentPosition(footer) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
      // Футер едет к низу движением строк (FT12) — к концу движения.
      await until(() => near(rect(footer).bottom, clientBottom(canvas)))
    })
    await settle()
  },
}

// --- S9 ------------------------------------------------------------------------------

const AUTO_HEIGHT: readonly GuideStoryStep[] = [
  {
    title: 'Фиксированная высота таблицы',
    hint: 'Вне зависимости от высоты строка футера находится у нижнего края.',
  },
  {
    title: 'Высота таблицы по содержимому',
    hint: 'Строка футера также находится у нижнего края, но не перекрывает другие строки вне зависимости от их количества.',
    props: () => ({ containerHeight: '', height: '', maxHeight: '' }),
  },
]

const FOOTER_AUTO_HEIGHT_ARGS = {
  ...FOOTER_ARGS,
  dataCount: 4,
  footerPosition: 'pinned',
} satisfies Partial<StoryProps>

/** S9: короткая таблица теряет высоту — пустое место над футером уходит. */
export const FooterAutoHeight: StoryObj<StoryProps> = {
  name: 'Auto height',
  parameters: {
    scenario: '0118/S9',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Позиция футера при разной высоте таблицы"
      steps={AUTO_HEIGHT}
      args={guideArgs(FOOTER_AUTO_HEIGHT_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const gap = () =>
      rect(footerOf(canvas)).top - rect(lastRowOf(canvas)).bottom
    await step(AUTO_HEIGHT[0].title, async () => {
      await waitRows(canvas)
      await until(() =>
        near(rect(footerOf(canvas)).bottom, clientBottom(canvas)),
      )
      await expect(gap()).toBeGreaterThan(100)
    })
    await step(AUTO_HEIGHT[1].title, async () => {
      await guideNext(canvas)
      await until(() => near(gap(), 0))
      const scroller = scrollerOf(canvas)
      await expect(scroller.scrollHeight).toBeLessThanOrEqual(
        scroller.clientHeight,
      )
    })
    await settle()
  },
}
