/** Локальное состояние и хуки плагина cellEditing. */
import type { ReactNode } from 'react'

import type { CellComponentProps } from '../../core/createSlots'

/** Ключ редактируемой ячейки (`rowId:columnId`) или null, если ничего не редактируется. */
export type EditingCell = string | null

/** Данные коммита нового значения ячейки. */
export interface CellEditCommit {
  rowId: string
  columnId: string
  value: string
}

/**
 * Рендер редактора ячейки (BYO — со своей дизайн-системой). Получает текущее
 * значение и коллбэки `commit`/`cancel` (инкапсулируют запись в локальный слайс и
 * `onCellEdit`), плюс контекст ячейки. По умолчанию — встроенный `CellEditInput`.
 */
export type CellEditor = (props: {
  value: string
  commit: (value: string) => void
  cancel: () => void
  cell: CellComponentProps
}) => ReactNode

export interface CellEditingHooks {
  /** Условие показа кнопки редактирования по контексту ячейки. */
  canEdit: (ctx: CellComponentProps) => boolean
  /** Коммит нового значения ячейки. */
  onCellEdit: (commit: CellEditCommit) => void
  /** Редактор ячейки (BYO); не задан — встроенный `CellEditInput`. */
  editor?: CellEditor
}
