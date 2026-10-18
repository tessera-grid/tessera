import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'

import { definePlugin } from '../core/definePlugin'
import type { ScrollToRowOptions } from '../core/scrollToRow/scrollToRowFeature'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { vrStates } from './__mocks__/catalog'
import { guideNext, settle, until } from './__mocks__/catalogPlay'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import { GuideStory, type GuideStoryStep, guideArgs } from './demos/GuideStory'

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

/**
 * Вид строки итогов для каталога: грид по содержимому, сумма Total — в футере. Песочница
 * фичи: контролы всех её сценариев.
 */
export const FooterDefault: StoryObj<StoryProps> = {
  name: 'Default',
  parameters: {
    ...vrStates('head.footer'),
    ...showControls(
      [
        'enableFooter',
        'footerPosition',
        'showStub',
        'loading',
        'enableRowAnimation',
        'enableColumnPinning',
        'pinFirstColumn',
        'enableKeyboardNavigation',
        'enablePagination',
        'paginationInitialPageSize',
        'enableQuickSearch',
        'enableInfiniteScroll',
      ],
      {
        headerHeight: 'Футер встаёт под шапкой при любой её высоте',
        defaultColumn:
          'Футер повторяет ширины колонок, своего поведения у него нет',
      },
    ),
  },
  args: FOOTER_ARGS,
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
    title: 'Итоги у низа области',
    hint: "footerPosition: 'pinned' (по умолчанию) — строка итогов прижата к низу области прокрутки.",
  },
  {
    title: 'Прокрутка к середине',
    hint: 'Строки уходят под итоги, итоги остаются у низа и всё время видны.',
    enter: scrollToMiddle,
  },
]

const PINNED_FOOTER_ARGS = {
  ...FOOTER_ARGS,
  footerPosition: 'pinned',
} satisfies Partial<StoryProps>

/** S1: длинная таблица с закреплёнными итогами — они видны при любой прокрутке. */
export const PinnedFooter: StoryObj<StoryProps> = {
  name: 'Pinned',
  parameters: {
    scenario: '0118/S1',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Итоги всегда видны"
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
    title: 'Начало таблицы',
    hint: "footerPosition: 'inline' — итоги не закреплены: в начале таблицы их не видно.",
  },
  {
    title: 'Конец таблицы',
    hint: 'Итоги идут сразу за последней строкой, как последняя строка отчёта.',
    enter: scrollToEnd,
  },
]

const INLINE_FOOTER_ARGS = {
  ...FOOTER_ARGS,
  footerPosition: 'inline',
} satisfies Partial<StoryProps>

/** S2: итоги как последняя строка отчёта — до них докручивают. */
export const InlineFooter: StoryObj<StoryProps> = {
  name: 'Inline',
  parameters: {
    scenario: '0118/S2',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Итоги за последней строкой"
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

const SWITCH: readonly GuideStoryStep[] = [
  {
    title: 'Итоги у низа области',
    hint: 'Таблица прокручена к середине, ячейка выбрана клавиатурой или мышью.',
    enter: scrollToMiddle,
  },
  {
    title: 'Итоги за последней строкой',
    hint: "Приложение меняет footerPosition на 'inline': прокрутка, выбранная ячейка и строки остаются на месте.",
    props: () => ({ footerPosition: 'inline' }),
  },
]

const FOOTER_POSITION_SWITCH_ARGS = {
  ...FOOTER_ARGS,
  footerPosition: 'pinned',
  enableKeyboardNavigation: true,
} satisfies Partial<StoryProps>

/** S3: приложение переключает положение итогов на лету. */
export const FooterPositionSwitch: StoryObj<StoryProps> = {
  name: 'Position switch',
  parameters: {
    scenario: '0118/S3',
    requirements: ['FT3'],
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Смена положения итогов"
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
      await waitRows(canvas)
      await until(() => expect(scrollerOf(canvas).scrollTop).toBeGreaterThan(0))
      await settle()
      cell = canvas.querySelector<HTMLElement>(
        '.data-grid__body-row [data-kn-cell]',
      )!
      cell.focus()
      await until(() => expect(cell!.dataset.knActive).toBe('true'))
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

/** Фокус на ячейке последней строки, итоги — сразу за краем области. */
const focusLastRow = afterRows(root => {
  const scroller = scrollerOf(root)
  scroller.scrollTop = scroller.scrollHeight
  // Строки на новом месте монтируются к следующему кадру.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      scroller.scrollTop -= rect(footerOf(root)).height
      lastRowOf(root).querySelector<HTMLElement>('[data-kn-cell]')?.focus()
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
    hint: 'Итоги не закреплены и сейчас за краем области.',
    enter: focusLastRow,
  },
  {
    title: 'Стрелка вниз',
    hint: 'Фокус переходит на итоги, и они прокручиваются в вид целиком.',
    enter: pressArrowDown,
  },
]

const FOOTER_KEYBOARD_ARGS = {
  ...FOOTER_ARGS,
  footerPosition: 'inline',
  enableKeyboardNavigation: true,
} satisfies Partial<StoryProps>

/** S4: стрелкой — до итогов, которые не закреплены. */
export const FooterKeyboard: StoryObj<StoryProps> = {
  name: 'Keyboard',
  parameters: {
    scenario: '0118/S4',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Итоги с клавиатуры"
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
    title: 'Итоги за последней строкой',
    hint: 'Лента загружена до конца: итоги — последняя строка.',
    enter: scrollToEnd,
  },
  {
    title: 'Сервер отвечает ошибкой',
    hint: 'У сервера есть ещё строки: пока блок в пути — скелет-строки до итогов; отказ — строка ошибки с повтором под итогами.',
    props: () => ({ infiniteScrollHasMore: true, onLoadMore: failingLoad }),
    enter: scrollToEnd,
  },
]

const INLINE_FOOTER_INFINITE_SCROLL_ARGS = {
  ...FOOTER_ARGS,
  dataCount: 30,
  footerPosition: 'inline',
  enableInfiniteScroll: true,
} satisfies Partial<StoryProps>

/** S5: лента с незакреплёнными итогами — ошибка догрузки встаёт под ними. */
export const InlineFooterInfiniteScroll: StoryObj<StoryProps> = {
  name: 'Inline — infinite scroll',
  parameters: {
    scenario: '0118/S5',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Ошибка ленты под итогами"
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
    })
    await settle()
  },
}

// --- S6 ------------------------------------------------------------------------------

const PAGES: readonly GuideStoryStep[] = [
  {
    title: 'Первая страница',
    hint: "footerPosition: 'inline' — итоги сразу за последней строкой страницы.",
  },
  {
    title: 'Последняя страница',
    hint: "На странице две строки — итоги поднимаются за вторую. В 'pinned' итоги остались бы у низа области.",
    enter: root =>
      root.querySelector<HTMLElement>('[data-page-action="last"]')?.click(),
  },
]

const INLINE_FOOTER_PAGINATION_ARGS = {
  ...FOOTER_ARGS,
  dataCount: 12,
  footerPosition: 'inline',
  enablePagination: true,
  paginationInitialPageSize: 5,
} satisfies Partial<StoryProps>

/** S6: итоги за последней строкой каждой страницы. */
export const InlineFooterPagination: StoryObj<StoryProps> = {
  name: 'Inline — pagination',
  parameters: {
    scenario: '0118/S6',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Итоги на каждой странице"
      steps={PAGES}
      args={guideArgs(INLINE_FOOTER_PAGINATION_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const rows = () => canvas.querySelectorAll('.data-grid__body-row')
    await step(PAGES[0].title, async () => {
      await waitRows(canvas)
      await until(() => expect(rows()).toHaveLength(5))
      near(rect(footerOf(canvas)).top, rect(lastRowOf(canvas)).bottom)
    })
    await step(PAGES[1].title, async () => {
      await guideNext(canvas)
      await until(() => expect(rows()).toHaveLength(2))
      await until(() =>
        near(rect(footerOf(canvas)).top, rect(lastRowOf(canvas)).bottom),
      )
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
    title: 'Начало таблицы',
    hint: "footerPosition: 'inline' — итоги за последней строкой, сейчас их не видно.",
  },
  {
    title: 'Строка в середине — по низу',
    hint: "scrollToRow('item-id-50', { align: 'end' }) — строка у низа области, итоги по-прежнему за краем.",
    enter: scrollToRowEnd('item-id-50'),
  },
  {
    title: 'Последняя строка — по низу',
    hint: 'Последняя строка встаёт над итогами, и итоги видны целиком, а не прячутся за край.',
    enter: scrollToRowEnd(LAST_ROW_ID),
  },
]

const INLINE_FOOTER_SCROLL_TO_ROW_ARGS = {
  ...FOOTER_ARGS,
  dataCount: SCROLL_ROWS,
  footerPosition: 'inline',
  extraPlugins: [scrollToRowHost()],
} satisfies Partial<StoryProps>

/** S7: приложение ведёт к строке по низу области — итоги не прячутся за край. */
export const InlineFooterScrollToRow: StoryObj<StoryProps> = {
  name: 'Inline — scroll to row',
  parameters: {
    scenario: '0118/S7',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Прокрутка к строке при итогах за строками"
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
      await expect(rect(footerOf(canvas)).top).toBeGreaterThanOrEqual(
        clientBottom(canvas),
      )
    })
    await step(SCROLL[1].title, async () => {
      await guideNext(canvas)
      await until(() =>
        near(rect(rowById('item-id-50')!).bottom, clientBottom(canvas)),
      )
      await expect(rect(footerOf(canvas)).top).toBeGreaterThanOrEqual(
        clientBottom(canvas) - 1,
      )
    })
    await step(SCROLL[2].title, async () => {
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
    title: 'Итоги за строками',
    hint: "footerPosition: 'inline' — итоги сразу за последней строкой.",
  },
  {
    title: 'Поиск без совпадений',
    hint: "Строк нет: итоги встают под шапку, заглушка — под итогами. В 'pinned' заглушка над итогами, а итоги у низа области.",
    enter: typeSearch('zzz'),
  },
]

const INLINE_FOOTER_EMPTY_SEARCH_ARGS = {
  ...FOOTER_ARGS,
  dataCount: 30,
  footerPosition: 'inline',
  enableQuickSearch: true,
} satisfies Partial<StoryProps>

/** S8: поиск ничего не нашёл — заглушка и итоги не накладываются. */
export const InlineFooterEmptySearch: StoryObj<StoryProps> = {
  name: 'Inline — empty search',
  parameters: {
    scenario: '0118/S8',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Итоги и заглушка поиска"
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
      near(rect(footer).top, rect(head()).bottom)
      await expect(
        footer.compareDocumentPosition(stub()!) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
      await expect(rect(stub()!).top).toBeGreaterThanOrEqual(
        rect(footer).bottom - 1,
      )
    })
    await settle()
  },
}

// --- S9 ------------------------------------------------------------------------------

const AUTO_HEIGHT: readonly GuideStoryStep[] = [
  {
    title: 'Закреплённые итоги',
    hint: "Высота грида не задана — он по содержимому, прокрутки нет: в 'pinned' итоги сразу под строками.",
  },
  {
    title: 'Незакреплённые итоги',
    hint: "Приложение меняет footerPosition на 'inline' — раскладка та же, пустого места над итогами нет.",
    props: () => ({ footerPosition: 'inline' }),
  },
]

const FOOTER_AUTO_HEIGHT_ARGS = {
  columnCount: 7,
  dataCount: 4,
  enableFooter: true,
  footerPosition: 'pinned',
} satisfies Partial<StoryProps>

/** S9: короткая таблица без высоты — итоги одинаковы в обоих режимах. */
export const FooterAutoHeight: StoryObj<StoryProps> = {
  name: 'Auto height',
  parameters: {
    scenario: '0118/S9',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Итоги в гриде без высоты"
      steps={AUTO_HEIGHT}
      args={guideArgs(FOOTER_AUTO_HEIGHT_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const head = () => canvas.querySelector<HTMLElement>('.data-grid__head')!
    const footerOffset = () => rect(footerOf(canvas)).top - rect(head()).top
    let offset = 0
    await step(AUTO_HEIGHT[0].title, async () => {
      await waitRows(canvas)
      await until(() =>
        near(rect(footerOf(canvas)).top, rect(lastRowOf(canvas)).bottom),
      )
      const scroller = scrollerOf(canvas)
      await expect(scroller.scrollHeight).toBeLessThanOrEqual(
        scroller.clientHeight,
      )
      offset = footerOffset()
    })
    await step(AUTO_HEIGHT[1].title, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(footerOf(canvas).dataset.position).toBe('inline'),
      )
      near(footerOffset(), offset)
      near(rect(footerOf(canvas)).top, rect(lastRowOf(canvas)).bottom)
    })
    await settle()
  },
}
