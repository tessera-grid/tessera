import { Meta, StoryObj } from '@storybook/react'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { makeData } from './__mocks__/data'
import { expect } from 'storybook/test'
import { showControls } from './__mocks__/utils/dataGridControls'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import {
  guideNext,
  orderedRows,
  settle,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import { GuideStory, type GuideStoryStep } from './demos/GuideStory'

/** Группировка строк (ADR 0016); группировка от приложения без кнопок (ADR 0120). */
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
    // Немного колонок, целиком в горизонтальном вьюпорте: тесты адресуют шапку
    // groupable-колонки (gender) — она не должна прятаться за виртуализацией.
    columnCount: 6,

    containerHeight: '560',
    height: '460',
    maxHeight: '460',
  },
  parameters: showControls(['enableRowGrouping']),
}

// --- ADR 0120, S4 --------------------------------------------------------------------

const rowIdsOf = (root: ParentNode) =>
  orderedRows(root as HTMLElement).map(row => row.dataset.rowId ?? '')
const isGroupRow = (id: string) => id.startsWith('gender:')

const BY_APPLICATION: readonly GuideStoryStep[] = [
  {
    title: 'Строки без группировки',
    hint: 'Плагин rowGroupingModel без rowGrouping: в заголовках нет кнопок группировки.',
    props: () => ({ enableRowGroupingModel: true }),
  },
  {
    title: 'Приложение группирует по полу',
    hint: 'Приложение задаёт срез grouping аргументом модели — строки собраны в группы, группы свёрнуты.',
    props: () => ({ rowGroupingModelGrouping: ['gender'] }),
  },
  {
    title: 'И раскрывает группы',
    hint: 'Раскрытием владеет модель дерева: приложение задаёт ей expanded: true — видны строки групп, кнопок по-прежнему нет.',
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
    ...showControls(['enableRowGroupingModel', 'enableRowExpandingModel']),
  },
  args: {
    dataOverride: rowGroupingData,
    columnCount: 6,
    containerHeight: '560',
    height: '460',
    maxHeight: '460',
  },
  render: args => (
    <GuideStory
      title="Группировка от приложения"
      steps={BY_APPLICATION}
      args={normalizeArgs(args)}
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
    })
    await settle()
  },
}
