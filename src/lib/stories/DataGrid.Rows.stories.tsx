import { Meta, StoryObj } from '@storybook/react'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { makeData } from './__mocks__/data'

/** Истории строк: выбор, раскрытие, группировка, перетаскивание, действия. */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Rows',
} satisfies Meta<StoryProps>

export default meta

// Детерминированное дерево для истории SubRow Selection (генератор, а не
// захардкоженные данные) — 4 родителя × 3 ребёнка, наглядный каскад выбора.
const subRowSelectionTree = makeData({
  shape: 'tree',
  count: 4,
  depth: 2,
  breadth: 3,
})

// Данные для истории Row Expanding (генератор, а не захардкоженные строки).
// Дерево из 3 уровней: корни (depth 0) и их дети (depth 1) — узлы `isGroup`, у
// внуков (depth 2) детей нет. Три уровня специально: при `maxExpandingDepth = 1`
// раскрывать можно только корни, а группы глубже (depth 1) тоггла не получают
// (RE8). Плюс несколько плоских листовых корней (без subRows) — раскрываемости у
// них нет, тоггла нет (RE7).
const treeLinesData = makeData({
  shape: 'tree',
  count: 6,
  depth: 4,
  breadth: 2,
})

const rowExpandingData = [
  ...makeData({ shape: 'tree', count: 3, depth: 3, breadth: 2 }),
  ...makeData({ shape: 'flat', count: 2 }),
]

// Плоский детерминированный набор для истории Row Grouping — генератор
// (faker.seed), а не захардкоженные строки. Группировка по колонке с малым
// числом различных значений (gender) агрегирует их в несколько групп-строк.
const rowGroupingData = makeData({ shape: 'flat', count: 12 })

export const RowActionMenu: StoryObj<StoryProps> = {
  name: 'Row Action Menu',
  args: {
    // Демо-производитель даёт три действия строки (Edit / Duplicate / Delete) как
    // дескрипторы. Свич `enableRowActionMenu` (порог 2) схлопывает их в overflow-
    // кебаб (⋮) в колонке действий; выключенным — три row-кнопки инлайн (ревил по
    // hover строки). Колонка действий появляется по `enableRowActions`.
    enableRowActions: true,
    enableRowActionMenu: true,
    dataCount: 30,
    containerHeight: 400,
    height: 300,
    maxHeight: 300,
  },
}

export const RowSelection: StoryObj<StoryProps> = {
  name: 'Row Selection',
  args: {
    enableRowSelection: true,
    // Небольшой набор, целиком помещающийся в вьюпорт: требования «выбрать все
    // на странице» (RS8–RS10, RS12) сверяются со всеми отрисованными строками,
    // поэтому вертикальная виртуализация не должна прятать часть строк.
    dataCount: 10,
    containerHeight: 560,
    height: 460,
    maxHeight: 460,
  },
}

export const BatchRowSelection: StoryObj<StoryProps> = {
  name: 'Batch Row Selection',
  args: {
    // Пакетный выбор «все строки» (BatchToolbar) поверх пагинации плагином: выбор
    // живёт по id и переживает смену страницы.
    enableRowSelection: true,
    showBatchToolbar: true,
    isAllRowsSelected: false,
    enablePagination: true,
    paginationPageSize: 5,
    dataCount: 50,
  },
}

export const SubRowSelection: StoryObj<StoryProps> = {
  name: 'SubRow Selection',
  args: {
    // Реальное дерево из генератора (раскрыто), чтобы каскад выбора
    // родитель↔дети был нагляден — не на захардкоженных 5 строках.
    dataOverride: subRowSelectionTree,
    initialExpanded: true,

    enableRowSelection: true,
    enableSubRowSelection: true,
    enableRowExpanding: true,
  },
  parameters: {
    controls: {
      exclude: ['columnCount', 'dataCount', 'dataOverride', 'initialExpanded'],
    },
  },
}

export const RowExpanding: StoryObj<StoryProps> = {
  name: 'Row Expanding',
  args: {
    // Реальные данные из генератора (см. rowExpandingData) — раскрытие видно на
    // настоящих subRows, а не на захардкоженных строках.
    dataOverride: rowExpandingData,
    enableRowExpanding: true,
    // Стартуем свёрнутыми: тесты сами раскрывают строки и сверяют появление
    // детей и контракт data-expanded / aria-expanded.
    initialExpanded: {},

    containerHeight: 640,
    height: 540,
    maxHeight: 540,
  },
  parameters: {
    controls: {
      exclude: ['columnCount', 'dataCount', 'dataOverride', 'initialExpanded'],
    },
  },
}

/**
 * Линии дерева (ADR 0058): вертикальные направляющие по уровням в отступе первой
 * колонки. Дерево в 4 уровня раскрыто целиком; выключите `rowExpandingTreeLines`,
 * чтобы сравнить с одним отступом.
 */
export const RowExpandingTreeLines: StoryObj<StoryProps> = {
  name: 'Row Expanding — tree lines',
  args: {
    dataOverride: treeLinesData,
    enableRowExpanding: true,
    rowExpandingMaxDepth: 4,
    rowExpandingTreeLines: true,
    initialExpanded: true,
    containerHeight: 640,
    height: 540,
    maxHeight: 540,
  },
  parameters: {
    controls: {
      exclude: ['columnCount', 'dataCount', 'dataOverride'],
    },
  },
}

/**
 * Раскрытие на плоских данных: раскрывать нечего — колонки раскрытия нет (ADR 0050).
 * Включите `rowExpandingColumn: 'always'`, чтобы держать колонку (серверный режим).
 */
export const RowExpandingFlatData: StoryObj<StoryProps> = {
  name: 'Row Expanding — flat data',
  args: {
    dataOverride: makeData({ shape: 'flat', count: 12 }),
    enableRowExpanding: true,
    enableRowSelection: true,
  },
  parameters: {
    controls: { exclude: ['dataCount', 'dataOverride'] },
  },
}

/** Колонка раскрытия в режиме `'always'`: есть и без раскрываемых строк (ADR 0050). */
export const RowExpandingColumnAlways: StoryObj<StoryProps> = {
  name: 'Row Expanding — column always',
  args: {
    dataOverride: makeData({ shape: 'flat', count: 12 }),
    enableRowExpanding: true,
    rowExpandingColumn: 'always',
  },
  parameters: {
    controls: { exclude: ['dataCount', 'dataOverride'] },
  },
}

export const RowGrouping: StoryObj<StoryProps> = {
  name: 'Row Grouping',
  args: {
    // Реальные данные из генератора (см. rowGroupingData) — группировка видна на
    // настоящих строках, а не на захардкоженных.
    dataOverride: rowGroupingData,
    enableGrouping: true,
    // Немного колонок, целиком в горизонтальном вьюпорте: тесты адресуют шапку
    // groupable-колонки (gender) — она не должна прятаться за виртуализацией.
    columnCount: 6,

    containerHeight: 560,
    height: 460,
    maxHeight: 460,
  },
  parameters: {
    controls: {
      exclude: ['columnCount', 'dataCount', 'dataOverride'],
    },
  },
}

export const RowDragging: StoryObj<StoryProps> = {
  name: 'Row Dragging',
  args: {
    enableRowDragging: true,
    // Sized to overflow on both axes so the play's auto-scroll steps (D12–D14)
    // have real vertical + horizontal scroll to exercise.
    dataCount: 60,
    containerHeight: 400,
    height: 300,
    maxHeight: 300,
  },
}

export const RowActions: StoryObj<StoryProps> = {
  name: 'Row Actions',
  args: {
    enableRowActions: true,
  },
}

/**
 * Плагин действий без единого действия: колонки действий нет (ADR 0050). Включите
 * `rowActionsDemo`, чтобы действия появились вместе с колонкой.
 */
export const RowActionsWithoutActions: StoryObj<StoryProps> = {
  name: 'Row Actions — no actions',
  args: {
    enableRowActions: true,
    rowActionsDemo: false,
  },
}
