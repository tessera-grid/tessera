import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'

import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { guideNext, settle, until } from './__mocks__/catalogPlay'
import { showControls } from './__mocks__/utils/dataGridControls'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { GuideStory, type GuideStoryStep } from './demos/GuideStory'

/**
 * Футер колонок и его положение (ADR 0118): по истории на клиентский сценарий S1–S5.
 * `footerPosition` — `pinned` (у низа области) или `inline` (за последней строкой);
 * сценарий проигрывается панелью над гридом, в тестах шаги проходит `play` (ADR 0117).
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Panels/Footer',
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

/** S1: длинная таблица с закреплёнными итогами — они видны при любой прокрутке. */
export const PinnedFooter: StoryObj<StoryProps> = {
  name: 'Pinned',
  parameters: {
    scenario: '0118/S1',
    ...showControls(['enableFooter', 'footerPosition']),
  },
  args: { ...FOOTER_ARGS, footerPosition: 'pinned' },
  render: args => (
    <GuideStory
      title="Итоги всегда видны"
      steps={PINNED}
      args={normalizeArgs(args)}
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

/** S2: итоги как последняя строка отчёта — до них докручивают. */
export const InlineFooter: StoryObj<StoryProps> = {
  name: 'Inline',
  parameters: {
    scenario: '0118/S2',
    ...showControls(['enableFooter', 'footerPosition']),
  },
  args: { ...FOOTER_ARGS, footerPosition: 'inline' },
  render: args => (
    <GuideStory
      title="Итоги за последней строкой"
      steps={INLINE}
      args={normalizeArgs(args)}
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

/** S3: приложение переключает положение итогов на лету. */
export const FooterPositionSwitch: StoryObj<StoryProps> = {
  name: 'Position switch',
  parameters: {
    scenario: '0118/S3',
    requirements: ['FT3'],
    ...showControls([
      'enableFooter',
      'footerPosition',
      'enableKeyboardNavigation',
    ]),
  },
  args: {
    ...FOOTER_ARGS,
    footerPosition: 'pinned',
    enableKeyboardNavigation: true,
  },
  render: args => (
    <GuideStory
      title="Смена положения итогов"
      steps={SWITCH}
      args={normalizeArgs(args)}
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

/** S4: стрелкой — до итогов, которые не закреплены. */
export const FooterKeyboard: StoryObj<StoryProps> = {
  name: 'Keyboard',
  parameters: {
    scenario: '0118/S4',
    ...showControls([
      'enableFooter',
      'footerPosition',
      'enableKeyboardNavigation',
    ]),
  },
  args: {
    ...FOOTER_ARGS,
    footerPosition: 'inline',
    enableKeyboardNavigation: true,
  },
  render: args => (
    <GuideStory
      title="Итоги с клавиатуры"
      steps={KEYBOARD}
      args={normalizeArgs(args)}
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

/** S5: лента с незакреплёнными итогами — ошибка догрузки встаёт под ними. */
export const InlineFooterInfiniteScroll: StoryObj<StoryProps> = {
  name: 'Inline — infinite scroll',
  parameters: {
    scenario: '0118/S5',
    ...showControls(['enableFooter', 'footerPosition', 'enableInfiniteScroll']),
  },
  args: {
    ...FOOTER_ARGS,
    dataCount: 30,
    footerPosition: 'inline',
    enableInfiniteScroll: true,
  },
  render: args => (
    <GuideStory
      title="Ошибка ленты под итогами"
      steps={FEED}
      args={normalizeArgs(args)}
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
