import { Meta, StoryObj } from '@storybook/react'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { makeData } from './__mocks__/data'
import { useArgs } from 'storybook/preview-api'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import {
  RowExpandingLazyChildrenDemo,
  RowExpandingLazyDemo,
  type ServerFailMode,
} from './demos/sessionDemos'
import { vrStates } from './__mocks__/catalog'

/** Раскрытие строк (ADR 0015, ADR 0054, ADR 0058): дерево, линии, плоские данные, ленивые дети. */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Rows/Expanding',
} satisfies Meta<StoryProps>

export default meta

// Дерево в 4 уровня для линий дерева: по уровню на шаг отступа.
const treeLinesData = makeData({
  shape: 'tree',
  count: 6,
  depth: 4,
  breadth: 2,
})

// Данные для истории Rows/Expanding — Basic (генератор, а не захардкоженные строки).
// Дерево из 3 уровней: корни (depth 0) и их дети (depth 1) — узлы `isGroup`, у
// внуков (depth 2) детей нет. Три уровня специально: при `maxExpandingDepth = 1`
// раскрывать можно только корни, а группы глубже (depth 1) тоггла не получают
// (RE8). Плюс несколько плоских листовых корней (без subRows) — раскрываемости у
// них нет, тоггла нет (RE7).
const rowExpandingData = [
  ...makeData({ shape: 'tree', count: 3, depth: 3, breadth: 2 }),
  ...makeData({ shape: 'flat', count: 2 }),
]

/** Аргументы демо-историй: задержка и отказ «сервера», предустановки на лету. */
interface SessionsArgs extends StoryProps {
  serverDelayMs?: number
  serverFailMode?: ServerFailMode
  conflictMode?: 'commit' | 'block'
  loadDelayMs?: number
  loadFailMode?: ServerFailMode
  /** ADR 0039: предел мультисортировки на лету. */
  multiSortMax?: number
  /** ADR 0039: разрешить правку на лету. */
  allowEditing?: boolean
  /** ADR 0039: набор размеров страницы на лету. */
  pageSizesPreset?: 'default' | 'small' | 'hidden'
}

const GRID = {
  columnCount: 6,
  containerHeight: 560,
  height: 460,
  maxHeight: 460,
}

const failModeControl = {
  control: 'inline-radio',
  options: ['never', 'always'],
} as const

const hideDataControls = {
  controls: { exclude: ['columnCount', 'dataCount', 'colorMode'] },
}

export const RowExpanding: StoryObj<StoryProps> = {
  name: 'Basic',
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
  name: 'Tree lines',
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
    ...vrStates('body.treeLines'),
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
  name: 'Flat data',
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
  name: 'Column always',
  args: {
    dataOverride: makeData({ shape: 'flat', count: 12 }),
    enableRowExpanding: true,
    rowExpandingColumn: 'always',
  },
  parameters: {
    controls: { exclude: ['dataCount', 'dataOverride'] },
  },
}

export const RowExpandingLazy: StoryObj<SessionsArgs> = {
  name: 'Lazy load (async)',
  args: {
    ...GRID,
    // Раскрытие с промисом (ADR 0041): строка раскрывается сразу, кнопка и строка
    // ждут «подгрузки» (aria-busy), повторное нажатие игнорируется; отказ
    // сворачивает строку обратно. Потомки уже в данных — задержка имитирует сеть.
    enableRowExpanding: true,
    rowExpandingMaxDepth: 2,
    loadDelayMs: 1200,
    loadFailMode: 'never',
  },
  argTypes: {
    loadDelayMs: { control: { type: 'range', min: 0, max: 5000, step: 250 } },
    loadFailMode: failModeControl,
  },
  parameters: hideDataControls,
  render: function Render(args) {
    const [, updateArgs] = useArgs()
    return (
      <RowExpandingLazyDemo {...normalizeArgs(args)} updateArgs={updateArgs} />
    )
  },
}

/**
 * Ленивые дети (ADR 0054): у корней нет `subRows`, `hasChildren` читает `childCount`,
 * `loadChildren` на каждое раскрытие получает детей с «сервера». Повторное раскрытие
 * сразу показывает прошлый ответ и обновляет его; `node-3` сервер вернёт пустым — строка
 * станет листом; «Fail next load» и `loadFailMode` — вспышка тоггла и объявление.
 * Новые дети ответа подсвечены и объявлены (ADR 0056).
 */
export const RowExpandingLazyChildren: StoryObj<SessionsArgs> = {
  name: 'Lazy children (server)',
  args: {
    ...GRID,
    enableRowExpanding: true,
    rowExpandingMaxDepth: 2,
    loadDelayMs: 900,
    loadFailMode: 'never',
  },
  argTypes: {
    loadDelayMs: { control: { type: 'range', min: 0, max: 5000, step: 250 } },
    loadFailMode: failModeControl,
  },
  parameters: hideDataControls,
  render: function Render(args) {
    const [, updateArgs] = useArgs()
    return (
      <RowExpandingLazyChildrenDemo
        {...normalizeArgs(args)}
        updateArgs={updateArgs}
      />
    )
  },
}
