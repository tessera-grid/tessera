import { Meta, StoryObj } from '@storybook/react'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'

/** Действия строки (ADR 0025): кнопки, без действий, меню строки. */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Rows/Actions',
} satisfies Meta<StoryProps>

export default meta

export const RowActions: StoryObj<StoryProps> = {
  name: 'Basic',
  args: {
    enableRowActions: true,
  },
}

/**
 * Плагин действий без единого действия: колонки действий нет (ADR 0050). Колонку с
 * действиями показывает история «Basic».
 */
export const RowActionsWithoutActions: StoryObj<StoryProps> = {
  name: 'No actions',
  args: {
    enableRowActions: true,
    actionsDemo: 'none',
  },
}

export const RowActionMenu: StoryObj<StoryProps> = {
  name: 'Action menu',
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

/**
 * Асинхронные действия в кебабе строки (ADR 0078): Archive проверяет доступность на
 * «сервере» — по номеру строки уже в архиве (галочка), нет прав (замок), проверка
 * упала (иконка ошибки, нажатие проверяет заново) или доступно; Delete идёт долго,
 * каждая 3-я строка его отклоняет. Выключите `enableRowActionMenu`, чтобы увидеть
 * ожидание и отказ на инлайн-кнопках.
 */
export const RowActionsAsync: StoryObj<StoryProps> = {
  name: 'Async actions',
  args: {
    enableRowActions: true,
    enableRowActionMenu: true,
    actionsDemo: 'async',
    dataCount: 30,
    containerHeight: 400,
    height: 300,
    maxHeight: 300,
  },
}

/**
 * Вложенные разделы в кебабе строки и контекстном меню (ADR 0079) на операциях над
 * записью: Status показывает текущее значение, Assign to грузит сотрудников с
 * «сервера» и ведёт на третий уровень по командам, Labels — метки, которые расставляют
 * по несколько: меню не закрывается после выбора, сохранение видно лоадером в пункте
 * (первая загрузка падает — нажмите строку ошибки); Copy — что скопировать.
 */
export const RowActionsNested: StoryObj<StoryProps> = {
  name: 'Nested sections',
  args: {
    enableRowActions: true,
    enableRowActionMenu: true,
    enableContextMenu: true,
    actionsDemo: 'nested',
    dataCount: 30,
    containerHeight: 400,
    height: 300,
    maxHeight: 300,
  },
}
