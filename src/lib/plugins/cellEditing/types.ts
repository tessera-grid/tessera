/** Локальное состояние и хуки плагина cellEditing. */
import type { ReactNode } from 'react'

import type { SessionCancelReason } from '../../core/cancelInteraction'
import type { CellComponentProps } from '../../core/createSlots'

/**
 * Сессия правки (ADR 0040, §2): ячейка, черновик и значение на начало. Живёт в
 * срезе плагина и переживает размонтирование редактора.
 */
export interface EditSession {
  cell: { rowId: string; columnId: string }
  /** Введённый текст. */
  draft: string
  /** Значение ячейки на начало правки. */
  original: unknown
}

/** Срез плагина: открытая сессия правки или null. */
export type EditingCell = EditSession | null

/** Данные коммита нового значения ячейки. */
export interface CellEditCommit {
  rowId: string
  columnId: string
  value: string
}

/** Причина завершения правки без сохранения (ADR 0040, §1). */
export type EditCancelReason = SessionCancelReason | 'conflict'

/** Данные правки, завершённой без сохранения. */
export interface CellEditCancel {
  rowId: string
  columnId: string
  reason: EditCancelReason
  /** Введённый текст — не теряется молча. */
  draft: string
  /** Значение ячейки на начало правки. */
  original: unknown
  /** Значение сейчас — для `conflict`. */
  current?: unknown
}

/**
 * Рендер редактора ячейки (BYO — со своей дизайн-системой). Получает черновик
 * сессии (на старте — значение ячейки) и коллбэки `commit`/`cancel` (инкапсулируют запись в локальный слайс и
 * `onCellEdit`), плюс контекст ячейки. По умолчанию — встроенный `CellEditInput`.
 */
export type CellEditor = (props: {
  /** Черновик сессии: переживает прокрутку и смену страницы. */
  value: string
  /** Доступное имя поля (`localization.editCellValue` с именем колонки). */
  label: string
  /** Текст ошибки `validate`; поле — `aria-invalid` и связанный текст ошибки. */
  error?: string
  commit: (value: string) => void
  cancel: () => void
  /** Сообщить введённый текст: черновик живёт в срезе и уходит в `onEditCancel`. */
  setDraft: (value: string) => void
  cell: CellComponentProps
}) => ReactNode

export interface CellEditingHooks {
  /** Условие показа кнопки редактирования по контексту ячейки. */
  canEdit: (ctx: CellComponentProps) => boolean
  /** Коммит нового значения ячейки. */
  onCellEdit: (commit: CellEditCommit) => void
  /** Правка завершилась без сохранения: Escape, запрет на лету (ADR 0040). */
  onEditCancel?: (end: CellEditCancel) => void
  /** Редактор ячейки (BYO); не задан — встроенный `CellEditInput`. */
  editor?: CellEditor
  /** Текст ошибки для значения или `null`/`undefined`, если оно допустимо. */
  validate?: (
    value: string,
    ctx: CellComponentProps,
  ) => string | null | undefined
}
