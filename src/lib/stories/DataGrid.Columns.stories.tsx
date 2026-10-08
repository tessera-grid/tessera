import { Meta, StoryObj } from '@storybook/react'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import {
  filteringColumns,
  filteringData,
  optionFilteringColumns,
  optionFilteringData,
} from './__mocks__/filteringData'

/** Истории колонок: размеры, сортировка, перетаскивание, закрепление, шапка. */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Columns',
} satisfies Meta<StoryProps>

export default meta

export const ColumnResizing: StoryObj<StoryProps> = {
  name: 'Column Resizing',
  args: {
    enableColumnResizing: true,
    // Несколько строк, чтобы требование синхронизации ширины шапки и тела
    // (CR8) имело отрисованные body-ячейки для сверки.
    dataCount: 30,
    containerHeight: 400,
    height: 300,
    maxHeight: 300,
  },
}

export const ColumnSorting: StoryObj<StoryProps> = {
  name: 'Column Sorting',
  args: {
    enableColumnSorting: true,
    // Sized to overflow vertically so the row-ordering requirements (CS12–CS13)
    // have enough rendered rows to prove the sort order against.
    dataCount: 60,
    containerHeight: 400,
    height: 300,
    maxHeight: 300,
  },
}

export const ColumnSortingNotRemovable: StoryObj<StoryProps> = {
  name: 'Column Sorting (not removable)',
  args: {
    enableColumnSorting: true,
    enableSortingRemoval: false,
  },
}

export const ColumnMultiSorting: StoryObj<StoryProps> = {
  name: 'Column Multi Sorting',
  args: {
    enableColumnSorting: true,
    enableMultiSort: true,
    // Shift+клик по нескольким заголовкам добавляет столбцы к сортировке; у
    // каждого отсортированного столбца в шапке виден порядковый бейдж приоритета.
    dataCount: 60,
    containerHeight: 400,
    height: 300,
    maxHeight: 300,
  },
}

export const ColumnSortingOptionLabels: StoryObj<StoryProps> = {
  name: 'Sorting — option labels',
  args: {
    enableColumnSorting: true,
    columnsOverride: optionFilteringColumns,
    dataOverride: optionFilteringData,
    // «Status» сортируется в порядке вариантов, «Tags» — поэлементно, «Manager» — по
    // имени из справочника, а не по id. С группировкой в том же порядке идут группы.
  },
}

export const ColumnDragging: StoryObj<StoryProps> = {
  name: 'Column Dragging',
  args: {
    enableColumnDragging: true,
    // Sized to overflow on both axes so the auto-scroll requirements (D26–D28)
    // have real horizontal scroll distance and a vertical axis to stay off.
    dataCount: 60,
    containerHeight: 400,
    height: 300,
    maxHeight: 300,
  },
}

export const ColumnPinning: StoryObj<StoryProps> = {
  name: 'Column Pinning',
  args: {
    enableColumnPinning: true,
    // Sized to overflow on both axes so the sticky requirements (CP10–CP12)
    // have real horizontal scroll distance to prove the pinned offset against.
    dataCount: 60,
    containerHeight: 400,
    height: 300,
    maxHeight: 300,
  },
}

export const ColumnPinningTwoSides: StoryObj<StoryProps> = {
  name: 'Column Pinning (two-sided)',
  args: {
    // Двустороннее закрепление в UI. Стороны задаёт
    // `columnDef.meta.pinSides` (см. mock `columns.tsx`): `country` — только
    // влево (`start`), `total` — только вправо (`end`; инлайн-тумблер без
    // поповера), остальные — обе стороны (инлайн даёт поповер «Закрепить слева /
    // справа»). Колонка
    // действий (`enableRowActions`) авто-закреплена справа: пользовательский
    // right-pin встаёт левее неё (с подложкой и разделителем). По умолчанию у
    // колонки действий подложки нет; как только есть хотя бы один пользовательский
    // правый пин — она входит в правозакреплённый блок и получает ту же подложку.
    enableColumnPinning: true,
    enableRowActions: true,
    enableRowSelection: true,
    dataCount: 60,
    containerHeight: 400,
    height: 300,
    maxHeight: 300,
  },
}

export const HeaderActionMenu: StoryObj<StoryProps> = {
  name: 'Header Action Menu',
  args: {
    // Три действия в правом слоте (пин + сортировка + группировка) — дескрипторы;
    // достигают порога 3 → весь набор схлопывается в один кебаб (⋮), меню делится
    // на подгруппы. Свич `enableColumnResizing` включает управление шириной: его
    // resize-грип рисуется на кромке, но в порог схлопывания не входит
    // (`countsAsHeaderAction: false`), поэтому кебаб от него не «толстеет».
    enableHeaderActionMenu: true,
    enableColumnPinning: true,
    enableColumnSorting: true,
    enableGrouping: true,
    enableColumnResizing: true,
    dataCount: 60,
    containerHeight: 400,
    height: 300,
    maxHeight: 300,
  },
}

// Индикатор включённого действия (ADR 0062): отсортируйте, отфильтруйте или закрепите
// колонку — на её кнопке появится точка; скройте колонку — на «Колонках» число скрытых.
const activeIndicatorArgs: Partial<StoryProps> = {
  columnsOverride: filteringColumns,
  dataOverride: filteringData,
  enableColumnSorting: true,
  enableColumnFiltering: true,
  enableColumnPinning: true,
  enableColumnVisibility: true,
  containerHeight: 460,
  height: 400,
  maxHeight: 400,
}

export const ActiveActionIndicator: StoryObj<StoryProps> = {
  name: 'Active action indicator',
  args: activeIndicatorArgs,
}

// То же, но кнопки свёрнуты в кебаб: включённое действие видно точкой на кебабе, а
// сам кебаб остаётся на виду без наведения. Shift+клик по сортировке — номер
// приоритета вместо точки.
export const ActiveActionIndicatorInMenu: StoryObj<StoryProps> = {
  name: 'Active action indicator — in menu',
  args: {
    ...activeIndicatorArgs,
    enableHeaderActionMenu: true,
    headerActionMenuOptions: { mode: 'always' },
  },
}

export const HeaderGroups: StoryObj<StoryProps> = {
  name: 'Header Groups',
  args: {
    headerNesting: 'nested',
  },
  parameters: {
    controls: {
      exclude: ['columnCount'],
    },
  },
}

export const HeaderGroupsShallowLeaves: StoryObj<StoryProps> = {
  name: 'Header Groups — shallow leaves',
  args: {
    // Листья разной глубины без групп-прокладок: Country, Visits и служебные
    // колонки растянуты до низа шапки (ADR 0049). Кебаб растянутого листа — тот же,
    // что в плоской шапке. Мок вложенный — колонка раскрытия видна.
    dataNesting: 'nested',
    headerNesting: 'nested',
    enableRowSelection: true,
    enableRowExpanding: true,
    enableRowActions: true,
    enableColumnPinning: true,
    enableColumnVisibility: true,
    enableHeaderActionMenu: true,
    enableKeyboardNavigation: true,
    dataCount: 40,
    containerHeight: 500,
    height: 400,
    maxHeight: 400,
  },
  parameters: {
    controls: {
      exclude: ['columnCount'],
    },
  },
}

export const HeaderGroupsPinning: StoryObj<StoryProps> = {
  name: 'Header Groups Pinning',
  args: {
    // Вложенная шапка + пиннинг: закрепляется только группа верхнего уровня
    // целиком. Узкий вьюпорт по горизонтали, чтобы sticky-закрепление
    // было видно при прокрутке.
    headerNesting: 'nested',
    enableColumnPinning: true,
    dataCount: 40,
    containerHeight: 400,
    height: 300,
    maxHeight: 300,
  },
  parameters: {
    controls: {
      exclude: ['columnCount'],
    },
  },
}

export const HeaderGroupsLeafPinning: StoryObj<StoryProps> = {
  name: 'Header Groups Leaf Pinning',
  args: {
    // Reorder-out: под вложенной шапкой можно пиннить любую единицу —
    // лист или группу любого уровня; при закреплении листья цели вырываются к
    // левому краю, а спанящие шапки родителей режутся на сегменты.
    headerNesting: 'nested',
    enableColumnPinning: true,
    enableLeafPinning: true,
    dataCount: 40,
    containerHeight: 400,
    height: 300,
    maxHeight: 300,
  },
  parameters: {
    controls: {
      exclude: ['columnCount'],
    },
  },
}

/**
 * Перетаскивание под вложенной шапкой (ADR 0052): лист — среди соседей своей группы,
 * группа — среди соседей уровня целиком. Включите `enableColumnPinning`, чтобы
 * увидеть, что закреплённые узлы не двигаются.
 */
export const HeaderGroupsDragging: StoryObj<StoryProps> = {
  name: 'Header Groups — dragging',
  args: {
    headerNesting: 'nested',
    enableColumnDragging: true,
    enableRowDragging: true,
    dataCount: 40,
    containerHeight: 400,
    height: 300,
    maxHeight: 300,
  },
  parameters: {
    controls: {
      exclude: ['columnCount'],
    },
  },
}
