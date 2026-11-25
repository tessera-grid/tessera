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
  waitForRows,
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
  DemoStory,
  type DemoStoryStep,
  guideArgs,
  stepAction,
} from './demos/DemoStory'

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
        headerHeight: 'The footer sits under the header at any header height',
        defaultColumn:
          'The footer repeats the column widths and has no behavior of its own',
      },
    ),
  },
  args: { ...FOOTER_ARGS, serverDelayMs: 700, serverFailMode: 'never' },
  // В группе ленты: после её тумблера.
  argTypes: inCategory('Search, filters, pages, export', {
    serverDelayMs: {
      control: { type: 'range', min: 0, max: 5000, step: 100 },
      description: 'Response time of the feed\'s "server", ms',
      if: { arg: 'enableInfiniteScroll' },
    },
    serverFailMode: {
      control: 'inline-radio',
      options: ['never', 'always'],
      description:
        '`always`: the feed\'s "server" is unavailable — a block responds with a refusal, and "Retry" repeats the request',
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

const PINNED: readonly DemoStoryStep[] = [
  {
    title: {
      ru: 'Строка итогов у нижнего края',
      en: 'Totals row at the bottom edge',
    },
    hint: {
      ru: 'Строка итогов закреплена у нижнего края таблицы.',
      en: 'The totals row is pinned to the bottom edge of the table.',
    },
  },
  {
    title: { ru: 'Прокрутка к середине', en: 'Scrolled to the middle' },
    hint: {
      ru: 'Строки прокручиваются под строкой итогов, она остаётся на месте.',
      en: 'The rows scroll under the totals row, which stays in place.',
    },
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
    <DemoStory
      title={{
        ru: 'Строка итогов у нижнего края',
        en: 'Totals row at the bottom edge',
      }}
      steps={PINNED}
      args={guideArgs(PINNED_FOOTER_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    // В Storybook сценарий проходит человек; `play` — только в тестах каталога.
    if (globals.catalog !== true) return
    await step(PINNED[0].title.ru, async () => {
      await waitRows(canvas)
      await until(() =>
        near(rect(footerOf(canvas)).bottom, clientBottom(canvas)),
      )
    })
    await step(PINNED[1].title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(scrollerOf(canvas).scrollTop).toBeGreaterThan(0))
      near(rect(footerOf(canvas)).bottom, clientBottom(canvas))
    })
    await settle()
  },
}

// --- S2 ------------------------------------------------------------------------------

const INLINE: readonly DemoStoryStep[] = [
  {
    title: {
      ru: 'Строка итогов за последней строкой',
      en: 'Totals row after the last row',
    },
    hint: {
      ru: 'Строка итогов идёт сразу за последней строкой.',
      en: 'The totals row comes right after the last row.',
    },
  },
  {
    title: { ru: 'Прокрутка к концу', en: 'Scrolled to the end' },
    hint: {
      ru: 'Строка итогов видна только в конце таблицы.',
      en: 'The totals row is visible only at the end of the table.',
    },
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
    <DemoStory
      title={{
        ru: 'Строка итогов за последней строкой',
        en: 'Totals row after the last row',
      }}
      steps={INLINE}
      args={guideArgs(INLINE_FOOTER_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(INLINE[0].title.ru, async () => {
      await waitRows(canvas)
      await expect(rect(footerOf(canvas)).top).toBeGreaterThanOrEqual(
        clientBottom(canvas),
      )
    })
    await step(INLINE[1].title.ru, async () => {
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
  await pollUntil(() => cell.dataset.cellSelected === 'true', signal)
})

const SWITCH: readonly DemoStoryStep[] = [
  {
    title: {
      ru: 'Строка итогов у нижнего края',
      en: 'Totals row at the bottom edge',
    },
    hint: {
      ru: 'Строка итогов закреплена у нижнего края таблицы.',
      en: 'The totals row is pinned to the bottom edge of the table.',
    },
  },
  {
    title: {
      ru: 'Выбрана ячейка в середине',
      en: 'A cell in the middle is selected',
    },
    hint: {
      ru: 'Таблица прокручена, ячейка выбрана — строка итогов на месте.',
      en: 'The table is scrolled and a cell is selected; the totals row stays in place.',
    },
    enter: scrollAndPressCell,
  },
  {
    title: {
      ru: 'Строка итогов за последней строкой',
      en: 'Totals row after the last row',
    },
    hint: {
      ru: 'Приложение открепило строку итогов: она ушла за последнюю строку, прокрутка и выбор на месте.',
      en: 'The app unpinned the totals row: it moved after the last row, while the scroll and the selection stayed put.',
    },
    props: () => ({ footerPosition: 'inline' }),
  },
]

const FOOTER_POSITION_SWITCH_ARGS = {
  ...FOOTER_ARGS,
  dataCount: 100,
  footerPosition: 'pinned',
  enableKeyboardNavigation: true,
  enableCellSelection: true,
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
    <DemoStory
      title={{
        ru: 'Смена положения строки итогов',
        en: 'Moving the totals row',
      }}
      steps={SWITCH}
      args={guideArgs(FOOTER_POSITION_SWITCH_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    let scrollTop = 0
    let body: Element | null = null
    let cell: HTMLElement | undefined
    await step(SWITCH[0].title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(SWITCH[1].title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(scrollerOf(canvas).scrollTop).toBeGreaterThan(0))
      // Ячейку нажало действие шага; фокус с неё гайд снимает (ADR 0117, SN56).
      cell = firstVisibleCell(canvas)!
      await until(() => expect(cell!.dataset.knActive).toBe('true'))
      await until(() => expect(cell!.dataset.cellSelected).toBe('true'))
      await settle()
      scrollTop = scrollerOf(canvas).scrollTop
      body = canvas.querySelector('.data-grid__body')
      await until(() =>
        expect(footerOf(canvas).dataset.position).toBe('pinned'),
      )
    })
    await step(SWITCH[2].title.ru, async () => {
      await guideNext(canvas)
      // FT3: положение сменилось, а прокрутка, активная ячейка и тело — те же.
      await until(() =>
        expect(footerOf(canvas).dataset.position).toBe('inline'),
      )
      await until(() => expect(scrollerOf(canvas).scrollTop).toBe(scrollTop))
      await until(() =>
        expect(canvas.querySelector('.data-grid__body')).toBe(body),
      )
      await until(() => expect(cell!.isConnected).toBe(true))
      await until(() => expect(cell!.dataset.knActive).toBe('true'))
      await until(() => expect(cell!.dataset.cellSelected).toBe('true'))
      await until(() => expect(cell!.tabIndex).toBe(0))
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

const KEYBOARD: readonly DemoStoryStep[] = [
  {
    title: {
      ru: 'Строка итогов за последней строкой',
      en: 'Totals row after the last row',
    },
    hint: {
      ru: 'Строка итогов идёт за последней строкой, фокус вне таблицы.',
      en: 'The totals row comes after the last row; focus is outside the table.',
    },
  },
  {
    title: { ru: 'Фокус на последней строке', en: 'Focus on the last row' },
    keyboard: true,
    hint: {
      ru: 'Фокус на последней строке, строка итогов — сразу под нижним краем.',
      en: 'Focus is on the last row; the totals row is just below the bottom edge.',
    },
    enter: focusLastRow,
  },
  {
    title: { ru: 'Стрелка вниз', en: 'Arrow down' },
    keyboard: true,
    hint: {
      ru: 'Фокус перешёл на строку итогов, таблица докрутилась до конца.',
      en: 'Focus moved to the totals row, and the table scrolled to the end.',
    },
    // Со свежей таблицы фокуса на последней строке нет: сперва он, затем стрелка.
    enter: stepAction(async (root, { signal, onLeave }) => {
      const lastActive = () =>
        root.querySelector('.data-grid__body-row')
          ? lastRowOf(root).contains(
              root.querySelector('[data-kn-active="true"]'),
            )
          : false
      if (!lastActive()) {
        focusLastRow(root)
        await pollUntil(lastActive, signal)
      }
      pressArrowDown(root)
      await pollUntil(
        () => footerOf(root).contains(document.activeElement),
        signal,
      )
    }),
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
    <DemoStory
      title={{
        ru: 'Строка итогов с клавиатуры',
        en: 'Reaching the totals row from the keyboard',
      }}
      steps={KEYBOARD}
      args={guideArgs(FOOTER_KEYBOARD_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(KEYBOARD[0].title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(KEYBOARD[1].title.ru, async () => {
      await guideNext(canvas)
      await waitRows(canvas)
      await until(() =>
        expect(lastRowOf(canvas).contains(document.activeElement)).toBe(true),
      )
      await until(() =>
        expect(rect(footerOf(canvas)).top).toBeGreaterThanOrEqual(
          clientBottom(canvas) - 1,
        ),
      )
    })
    await step(KEYBOARD[2].title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(footerOf(canvas).contains(document.activeElement)).toBe(true),
      )
      await until(() =>
        expect(rect(footerOf(canvas)).bottom).toBeLessThanOrEqual(
          clientBottom(canvas) + 1,
        ),
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

const FEED: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Начало ленты', en: 'Start of the feed' },
    hint: {
      ru: 'Строки подгружаются по мере прокрутки.',
      en: 'Rows load as you scroll.',
    },
  },
  {
    title: {
      ru: 'Строка итогов в бесконечной ленте',
      en: 'Totals row in an infinite feed',
    },
    hint: {
      ru: 'Строка итогов идёт за последней загруженной строкой.',
      en: 'The totals row comes after the last loaded row.',
    },
    enter: scrollToEnd,
  },
  {
    title: { ru: 'Ошибка загрузки', en: 'Load error' },
    hint: {
      ru: 'При загрузке строка итогов стоит после скелетов, при ошибке — перед строкой ошибки.',
      en: 'While loading, the totals row comes after the skeletons; on an error, before the error row.',
    },
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
    <DemoStory
      title={{
        ru: 'Строка итогов в бесконечной ленте',
        en: 'Totals row in an infinite feed',
      }}
      steps={FEED}
      args={guideArgs(INLINE_FOOTER_INFINITE_SCROLL_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const errorRow = () =>
      canvas.querySelector<HTMLElement>('[data-testid="infinite-scroll-error"]')
    await step(FEED[0].title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(FEED[1].title.ru, async () => {
      await guideNext(canvas)
      await waitRows(canvas)
      await until(() =>
        near(rect(footerOf(canvas)).top, rect(lastRowOf(canvas)).bottom),
      )
    })
    await step(FEED[2].title.ru, async () => {
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

const PAGES: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Малый размер страницы', en: 'A small page size' },
    hint: {
      ru: 'Строки страницы помещаются — строка итогов видна сразу.',
      en: "The page's rows fit, so the totals row is visible right away.",
    },
  },
  {
    title: { ru: 'Большой размер страницы', en: 'A large page size' },
    hint: {
      ru: 'Строки страницы не помещаются — строка итогов видна в конце страницы.',
      en: "The page's rows don't fit, so the totals row is visible at the end of the page.",
    },
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
    <DemoStory
      title={{
        ru: 'Строка итогов с пагинацией',
        en: 'Totals row with pagination',
      }}
      steps={PAGES}
      args={guideArgs(INLINE_FOOTER_PAGINATION_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const rows = () => canvas.querySelectorAll('.data-grid__body-row')
    await step(PAGES[0].title.ru, async () => {
      await waitRows(canvas)
      await until(() => expect(rows()).toHaveLength(SMALL_PAGE))
      near(rect(footerOf(canvas)).top, rect(lastRowOf(canvas)).bottom)
      await expect(rect(footerOf(canvas)).bottom).toBeLessThanOrEqual(
        clientBottom(canvas),
      )
    })
    await step(PAGES[1].title.ru, async () => {
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

const SCROLL: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Начало таблицы', en: 'Top of the table' },
    hint: {
      ru: 'Таблица в начале, строка итогов за последней строкой.',
      en: 'The table is at the top; the totals row comes after the last row.',
    },
  },
  {
    title: { ru: 'Середина таблицы', en: 'Middle of the table' },
    hint: {
      ru: 'Таблица прокручена к середине — строки итогов не видно.',
      en: 'The table is scrolled to the middle; the totals row is not visible.',
    },
    enter: scrollToMiddle,
  },
  {
    title: { ru: 'Прокрутка к концу', en: 'Scrolled to the end' },
    hint: {
      ru: 'Приложение прокрутило к последней строке — видна и строка итогов.',
      en: 'The app scrolled to the last row; the totals row is visible too.',
    },
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
    <DemoStory
      title={{ ru: 'Прокрутка к строке', en: 'Scroll to a row' }}
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
    await step(SCROLL[0].title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(SCROLL[1].title.ru, async () => {
      await guideNext(canvas)
      await waitRows(canvas)
      await until(() => expect(scrollApi).not.toBeNull())
      await until(() => expect(scrollerOf(canvas).scrollTop).toBeGreaterThan(0))
      await expect(rect(footerOf(canvas)).top).toBeGreaterThanOrEqual(
        clientBottom(canvas),
      )
    })
    await step(SCROLL[2].title.ru, async () => {
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

const SEARCH: readonly DemoStoryStep[] = [
  {
    title: {
      ru: 'Строка итогов за последней строкой',
      en: 'Totals row after the last row',
    },
    hint: {
      ru: 'Строка итогов идёт сразу за последней строкой.',
      en: 'The totals row comes right after the last row.',
    },
  },
  {
    title: { ru: 'Ничего не найдено', en: 'Nothing found' },
    hint: {
      ru: 'Поиск ничего не нашёл — строка итогов под заглушкой.',
      en: 'The search found nothing; the totals row is below the placeholder.',
    },
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
    <DemoStory
      title={{
        ru: 'Строка итогов и пустой поиск',
        en: 'Totals row and an empty search',
      }}
      steps={SEARCH}
      args={guideArgs(INLINE_FOOTER_EMPTY_SEARCH_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const stub = () =>
      canvas.querySelector<HTMLElement>('[data-testid="filter-stub"]')
    const head = () => canvas.querySelector<HTMLElement>('.data-grid__head')!
    await step(SEARCH[0].title.ru, async () => {
      await waitRows(canvas)
      await until(() =>
        expect(
          canvas.querySelector('[data-testid="quick-search"]'),
        ).not.toBeNull(),
      )
    })
    await step(SEARCH[1].title.ru, async () => {
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

const AUTO_HEIGHT: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Фиксированная высота', en: 'Fixed height' },
    hint: {
      ru: 'Строка итогов у нижнего края таблицы.',
      en: 'The totals row is at the bottom edge of the table.',
    },
  },
  {
    title: {
      ru: 'Высота по строкам',
      en: 'Height by rows',
    },
    hint: {
      ru: 'Таблица по высоте строк, строка итогов сразу под ними.',
      en: 'The table is as tall as its rows; the totals row is right below them.',
    },
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
    <DemoStory
      title={{
        ru: 'Строка итогов при разной высоте таблицы',
        en: 'Totals row at different table heights',
      }}
      steps={AUTO_HEIGHT}
      args={guideArgs(FOOTER_AUTO_HEIGHT_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const gap = () =>
      rect(footerOf(canvas)).top - rect(lastRowOf(canvas)).bottom
    await step(AUTO_HEIGHT[0].title.ru, async () => {
      await waitRows(canvas)
      await until(() =>
        near(rect(footerOf(canvas)).bottom, clientBottom(canvas)),
      )
      await expect(gap()).toBeGreaterThan(100)
    })
    await step(AUTO_HEIGHT[1].title.ru, async () => {
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

// --- S10 -----------------------------------------------------------------------------

/** Первая строка дерева — её раскрывает шаг (дети у каждой 10-й строки мока). */
const firstRowOf = (root: ParentNode) =>
  root.querySelector<HTMLElement>('.data-grid__body-row[data-index="0"]')

/** Кнопка раскрытия первой строки: в роли table состояние раскрытия несёт она. */
const firstToggleOf = (root: ParentNode) =>
  firstRowOf(root)?.querySelector<HTMLElement>('.row-expand-button')

/** Пользователь раскрывает первую строку. */
const expandFirstRow = (root: HTMLElement) => {
  const toggle = firstToggleOf(root)
  if (toggle && toggle.getAttribute('aria-expanded') !== 'true') toggle.click()
}

const EXPAND: readonly DemoStoryStep[] = [
  {
    title: {
      ru: 'Строка итогов за последней строкой',
      en: 'Totals row after the last row',
    },
    hint: {
      ru: 'Строка итогов идёт сразу за последней строкой.',
      en: 'The totals row comes right after the last row.',
    },
  },
  {
    title: { ru: 'Строка раскрыта', en: 'The row is expanded' },
    hint: {
      ru: 'Строка раскрыта — строка итогов плавно съехала вместе со строками.',
      en: 'A row is expanded — the totals row moved down smoothly along with the rows.',
    },
    enter: afterRows(expandFirstRow),
  },
]

const INLINE_FOOTER_EXPANDING_ARGS = {
  ...FOOTER_ARGS,
  dataCount: 5,
  dataNesting: 'nested',
  footerPosition: 'inline',
  enableRowExpanding: true,
  enableTreeLines: true,
} satisfies Partial<StoryProps>

/** S10: раскрытая строка сдвигает строку итогов тем же движением, что строки. */
export const InlineFooterRowExpanding: StoryObj<StoryProps> = {
  name: 'Inline — row expanding',
  parameters: {
    scenario: '0118/S10',
    ...guideControls(),
  },
  render: args => (
    <DemoStory
      title={{
        ru: 'Строка итогов и раскрытие строки',
        en: 'Totals row and row expanding',
      }}
      steps={EXPAND}
      args={guideArgs(INLINE_FOOTER_EXPANDING_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    let before = 0
    await step(EXPAND[0].title.ru, async () => {
      await waitRows(canvas)
      await until(() =>
        near(rect(footerOf(canvas)).top, rect(lastRowOf(canvas)).bottom),
      )
      before = rect(footerOf(canvas)).top
    })
    await step(EXPAND[1].title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(firstToggleOf(canvas)?.getAttribute('aria-expanded')).toBe(
          'true',
        ),
      )
      await settle()
      await expect(rect(footerOf(canvas)).top).toBeGreaterThan(before)
      near(rect(footerOf(canvas)).top, rect(lastRowOf(canvas)).bottom)
    })
  },
}
