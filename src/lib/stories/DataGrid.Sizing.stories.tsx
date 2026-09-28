import { Meta, StoryObj } from '@storybook/react'
import { useArgs } from 'storybook/preview-api'

import { DataGridProps } from '../../lib/grid/dataGridTypes'
import { StoryComponent } from './DataGridStory'
import {
  columnCountType,
  containerHeightType,
  dataCountType,
} from './__mocks__/utils/argTypes'

/**
 * Истории про размеры таблицы.
 *
 * `height` (`number | string | 'auto'`) и `maxHeight` (`number | string`)
 * дуальны: их можно передать числом (px) или строкой (`%`). Storybook-контрол
 * не умеет один union number|string (и ломается на NaN при перезагрузке), поэтому
 * здесь дуальность разложена на две оси — режим (`*Mode`) и значение (`*Value`),
 * а реальный проп собирается в `render`. Так весь матрикс переключается на лету
 * без костыльных раздельных argTypes.
 */

type HeightMode = 'px' | 'percent' | 'auto'
type MaxHeightMode = 'none' | 'px' | 'percent'

interface SizingArgs {
  containerHeight: number
  heightMode: HeightMode
  heightValue: number
  maxHeightMode: MaxHeightMode
  maxHeightValue: number
  columnCount: number
  dataCount: number
  colorMode?: DataGridProps['colorMode']
}

/** Собирает реальный `height` из режима + значения. */
const composeHeight = (
  mode: HeightMode,
  value: number,
): DataGridProps['height'] => {
  if (mode === 'auto') {
    return 'auto'
  }

  if (mode === 'percent') {
    return `${value}%`
  }

  return Number(value)
}

/** Собирает реальный `maxHeight`; `none` → проп не передаётся. */
const composeMaxHeight = (
  mode: MaxHeightMode,
  value: number,
): DataGridProps['maxHeight'] => {
  if (mode === 'none') {
    return undefined
  }

  if (mode === 'percent') {
    return `${value}%`
  }

  return Number(value)
}

const heightModeType = {
  control: { type: 'inline-radio' as const },
  options: ['px', 'percent', 'auto'] satisfies HeightMode[],
  description:
    'Как задать height: число (px), строка `%` или `auto` (flex: 1 в родителе)',
  table: { defaultValue: { summary: 'px' } },
}

const maxHeightModeType = {
  control: { type: 'inline-radio' as const },
  options: ['none', 'px', 'percent'] satisfies MaxHeightMode[],
  description: 'Как задать maxHeight: не передавать, число (px) или строка `%`',
  table: { defaultValue: { summary: 'none' } },
}

const sizeValueType = {
  control: { type: 'number' as const, min: 0, max: 2000, step: 50 },
  description: 'Значение: px для режима px, число процентов для percent',
}

const meta = {
  title: 'Tessera/DataGrid/Sizing',
  parameters: {
    backgrounds: { disable: true },
    layout: 'fullscreen',
    controls: {
      expanded: true,
      exclude: ['colorMode'],
    },
  },
  args: {
    containerHeight: 600,
    heightMode: 'px',
    heightValue: 500,
    maxHeightMode: 'none',
    maxHeightValue: 300,
    columnCount: 20,
    dataCount: 100,
  },
  argTypes: {
    containerHeight: containerHeightType,
    columnCount: columnCountType,
    dataCount: dataCountType,
    heightMode: heightModeType,
    heightValue: sizeValueType,
    maxHeightMode: maxHeightModeType,
    maxHeightValue: sizeValueType,
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs()

    return (
      <StoryComponent
        columnCount={args.columnCount}
        dataCount={args.dataCount}
        containerHeight={args.containerHeight}
        height={composeHeight(args.heightMode, args.heightValue)}
        maxHeight={composeMaxHeight(args.maxHeightMode, args.maxHeightValue)}
        colorMode={args.colorMode}
        showStub={false}
        showHeaderGroups={false}
        showBatchToolbar={false}
        isAllRowsSelected={false}
        page={0}
        recordsOnPage={5}
        updateArgs={updateArgs}
      />
    )
  },
} satisfies Meta<SizingArgs>

export default meta

/**
 * Интерактивная площадка: крути режимы/значения height и maxHeight и смотри,
 * как таблица реагирует на число vs строку vs auto. Покрывает весь матрикс.
 * Дефолт — `px 500` в контейнере 600 (высота честно соблюдается).
 */
export const Playground: StoryObj<SizingArgs> = {
  name: 'Playground',
}

/**
 * Высота числом (px) — абсолютная, НЕ тянется на родителя. Таблица 300px в
 * контейнере 600px → снизу виден пустой зазор: фикс не растягивается.
 */
export const FixedPx: StoryObj<SizingArgs> = {
  name: 'Fixed height (px)',
  args: {
    containerHeight: 600,
    heightMode: 'px',
    heightValue: 300,
    maxHeightMode: 'none',
  },
}

/**
 * Высота строкой `%` — относительная. `50%` от контейнера 400px → 200px, снизу
 * зазор. Показывает, что процент считается от ограниченного родителя (и явно
 * отличается от `auto`, который занял бы всю высоту).
 */
export const Percentage: StoryObj<SizingArgs> = {
  name: 'Percentage height (50%)',
  args: {
    containerHeight: 400,
    heightMode: 'percent',
    heightValue: 50,
    maxHeightMode: 'none',
  },
}

/**
 * `height: 'auto'` — контейнер живёт по flexbox (`flex: 1` + `minHeight: 0`) и
 * заполняет родителя. Тот же видимый размер, что и `height: '100%'`, но другой
 * механизм: работает в растущих flex-раскладках, где процент бы схлопнулся.
 */
export const AutoFlex: StoryObj<SizingArgs> = {
  name: 'Auto height (flex)',
  args: {
    containerHeight: 400,
    heightMode: 'auto',
    maxHeightMode: 'none',
  },
}

/**
 * Ограничение сверху числом: `auto` заполнил бы 600px, но `maxHeight: 300`
 * (px) обрезает до 300.
 */
export const MaxHeightCapPx: StoryObj<SizingArgs> = {
  name: 'Max-height cap (px)',
  args: {
    containerHeight: 600,
    heightMode: 'auto',
    maxHeightMode: 'px',
    maxHeightValue: 300,
  },
}

/**
 * То же ограничение, но строкой `%`: `maxHeight: '50%'` от контейнера 600px →
 * тоже 300px. Показывает вторую форму `maxHeight` (string).
 */
export const MaxHeightCapPercent: StoryObj<SizingArgs> = {
  name: 'Max-height cap (%)',
  args: {
    containerHeight: 600,
    heightMode: 'auto',
    maxHeightMode: 'percent',
    maxHeightValue: 50,
  },
}
