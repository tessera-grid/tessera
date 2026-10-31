/** Локальное состояние и хуки плагина cellEditing. */
import type { ReactNode } from 'react'

import type { SessionCancelReason } from '../../core/cancelInteraction'
import type { CellComponentProps } from '../../core/createSlots'
import type { CellEditHook } from '../../shared/cellHooks'

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
  /** Правка открыта из «ошибки»: текст отказа сервера (ADR 0041). */
  rejected?: { error: string }
  /** Текст ошибки `validate` последнего сохранения. */
  invalid?: string
}

/** Активная сессия правки или null. */
export type EditingCell = EditSession | null

/**
 * Отправленная ячейка (ADR 0041, §2): сохранение ждёт промиса `onCellEdit` или
 * отклонено. Отделена от активной правки — править другие ячейки можно сразу.
 */
export interface SubmittedCell {
  rowId: string
  columnId: string
  draft: string
  original: unknown
  status: 'pending' | 'error'
  /** Текст отказа сервера (для `error`). */
  error?: string
  /** Номер отправки: поздний итог прежней отправки игнорируется. */
  attempt: number
}

/** Срез плагина: активная правка и отправленные ячейки по ключу ячейки. */
export interface CellEditingState {
  active: EditingCell
  submitted: Record<string, SubmittedCell>
}

/** Данные коммита нового значения ячейки. */
export interface CellEditCommit {
  rowId: string
  columnId: string
  value: string
  /** Значение ячейки на начало правки. */
  original: unknown
  /** Значение сейчас — есть, только если оно изменилось извне во время правки. */
  current?: unknown
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
  /** Текст отказа сервера — черновик был отклонён (ADR 0041). */
  error?: string
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

/** `canEditCell` — условие показа кнопки редактирования по контексту ячейки. */
export interface CellEditingHooks extends CellEditHook {
  /**
   * Коммит нового значения ячейки. Промис — сохранение с ожиданием: ячейка ждёт
   * его итога, не блокируя правку других (ADR 0041). Сохранённая строка в ответе —
   * сразу или промисом — ложится в кэш серверной модели строк (ADR 0139).
   */
  onCellEdit: (commit: CellEditCommit) => object | void | Promise<unknown>
  /** Правка завершилась без сохранения: Escape, запрет на лету (ADR 0040). */
  onEditCancel?: (end: CellEditCancel) => void
  /**
   * Значение изменилось извне во время правки: `'commit'` (по умолчанию) —
   * сохранить и отдать `original`/`current` в `onCellEdit`; `'block'` — не
   * сохранять, завершить с `conflict`.
   */
  onConflict?: 'commit' | 'block'
  /** Редактор ячейки (BYO); не задан — встроенный `CellEditInput`. */
  editor?: CellEditor
  /** Текст ошибки для значения или `null`/`undefined`, если оно допустимо. */
  validate?: (
    value: string,
    ctx: CellComponentProps,
  ) => string | null | undefined
}
