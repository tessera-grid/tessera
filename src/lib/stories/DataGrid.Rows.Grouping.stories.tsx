import { Meta, StoryObj } from '@storybook/react'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { makeData } from './__mocks__/data'
import { vrStates } from './__mocks__/catalog'
import { expect } from 'storybook/test'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import {
  guideNext,
  orderedRows,
  settle,
  stepDone,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import { untilDone } from './__mocks__/cellGestures'
import {
  GuideStory,
  type GuideStoryStep,
  guideArgs,
  stepAction,
} from './demos/GuideStory'

/**
 * Группировка строк (ADR 0016); группировка от приложения без кнопок (ADR 0120); липкие строки
 * групп (ADR 0160, S3).
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Rows/Grouping',
} satisfies Meta<StoryProps>

export default meta

// Плоский детерминированный набор для истории Row Grouping — генератор
// (faker.seed), а не захардкоженные строки. Группировка по колонке с малым
// числом различных значений (gender) агрегирует их в несколько групп-строк.
const rowGroupingData = makeData({ shape: 'flat', count: 12 })

export const RowGroupingPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  args: {
    // Реальные данные из генератора (см. rowGroupingData) — группировка видна на
    // настоящих строках, а не на захардкоженных.
    dataOverride: rowGroupingData,
    enableRowGrouping: true,
    // Строки сгруппированы по полу и раскрыты: строки-группы со сводкой и записи под ними.
    initialGrouping: ['gender'],
    enableRowExpanding: true,
    initialExpanded: true,
    // Немного колонок, целиком в горизонтальном вьюпорте: тесты адресуют шапку
    // groupable-колонки (gender) — она не должна прятаться за виртуализацией.
    columnCount: 6,

    containerHeight: '560',
    height: '460',
    maxHeight: '460',
  },
  parameters: {
    ...vrStates('body.groups'),
    ...showControls([
      'enableRowGrouping',
      'rowGroupingStickyRows',
      'enableRowExpanding',
    ]),
  },
}

// --- ADR 0120, S4 --------------------------------------------------------------------

const rowIdsOf = (root: ParentNode) =>
  orderedRows(root as HTMLElement).map(row => row.dataset.rowId ?? '')
const isGroupRow = (id: string) => id.startsWith('gender:')

const BY_APPLICATION: readonly GuideStoryStep[] = [
  {
    title: 'Строки без группировки',
    hint: 'Группировкой управляет приложение, кнопок группировки в заголовках нет. Строки идут списком.',
    props: () => ({ enableRowGroupingModel: true }),
  },
  {
    title: 'Приложение группирует по полу',
    hint: 'Приложение сгруппировало строки по полу. Таблица показывает свёрнутые группы.',
    props: () => ({ rowGroupingModelGrouping: ['gender'] }),
  },
  {
    title: 'Приложение раскрывает группы',
    hint: 'Приложение раскрыло все группы. Таблица показывает строки внутри групп, кнопок группировки по-прежнему нет.',
    props: () => ({
      enableRowExpandingModel: true,
      rowExpandingModelExpanded: true,
    }),
  },
]

/** ADR 0120, S4: приложение задаёт группировку само — модель без кнопок в заголовках. */
export const GroupingByApplication: StoryObj<StoryProps> = {
  name: 'By application',
  parameters: {
    scenario: '0120/S4',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Группировка от приложения"
      steps={BY_APPLICATION}
      args={guideArgs(
        {
          dataOverride: rowGroupingData,
          columnCount: 6,
          containerHeight: '560',
          height: '460',
          maxHeight: '460',
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    // В Storybook сценарий проходит человек; `play` — только в тестах каталога.
    if (globals.catalog !== true) return
    await step(BY_APPLICATION[0].title, async () => {
      await waitForRows(canvas)
      expect(canvas.querySelector('.column-group__button')).toBeNull()
      expect(rowIdsOf(canvas).some(isGroupRow)).toBe(false)
    })
    await step(BY_APPLICATION[1].title, async () => {
      await guideNext(canvas)
      await until(() => expect(rowIdsOf(canvas).every(isGroupRow)).toBe(true))
      expect(canvas.querySelector('.column-group__button')).toBeNull()
    })
    await step(BY_APPLICATION[2].title, async () => {
      await guideNext(canvas)
      await until(() => {
        const ids = rowIdsOf(canvas)
        expect(ids.some(isGroupRow)).toBe(true)
        expect(ids.some(id => !isGroupRow(id))).toBe(true)
      })
      expect(canvas.querySelector('.column-group__button')).toBeNull()
    })
    await settle()
  },
}

// --- ADR 0160, S3: липкие строки групп ------------------------------------------------

const stickyData = makeData({ shape: 'flat', count: 40 })
const STICKY_ARGS = {
  dataOverride: stickyData,
  enableRowGrouping: true,
  rowGroupingStickyRows: true,
  initialGrouping: ['gender'],
  enableRowExpanding: true,
  initialExpanded: true,
  enableTreeLines: true,
  columnCount: 6,
  containerHeight: '560',
  height: '460',
  maxHeight: '460',
} satisfies Partial<StoryProps>

const scrollerOf = (root: ParentNode) =>
  root.querySelector<HTMLElement>('.data-grid__container')
/** Липкие копии под шапкой — id строк. */
const stickyIds = (root: ParentNode) =>
  [
    ...root.querySelectorAll<HTMLElement>('[data-sticky-rows] [data-row-id]'),
  ].map(row => row.dataset.rowId)
const stickyTop = (root: ParentNode) =>
  parseFloat(
    root.querySelector<HTMLElement>('[data-sticky-rows] [data-row-id]')?.style
      .top ?? '0',
  )
/** Строка тела (не липкая копия). */
const realRow = (root: ParentNode, id: string) =>
  root.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${id}"]:not([data-sticky-copy])`,
  )
/** Строки-группы тела по порядку, без липких копий. */
const groupIds = (root: ParentNode) =>
  orderedRows(root as HTMLElement)
    .filter(row => !row.hasAttribute('data-sticky-copy'))
    .map(row => row.dataset.rowId ?? '')
    .filter(isGroupRow)
const rowHeightOf = (root: ParentNode) =>
  root.querySelector<HTMLElement>('.data-grid__body-row')?.offsetHeight ?? 0

/** Прокрутить тело так, чтобы верх второй группы стоял на `gap` строк ниже шапки. */
const scrollToSecondGroup = async (root: HTMLElement, gap: number) => {
  const scroller = scrollerOf(root)!
  const h = rowHeightOf(root)
  scroller.scrollTop = 0
  await new Promise(resolve => setTimeout(resolve, 30))
  const first = groupIds(root)[0]
  for (let tries = 0; tries < 40; tries++) {
    const second = groupIds(root).find(id => id !== first)
    const row = second ? realRow(root, second) : null
    if (row) {
      scroller.scrollTop = parseFloat(row.style.top) - gap * h
      await new Promise(resolve => setTimeout(resolve, 30))
      return
    }
    scroller.scrollTop += 4 * h
    await new Promise(resolve => setTimeout(resolve, 30))
  }
}

const STICKY: readonly GuideStoryStep[] = [
  {
    title: 'Группы раскрыты',
    hint: 'Строки сгруппированы по полу, группы раскрыты. Строка группы — над её строками.',
    enter: untilDone(
      root => (scrollerOf(root)?.scrollTop ?? 1) === 0,
      root => {
        const scroller = scrollerOf(root)
        if (scroller) scroller.scrollTop = 0
      },
    ),
  },
  {
    title: 'Пользователь прокрутил группу',
    hint: 'Строка группы ушла вверх, но держится под шапкой, пока видны её строки: видно, в какой группе пользователь. Линия отделяет её от строк ниже.',
    enter: untilDone(
      root => stickyIds(root).length === 1 && stickyTop(root) === 0,
      root => {
        const scroller = scrollerOf(root)
        if (scroller) scroller.scrollTop = rowHeightOf(root) * 3
      },
    ),
  },
  {
    title: 'Следующая группа подошла',
    hint: 'Строка следующей группы подошла к липкой и выталкивает её вверх: под шапкой окажется новая группа.',
    enter: stepAction(async root => {
      await scrollToSecondGroup(root, 0.5)
    }),
  },
  {
    title: 'Пользователь свернул группу из липкой строки',
    hint: 'Нажатие на шеврон липкой строки свернуло её группу, и таблица прокрутила к строке группы: она снова на своём месте в списке, липких строк нет.',
    enter: untilDone(
      root =>
        stickyIds(root).length === 0 &&
        realRow(root, groupIds(root)[0] ?? '')?.dataset.expanded === 'false',
      root => {
        const scroller = scrollerOf(root)
        if (!scroller) return
        // Липкую строку выталкивает следующая группа — шеврон наполовину под шапкой:
        // сперва прокрутка к месту, где она стоит под шапкой целиком.
        if (stickyIds(root).length === 0 || stickyTop(root) < 0) {
          scroller.scrollTop = rowHeightOf(root) * 3
          return
        }
        root
          .querySelector<HTMLElement>(
            '[data-sticky-rows] [data-row-id] .row-expand-button',
          )
          ?.click()
      },
    ),
  },
]

/** ADR 0160, S3: строка длинной группы держится под шапкой, следующая её выталкивает. */
export const GroupingStickyRows: StoryObj<StoryProps> = {
  name: 'Sticky group rows',
  parameters: { scenario: '0160/S3', ...guideControls() },
  render: args => (
    <GuideStory
      title="Липкие строки групп"
      steps={STICKY}
      args={guideArgs(STICKY_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(STICKY[0]!.title, async () => {
      await waitForRows(canvas)
      await expect(stickyIds(canvas)).toEqual([])
    })
    await step(STICKY[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(stickyIds(canvas)).toHaveLength(1))
      await expect(stickyIds(canvas)[0]).toBe(groupIds(canvas)[0])
    })
    await step(STICKY[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(stickyTop(canvas)).toBeLessThan(0))
    })
    await step(STICKY[3]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(stickyIds(canvas)).toEqual([]))
      await expect(
        realRow(canvas, groupIds(canvas)[0]!)?.dataset.expanded,
      ).toBe('false')
      await settle()
    })
  },
}
