/** Локальное состояние и хуки плагина cellEditing. */
import type { CellComponentProps } from '../../core/createSlots'

/** Ключ редактируемой ячейки (`rowId:columnId`) или null, если ничего не редактируется. */
export type EditingCell = string | null

/** Данные коммита нового значения ячейки. */
export interface CellEditCommit {
  rowId: string
  columnId: string
  value: string
}

export interface CellEditingHooks {
  /** Условие показа кнопки редактирования по контексту ячейки. */
  canEdit: (ctx: CellComponentProps) => boolean
  /** Коммит нового значения ячейки. */
  onCellEdit: (commit: CellEditCommit) => void
}
