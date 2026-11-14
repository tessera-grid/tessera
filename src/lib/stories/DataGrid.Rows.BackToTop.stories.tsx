import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'

import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import {
  byTestId,
  guideNext,
  pollUntil,
  settle,
  stepDone,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import {
  GuideStory,
  type GuideStoryStep,
  guideArgs,
  stepAction,
} from './demos/GuideStory'

/**
 * Кнопки «наверх» и «к первой колонке» (ADR 0082, ADR 0105): в нижней панели, видны
 * после прокрутки на два экрана. `Playground` — панель от статусбара, пагинации или
 * ленты; S1 — возврат в начало, S1 ADR 0105 — возврат к первой колонке.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Rows/Back to top',
} satisfies Meta<StoryProps>

export default meta

const GRID = {
  containerHeight: '600',
  height: '480',
  maxHeight: '480',
  enableBackToTop: true,
  enableStatusBar: true,
  dataCount: 1000,
} satisfies Partial<StoryProps>

/** Кнопка живёт в нижней панели: её даёт `enableStatusBar`, пагинация или лента. */
export const BackToTopPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  parameters: showControls([
    'enableBackToTop',
    'backToTopThreshold',
    'backToTopHorizontalThreshold',
    'backToTopAxes',
    'enableStatusBar',
    'enablePagination',
    'paginationInitialPageSize',
  ]),
  args: { ...GRID, columnCount: 30 },
}

const scrollerOf = (root: ParentNode) =>
  root.querySelector<HTMLElement>('.data-grid__container')!
const shown = (id: string) => {
  const button = byTestId(id)
  return !!button && button.checkVisibility({ visibilityProperty: true })
}
/** Кнопка погасла: скрыта или, пока на ней фокус, выключена (BT8). */
const inactive = (id: string) =>
  !shown(id) || byTestId(id)?.getAttribute('aria-disabled') === 'true'
const inStatusBar = (id: string) =>
  !!byTestId(id)?.closest('[data-testid="data-grid-status-bar"]')

/** Пользователь прокручивает таблицу по оси, пока не появится кнопка `button`. */
const scrollAway = async (
  root: HTMLElement,
  axis: 'top' | 'left',
  button: string,
  signal: AbortSignal,
) => {
  await pollUntil(() => !!root.querySelector('.data-grid__body-row'), signal)
  // Открытая заново таблица ещё растёт до полной ширины: прокрутку повторить, пока нужно.
  await pollUntil(() => {
    if (shown(button)) return true
    const scroller = scrollerOf(root)
    const size = axis === 'top' ? scroller.clientHeight : scroller.clientWidth
    scroller.scrollTo({ [axis]: size * 2 + 200, behavior: 'instant' })
    return false
  }, signal)
}

/** Пользователь нажимает кнопку возврата, пока прокрутка по оси не станет нулевой. */
const returnBy = async (
  root: HTMLElement,
  axis: 'top' | 'left',
  button: string,
  signal: AbortSignal,
) => {
  await scrollAway(root, axis, button, signal)
  byTestId(button)!.click()
  const scroller = scrollerOf(root)
  await pollUntil(
    () => (axis === 'top' ? scroller.scrollTop : scroller.scrollLeft) === 0,
    signal,
  )
}

// --- ADR 0082 S1 ---------------------------------------------------------------------

const TOP = 'back-to-top'

const RETURN: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Начало таблицы', en: 'Top of the table' },
    hint: {
      ru: 'Таблица открыта в начале. Кнопки возврата нет: возвращаться некуда.',
      en: 'The table is open at the top. There is no back button: there is nowhere to return to.',
    },
  },
  {
    title: { ru: 'Пользователь пролистал вниз', en: 'The user scrolled down' },
    hint: {
      ru: 'Пользователь прокрутил таблицу больше чем на два экрана. В нижней панели появилась кнопка возврата в начало.',
      en: 'The user scrolled the table down by more than two screens. A back-to-top button appeared in the status bar.',
    },
    enter: stepAction((root, { signal }) =>
      scrollAway(root, 'top', TOP, signal),
    ),
  },
  {
    title: {
      ru: 'Пользователь вернулся в начало',
      en: 'The user returned to the top',
    },
    hint: {
      ru: 'Пользователь нажал кнопку возврата. Таблица прокрутилась к первой строке, кнопка возврата больше не активна.',
      en: 'The user clicked the back button. The table scrolled to the first row, and the back button is no longer active.',
    },
    enter: stepAction((root, { signal }) => returnBy(root, 'top', TOP, signal)),
  },
]

/** ADR 0082, S1: пользователь пролистал далеко вниз и вернулся в начало. */
export const BackToTopReturn: StoryObj<StoryProps> = {
  name: 'Return to top',
  parameters: {
    scenario: '0082/S1',
    requirements: ['BT15'],
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title={{ ru: 'Возврат в начало', en: 'Back to the top' }}
      steps={RETURN}
      args={guideArgs({ ...GRID, columnCount: 8 }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(RETURN[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await expect(scrollerOf(canvas).scrollTop).toBe(0)
      await until(() => expect(shown(TOP)).toBe(false))
    })
    await step(RETURN[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(scrollerOf(canvas).scrollTop).toBeGreaterThan(
        scrollerOf(canvas).clientHeight * 2,
      )
      await expect(shown(TOP)).toBe(true)
      await expect(inStatusBar(TOP)).toBe(true)
    })
    await step(RETURN[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(scrollerOf(canvas).scrollTop).toBe(0)
      await until(() => expect(inactive(TOP)).toBe(true))
      await settle()
    })
  },
}

// --- ADR 0105 S1 ---------------------------------------------------------------------

const START = 'back-to-start'

const WIDE: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Широкая таблица', en: 'A wide table' },
    hint: {
      ru: 'Колонок больше, чем помещается на экране. Кнопок возврата нет.',
      en: 'There are more columns than fit on the screen. There are no back buttons.',
    },
  },
  {
    title: {
      ru: 'Пользователь пролистал вправо',
      en: 'The user scrolled right',
    },
    hint: {
      ru: 'Пользователь прокрутил таблицу вправо больше чем на два экрана. В нижней панели появилась кнопка возврата к первой колонке.',
      en: 'The user scrolled the table to the right by more than two screens. A back-to-first-column button appeared in the status bar.',
    },
    enter: stepAction((root, { signal }) =>
      scrollAway(root, 'left', START, signal),
    ),
  },
  {
    title: {
      ru: 'Пользователь вернулся к первой колонке',
      en: 'The user returned to the first column',
    },
    hint: {
      ru: 'Пользователь нажал кнопку. Таблица прокрутилась к первой колонке, вертикальная прокрутка не изменилась, кнопка возврата больше не активна.',
      en: 'The user clicked the button. The table scrolled to the first column, the vertical scroll position did not change, and the back button is no longer active.',
    },
    enter: stepAction((root, { signal }) =>
      returnBy(root, 'left', START, signal),
    ),
  },
]

/** ADR 0105, S1: пользователь пролистал широкую таблицу вправо и вернулся к первой колонке. */
export const BackToTopWide: StoryObj<StoryProps> = {
  name: 'Wide table',
  parameters: {
    scenario: '0105/S1',
    requirements: ['BT24'],
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title={{ ru: 'Возврат к первой колонке', en: 'Back to the first column' }}
      steps={WIDE}
      args={guideArgs({ ...GRID, columnCount: 40 }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(WIDE[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() =>
        expect(scrollerOf(canvas).scrollWidth).toBeGreaterThan(
          scrollerOf(canvas).clientWidth * 3,
        ),
      )
      await until(() => expect(shown(START)).toBe(false))
      await until(() => expect(shown(TOP)).toBe(false))
    })
    await step(WIDE[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(shown(START)).toBe(true))
      await until(() => expect(inStatusBar(START)).toBe(true))
    })
    await step(WIDE[2]!.title.ru, async () => {
      const top = scrollerOf(canvas).scrollTop
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(scrollerOf(canvas).scrollLeft).toBe(0))
      await until(() => expect(scrollerOf(canvas).scrollTop).toBe(top))
      await until(() => expect(inactive(START)).toBe(true))
      await settle()
    })
  },
}
