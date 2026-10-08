import { Meta, StoryObj } from '@storybook/react'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'

/** Видимость колонок (ADR 0035): меню «Колонки», вместе с меню заголовка. */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Columns/Visibility',
} satisfies Meta<StoryProps>

export default meta

export const ColumnVisibility: StoryObj<StoryProps> = {
  name: 'Basic',
  args: {
    // Кнопка «Колонки» в тулбаре: поиск, дерево, «Показать все» / «Сбросить».
    // headerNesting: nested — меню покажет группы вложенной шапки.
    enableColumnVisibility: true,
    enableRowSelection: true,
  },
}

export const ColumnVisibilityWithHeaderMenu: StoryObj<StoryProps> = {
  name: 'With header menu',
  args: {
    // Всё вместе: кнопка «Колонки» в тулбаре и «Скрыть колонку» в кебабе заголовка.
    // Пин — обычное действие, остаётся кнопкой; «Скрыть колонку» (`placement:
    // 'menu'`) — только в кебабе. Кебаб считается в пороге (3) одной кнопкой:
    // включите enableColumnSorting — пин + сортировка + кебаб = 3, всё уйдёт в кебаб.
    // headerNesting: nested — у групп в кебабе появится «Скрыть группу».
    enableColumnVisibility: true,
    enableHeaderActionMenu: true,
    enableColumnPinning: true,
    enableRowSelection: true,
  },
}
