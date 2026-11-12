import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'

import { definePlugin } from '../core/definePlugin'
import type { StoryProps } from './DataGridStory.types'
import { StoryComponent } from './DataGridStory'
import { dataGridMeta } from './dataGridMeta'
import {
  afterRows,
  guideNext,
  headCell,
  settle,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import { GuideStory, type GuideStoryStep, guideArgs } from './demos/GuideStory'

/**
 * Флекс-колонки (ADR 0216): колонки делят ширину таблицы по весам `flex` в пределах своих
 * `minSize`/`maxSize`. Измените ширину контейнера или протяните колонку — она станет фиксированной.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Columns/Flex width',
} satisfies Meta<StoryProps>

export default meta

const NOT_COLUMNS = 'На ширину колонок не влияет'

export const FlexWidthPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  parameters: showControls(
    ['defaultColumn', 'enableColumnSizing', 'enableColumnPinning'],
    { rowHeight: NOT_COLUMNS, headerHeight: NOT_COLUMNS },
  ),
  args: {
    defaultColumn: { size: 150, minSize: 48, maxSize: 750, flex: 1 },
    enableColumnSizing: true,
    columnCount: 5,
    dataCount: 30,
    containerHeight: '400',
    height: '300',
    maxHeight: '300',
  },
  render: args => <StoryComponent {...normalizeArgs(args)} />,
}

// --- Общее ---------------------------------------------------------------------------

type SizingApi = {
  setColumnSizing: (sizing: Record<string, number>) => void
}

let sizingApi: SizingApi | null = null

/** Отдаёт таблицу шагам истории — ширину меняют, как протяжкой ручки. */
const flexHost = definePlugin<{ enabled?: boolean }>()({
  id: 'flexWidthHost',
  setup: () => table => {
    sizingApi = table as unknown as SizingApi
    return () => {
      sizingApi = null
    }
  },
})

/** Ширины, протянутые пользователем, на шаге: таблица отдаёт их, когда готова. */
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

const scrollerOf = (root: ParentNode) =>
  root.querySelector<HTMLElement>('.data-grid__container')!

const width = (root: HTMLElement, id: string) =>
  Math.round(headCell(root, id).getBoundingClientRect().width)

/** Сумма ширин колонок шапки — ширина области без вертикальной полосы. */
const filled = (root: ParentNode) => {
  const cells = [
    ...root.querySelectorAll<HTMLElement>('.data-grid__head-cell'),
  ].reduce((sum, cell) => sum + cell.getBoundingClientRect().width, 0)
  return Math.abs(cells - scrollerOf(root).clientWidth) <= 1
}

const FLEX_ARGS: Partial<StoryProps> = {
  defaultColumn: { flex: 1 },
  enableColumnSizing: true,
  extraPlugins: [flexHost()],
  columnCount: 4,
  dataCount: 20,
  height: '300',
}

// --- S1: на всю ширину ----------------------------------------------------------------

const FILL: readonly GuideStoryStep[] = [
  {
    title: 'Колонки делят ширину таблицы',
    hint: 'Колонки растянуты на всю ширину таблицы: свободного места справа нет, горизонтальной прокрутки тоже.',
    props: () => ({ containerWidth: 800 }),
  },
  {
    title: 'Окно стало уже',
    hint: 'Таблица сузилась, и колонки сузились вместе с ней: они по-прежнему делят всю ширину поровну.',
    props: () => ({ containerWidth: 560 }),
  },
  {
    title: 'Окно стало шире',
    hint: 'Таблица расширилась — колонки снова заняли всю её ширину.',
    props: () => ({ containerWidth: 900 }),
  },
]

/** ADR 0216, S1: таблица на всю ширину, окно сужается и расширяется. */
export const FlexFillWidth: StoryObj<StoryProps> = {
  name: 'Fill the width',
  parameters: { scenario: '0216/S1', ...guideControls() },
  render: args => (
    <GuideStory
      title="Колонки на всю ширину"
      steps={FILL}
      args={guideArgs({ ...FLEX_ARGS, columnCount: 3 }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    let wide = 0
    await step(FILL[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(filled(canvas)).toBe(true))
      wide = width(canvas, 'firstName')
    })
    await step(FILL[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(width(canvas, 'firstName')).toBeLessThan(wide))
      await until(() => expect(filled(canvas)).toBe(true))
      await settle()
    })
    await step(FILL[2]!.title, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(width(canvas, 'firstName')).toBeGreaterThan(wide),
      )
      await until(() => expect(filled(canvas)).toBe(true))
      await settle()
    })
  },
}

// --- S2: протяжка флекс-колонки ------------------------------------------------------

const RESIZED = 'firstName'
const RESIZED_WIDTH = 320

const RESIZE: readonly GuideStoryStep[] = [
  {
    title: 'Колонки растянуты',
    hint: 'Все колонки делят ширину таблицы поровну.',
    enter: withWidths({}),
  },
  {
    title: 'Пользователь протянул колонку',
    hint: 'Пользователь сделал первую колонку шире. Теперь её ширина задана, а остальные колонки делят то, что осталось.',
    enter: withWidths({ [RESIZED]: RESIZED_WIDTH }),
  },
  {
    title: 'Пользователь сбросил ширину',
    hint: 'Пользователь сбросил ширину колонки в меню ручки: она снова делит ширину таблицы наравне с другими.',
    enter: withWidths({}),
  },
]

/** ADR 0216, S2: протянутая флекс-колонка становится фиксированной, сброс возвращает флекс. */
export const FlexResize: StoryObj<StoryProps> = {
  name: 'Resize a flex column',
  parameters: { scenario: '0216/S2', ...guideControls() },
  render: args => (
    <GuideStory
      title="Протяжка растянутой колонки"
      steps={RESIZE}
      args={guideArgs({ ...FLEX_ARGS, containerWidth: 900 }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    let share = 0
    await step(RESIZE[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(filled(canvas)).toBe(true))
      share = width(canvas, 'lastName')
    })
    await step(RESIZE[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(width(canvas, RESIZED)).toBe(RESIZED_WIDTH))
      await expect(width(canvas, 'lastName')).toBeLessThan(share)
      await until(() => expect(filled(canvas)).toBe(true))
      await settle()
    })
    await step(RESIZE[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(width(canvas, 'lastName')).toBe(share))
      await until(() => expect(filled(canvas)).toBe(true))
      await settle()
    })
  },
}

// --- S3: колонки не помещаются ---------------------------------------------------------

/** Наименьшая ширина колонки имени в данных историй. */
const MIN = 150

const OVERFLOW: readonly GuideStoryStep[] = [
  {
    title: 'Колонки не помещаются',
    hint: 'Колонкам нужно больше места, чем есть в таблице: каждая на своей наименьшей ширине, и таблица прокручивается по горизонтали.',
    enter: afterRows(root => {
      scrollerOf(root).scrollLeft = 0
    }),
  },
  {
    title: 'Пользователь прокрутил таблицу',
    hint: 'Пользователь прокрутил таблицу вправо и видит последние колонки.',
    enter: afterRows(root => {
      const scroller = scrollerOf(root)
      scroller.scrollLeft = scroller.scrollWidth
    }),
  },
]

/** ADR 0216, S3: сумма минимумов шире таблицы — колонки на минимуме, прокрутка. */
export const FlexOverflow: StoryObj<StoryProps> = {
  name: 'Columns do not fit',
  parameters: { scenario: '0216/S3', ...guideControls() },
  render: args => (
    <GuideStory
      title="Колонки шире таблицы"
      steps={OVERFLOW}
      args={guideArgs(
        {
          ...FLEX_ARGS,
          columnCount: 6,
          containerWidth: 600,
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(OVERFLOW[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(width(canvas, 'firstName')).toBe(MIN))
      const scroller = scrollerOf(canvas)
      await expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth)
    })
    await step(OVERFLOW[1]!.title, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(scrollerOf(canvas).scrollLeft).toBeGreaterThan(0),
      )
      await settle()
    })
  },
}
