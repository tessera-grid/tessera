import { useMemo } from 'react'

import { Meta, StoryObj } from '@storybook/react'
import { useArgs } from 'storybook/preview-api'

import { DataGridProps } from '../../lib/grid/dataGridTypes'
import { StoryComponent } from './DataGridStory'
import { makeData } from './__mocks__/data'
import { columnCountType } from './__mocks__/utils/argTypes'

/**
 * Истории про форму данных.
 *
 * Три несвязанных сценария разведены явно:
 * - `flat`    — плоский список строк (объём, faker);
 * - `tree`    — вложенные `subRows` с рабочими тоггл-раскрытиями и отступами;
 * - `grouped` — реальная группировка+агрегация TanStack поверх flat, применена
 *   по умолчанию.
 *
 * Данные генерирует параметризованный `makeData({ shape, count, depth, breadth })` —
 * всё крутится и масштабируется.
 */

type DataShape = 'flat' | 'tree' | 'grouped'
type GroupBy = 'gender' | 'country'

interface DataArgs {
  dataShape: DataShape
  count: number
  depth: number
  breadth: number
  groupBy: GroupBy
  expandAll: boolean
  columnCount: number
  colorMode?: DataGridProps['colorMode']
}

const dataShapeType = {
  control: { type: 'inline-radio' as const },
  options: ['flat', 'tree', 'grouped'] satisfies DataShape[],
  description: 'Форма данных: плоский список / дерево / группировка+агрегация',
  table: { defaultValue: { summary: 'flat' } },
}

const countType = {
  control: { type: 'number' as const, min: 1, max: 1000, step: 10 },
  description: 'Кол-во узлов верхнего уровня (tree) / строк (flat, grouped)',
}

const depthType = {
  control: { type: 'number' as const, min: 1, max: 5, step: 1 },
  description: 'Глубина дерева (только shape=tree)',
}

const breadthType = {
  control: { type: 'number' as const, min: 1, max: 6, step: 1 },
  description: 'Детей на узел (только shape=tree)',
}

const groupByType = {
  control: { type: 'inline-radio' as const },
  options: ['gender', 'country'] satisfies GroupBy[],
  description: 'Колонка группировки (только shape=grouped)',
  table: { defaultValue: { summary: 'gender' } },
}

const expandAllType = {
  control: { type: 'boolean' as const },
  description:
    'Раскрыть дерево/группы сразу — чтобы фича была видна без кликов (tree/grouped)',
  table: { defaultValue: { summary: 'true' } },
}

const meta = {
  title: 'Tessera/DataGrid/Data',
  parameters: {
    backgrounds: { disable: true },
    layout: 'fullscreen',
    controls: {
      expanded: true,
      exclude: ['colorMode'],
    },
  },
  args: {
    dataShape: 'tree',
    count: 5,
    depth: 3,
    breadth: 3,
    groupBy: 'gender',
    expandAll: true,
    columnCount: 7,
  },
  argTypes: {
    dataShape: dataShapeType,
    count: countType,
    depth: depthType,
    breadth: breadthType,
    groupBy: groupByType,
    expandAll: expandAllType,
    columnCount: columnCountType,
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs()

    // Собираем набор данных + флаги под выбранную форму. Мемоизация — чтобы
    // StoryComponent (memo) не перерисовывался на каждый чих.
    const shaped = useMemo(() => {
      if (args.dataShape === 'tree') {
        return {
          dataOverride: makeData({
            shape: 'tree',
            count: args.count,
            depth: args.depth,
            breadth: args.breadth,
          }),
          enableRowExpanding: true,
          enableGrouping: false,
          initialGrouping: undefined as string[] | undefined,
        }
      }

      if (args.dataShape === 'grouped') {
        return {
          dataOverride: makeData({ shape: 'flat', count: args.count }),
          // Раскрытие групп: тоггл на строке-группе проваливает в записи.
          enableRowExpanding: true,
          enableGrouping: true,
          initialGrouping: [args.groupBy],
        }
      }

      return {
        dataOverride: makeData({ shape: 'flat', count: args.count }),
        enableRowExpanding: false,
        enableGrouping: false,
        initialGrouping: undefined as string[] | undefined,
      }
    }, [args.dataShape, args.count, args.depth, args.breadth, args.groupBy])

    // Раскрыть всё сразу — чтобы иерархия/группы были наглядны без кликов.
    const initialExpanded =
      shaped.enableRowExpanding && args.expandAll ? true : undefined

    return (
      <StoryComponent
        // Remount при смене формы/раскрытия — сбрасывает expanded/grouping.
        key={`${args.dataShape}-${args.expandAll}`}
        columnCount={args.columnCount}
        dataCount={args.count}
        containerHeight={600}
        height={500}
        maxHeight={undefined}
        colorMode={args.colorMode}
        dataOverride={shaped.dataOverride}
        enableRowExpanding={shaped.enableRowExpanding}
        enableGrouping={shaped.enableGrouping}
        initialGrouping={shaped.initialGrouping}
        initialExpanded={initialExpanded}
        showStub={false}
        showHeaderGroups={false}
        showBatchToolbar={false}
        isAllRowsSelected={false}
        updateArgs={updateArgs}
      />
    )
  },
} satisfies Meta<DataArgs>

export default meta

/**
 * Интерактивная площадка: переключай форму данных (flat / tree / grouped) и
 * крути count / depth / breadth / groupBy. Дерево раскрывается тогглами,
 * группировка применена по умолчанию.
 */
export const Playground: StoryObj<DataArgs> = {
  args: {
    dataShape: 'flat',
  },

  name: 'Playground',
}

/** Плоский список на объёме — базовый кейс, чувствителен к count. */
export const Flat: StoryObj<DataArgs> = {
  name: 'Flat (volume)',
  args: {
    dataShape: 'flat',
    count: 200,
  },
}

/** Дерево с рабочими тогглами и отступами по глубине (32px/уровень). */
export const Tree: StoryObj<DataArgs> = {
  name: 'Tree (nested)',
  args: {
    dataShape: 'tree',
    count: 5,
    depth: 3,
    breadth: 3,
  },
}

/** Дерево на объёме — виртуализация вложенных строк (свёрнуто, чтобы виден масштаб). */
export const TreeAtScale: StoryObj<DataArgs> = {
  name: 'Tree at scale',
  args: {
    dataShape: 'tree',
    count: 60,
    depth: 3,
    breadth: 4,
    expandAll: false,
  },
}

/**
 * Группировка+агрегация применена по умолчанию: строки-группы со сводкой,
 * числовые колонки (Visits/Total) показывают сумму, тоггл проваливает в записи.
 */
export const Grouped: StoryObj<DataArgs> = {
  name: 'Grouped & aggregated',
  args: {
    dataShape: 'grouped',
    count: 60,
    groupBy: 'gender',
  },
}
