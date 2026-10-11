import { Meta, StoryObj } from '@storybook/react'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { withVrModes } from './__mocks__/catalog'
import { makeData } from './__mocks__/data'

/** Выбор строк (ADR 0014): флажки, пакетный тулбар, дочерние строки. */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Rows/Selection',
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

// Узловая история: снимается во всех режимах осей каталога (ADR 0093, VR9).
export const RowSelection: StoryObj<StoryProps> = withVrModes({
  name: 'Basic',
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
})

export const BatchRowSelection: StoryObj<StoryProps> = {
  name: 'Batch toolbar',
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
  name: 'Sub-rows',
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
