import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'

import { definePlugin } from '../core/definePlugin'
import type { StoryProps } from './DataGridStory.types'
import { StoryComponent } from './DataGridStory'
import { dataGridMeta } from './dataGridMeta'
import {
  afterRows,
  gridDrawn,
  guideNext,
  headCell,
  pointAt,
  pollUntil,
  settle,
  stepDone,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import { chooseGripItem, dragGripTo, separatorOf } from './__mocks__/columnGrip'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import {
  DemoStory,
  type DemoStoryStep,
  guideArgs,
  stepAction,
} from './demos/DemoStory'

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

const NOT_COLUMNS = 'Does not affect column widths'

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

const frame = () => new Promise(resolve => requestAnimationFrame(resolve))
/** Плавный ход за `frames` кадров: `apply` получает долю пути с замедлением к концу. */
const glide = async (
  signal: AbortSignal,
  apply: (part: number) => void,
  frames = 24,
) => {
  for (let i = 1; i <= frames; i++) {
    signal.throwIfAborted()
    const t = i / frames
    apply(t * (2 - t))
    await frame()
  }
}

/** Контейнер приложения вокруг таблицы: ширину ему задаёт история. */
const containerOf = (root: HTMLElement) => {
  let node: HTMLElement | null = scrollerOf(root)
  while (node && !node.style.width.endsWith('px')) node = node.parentElement
  return node
}

/**
 * Окно приложения меняет ширину: край контейнера едет, колонки следуют за ним. Ход — стилем
 * контейнера, итог — пропом приложения один раз: консоль истории не полнится записями.
 */
const resizeWindowTo = (width: number) =>
  stepAction(async (root, { signal }, app) => {
    await pollUntil(() => gridDrawn(root) && !!containerOf(root), signal)
    const container = containerOf(root)!
    const from = container.getBoundingClientRect().width
    await glide(signal, part => {
      container.style.width = `${Math.round(from + (width - from) * part)}px`
    })
    app.update(props => ({ ...props, containerWidth: width }))
    await pollUntil(() => filled(root), signal)
  })

const FLEX_ARGS: Partial<StoryProps> = {
  defaultColumn: { flex: 1 },
  enableColumnSizing: true,
  extraPlugins: [flexHost()],
  columnCount: 4,
  dataCount: 20,
  height: '300',
}

// --- S1: на всю ширину ----------------------------------------------------------------

const FILL: readonly DemoStoryStep[] = [
  {
    title: {
      ru: 'Колонки делят ширину таблицы',
      en: 'Columns share the table width',
    },
    hint: {
      ru: 'Колонки растянуты на всю ширину таблицы: свободного места справа нет, горизонтальной прокрутки тоже.',
      en: 'The columns stretch across the full table width: there is no empty space on the right and no horizontal scrolling.',
    },
    props: () => ({ containerWidth: 800 }),
  },
  {
    title: { ru: 'Окно стало уже', en: 'The window got narrower' },
    hint: {
      ru: 'Таблица сузилась, и колонки сузились вместе с ней: они по-прежнему делят всю ширину поровну.',
      en: 'The table got narrower, and the columns shrank with it: they still share the full width equally.',
    },
    enter: resizeWindowTo(560),
  },
  {
    title: { ru: 'Окно стало шире', en: 'The window got wider' },
    hint: {
      ru: 'Таблица расширилась — колонки снова заняли всю её ширину.',
      en: 'The table got wider, and the columns again fill its full width.',
    },
    enter: resizeWindowTo(900),
  },
]

/** ADR 0216, S1: таблица на всю ширину, окно сужается и расширяется. */
export const FlexFillWidth: StoryObj<StoryProps> = {
  name: 'Fill the width',
  parameters: { scenario: '0216/S1', ...guideControls() },
  render: args => (
    <DemoStory
      title={{ ru: 'Колонки на всю ширину', en: 'Full-width columns' }}
      steps={FILL}
      args={guideArgs({ ...FLEX_ARGS, columnCount: 3 }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    let wide = 0
    await step(FILL[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(filled(canvas)).toBe(true))
      wide = width(canvas, 'firstName')
    })
    await step(FILL[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(width(canvas, 'firstName')).toBeLessThan(wide))
      await until(() => expect(filled(canvas)).toBe(true))
      await settle()
    })
    await step(FILL[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() =>
        expect(width(canvas, 'firstName')).toBeGreaterThan(wide),
      )
      await until(() => expect(filled(canvas)).toBe(true))
      await settle()
    })
  },
}

// --- S2: протяжка флекс-колонки ------------------------------------------------------

const RESIZED = 'country'
const RESIZED_WIDTH = 320

const RESIZE: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Колонки растянуты', en: 'The columns are stretched' },
    hint: {
      ru: 'Все колонки делят ширину таблицы поровну.',
      en: 'All columns share the table width equally.',
    },
  },
  {
    title: {
      ru: 'Пользователь протянул колонку',
      en: 'The user resized a column',
    },
    hint: {
      ru: 'Пользователь сделал первую колонку шире. Теперь её ширина задана, а остальные колонки делят то, что осталось.',
      en: 'The user made the first column wider. Its width is now set, and the other columns share what is left.',
    },
    enter: stepAction(async (root, step) => {
      await pollUntil(
        () => filled(root) && !!separatorOf(root, RESIZED),
        step.signal,
      )
      if (width(root, RESIZED) === RESIZED_WIDTH) return
      // Указатель над заголовком: ручка ширины видна, её тянут вправо.
      const leave = pointAt(headCell(root, RESIZED))
      try {
        await dragGripTo(root, step, RESIZED, RESIZED_WIDTH)
      } finally {
        leave()
      }
      await pollUntil(() => width(root, RESIZED) === RESIZED_WIDTH, step.signal)
    }),
  },
  {
    title: {
      ru: 'Пользователь сбросил ширину',
      en: 'The user reset the width',
    },
    hint: {
      ru: 'Пользователь сбросил ширину колонки в меню ручки: она снова делит ширину таблицы наравне с другими.',
      en: 'The user reset the column width from the resize grip menu: it again shares the table width equally with the others.',
    },
    enter: stepAction(async (root, step) => {
      await pollUntil(
        () => !!sizingApi && !!separatorOf(root, RESIZED),
        step.signal,
      )
      // Протянутая колонка шире соседей; флекс-колонки делят ширину поровну.
      const resized = () =>
        Math.abs(width(root, RESIZED) - width(root, 'lastName')) > 1
      if (resized()) await chooseGripItem(root, step, RESIZED, 'reset')
      await pollUntil(() => !resized() && filled(root), step.signal)
    }),
  },
]

/** ADR 0216, S2: протянутая флекс-колонка становится фиксированной, сброс возвращает флекс. */
export const FlexResize: StoryObj<StoryProps> = {
  name: 'Resize a flex column',
  parameters: { scenario: '0216/S2', ...guideControls() },
  render: args => (
    <DemoStory
      title={{
        ru: 'Протяжка растянутой колонки',
        en: 'Resizing a stretched column',
      }}
      steps={RESIZE}
      args={guideArgs({ ...FLEX_ARGS, containerWidth: 900 }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    let share = 0
    await step(RESIZE[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(filled(canvas)).toBe(true))
      share = width(canvas, 'lastName')
    })
    await step(RESIZE[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(width(canvas, RESIZED)).toBe(RESIZED_WIDTH))
      await expect(width(canvas, 'lastName')).toBeLessThan(share)
      await until(() => expect(filled(canvas)).toBe(true))
      await settle()
    })
    await step(RESIZE[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(width(canvas, 'lastName')).toBe(share))
      await until(() => expect(filled(canvas)).toBe(true))
      await settle()
    })
  },
}

// --- S3: колонки не помещаются ---------------------------------------------------------

/** Наименьшая ширина колонки имени в данных историй. */
const MIN = 150

const OVERFLOW: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Колонки не помещаются', en: 'The columns do not fit' },
    hint: {
      ru: 'Колонкам нужно больше места, чем есть в таблице: каждая на своей наименьшей ширине, и таблица прокручивается по горизонтали.',
      en: 'The columns need more space than the table has: each is at its minimum width, and the table scrolls horizontally.',
    },
  },
  {
    title: {
      ru: 'Пользователь прокрутил таблицу',
      en: 'The user scrolled the table',
    },
    hint: {
      ru: 'Пользователь прокрутил таблицу вправо и видит последние колонки.',
      en: 'The user scrolled the table to the right and sees the last columns.',
    },
    enter: stepAction(async (root, { signal }) => {
      await pollUntil(() => gridDrawn(root), signal)
      const scroller = scrollerOf(root)
      const from = scroller.scrollLeft
      const to = scroller.scrollWidth - scroller.clientWidth
      await glide(
        signal,
        part => {
          scroller.scrollLeft = from + (to - from) * part
        },
        36,
      )
    }),
  },
]

/** ADR 0216, S3: сумма минимумов шире таблицы — колонки на минимуме, прокрутка. */
export const FlexOverflow: StoryObj<StoryProps> = {
  name: 'Columns do not fit',
  parameters: { scenario: '0216/S3', ...guideControls() },
  render: args => (
    <DemoStory
      title={{ ru: 'Колонки шире таблицы', en: 'Columns wider than the table' }}
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
    await step(OVERFLOW[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(width(canvas, 'firstName')).toBe(MIN))
      const scroller = scrollerOf(canvas)
      await expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth)
    })
    await step(OVERFLOW[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() =>
        expect(scrollerOf(canvas).scrollLeft).toBeGreaterThan(0),
      )
      await settle()
    })
  },
}
