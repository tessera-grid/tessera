/** Локальное состояние и хуки плагина cellEditing. */
import type { ReactNode } from 'react'

import type { SessionCancelReason } from '../../core/cancelInteraction'
import type { CellComponentProps } from '../../core/createSlots'
import type { CellWriteSource } from '../../core/cellWrites'
import type { CellEditHook } from '../../shared/cellHooks'

/**
 * Сессия правки (ADR 0040, §2): ячейка, черновик и значение на начало. Живёт в
 * срезе плагина и переживает размонтирование редактора.
 */
export interface EditSession {
  cell: { rowId: string; columnId: string }
  /**
   * Черновик в типе колонки (ADR 0175, §1); `undefined` — набранный текст в тип не
   * разбирается.
   */
  draft: unknown
  /** Черновик текстом: набранное в поле, на старте — значение по языку таблицы. */
  text: string
  /** Значение ячейки на начало правки. */
  original: unknown
  /** Правка открыта из «ошибки»: текст отказа сервера (ADR 0041). */
  rejected?: { error: string }
  /** Текст ошибки последнего сохранения: `validate` или разбор по типу. */
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
  /** Отправленное значение в типе колонки. */
  draft: unknown
  /** Отправленное значение текстом. */
  text: string
  original: unknown
  status: 'pending' | 'error'
  /** Текст отказа сервера (для `error`). */
  error?: string
  /** Номер отправки: поздний итог прежней отправки игнорируется. */
  attempt: number
  /** Применение или операция записи, в которой отказ пришёл (ADR 0227, §3). */
  batch?: string
}

/**
 * Итог последнего применения черновиков (ADR 0227, §1): по нему плашка. Новое применение
 * заменяет запись.
 */
export interface ApplyOutcome {
  /** Id применения — тот же `batch` у его отказов. */
  id: string
  /** Сохранено правок ячеек и строк. */
  saved: number
  /** Не сохранено. */
  refused: number
  /** Запрос не прошёл целиком: причина; `refused` — все правки применения. */
  failed?: { reason: string }
  /**
   * Применить несохранённое ещё раз одним вызовом `onCommitEdits`: при отказе целиком — тот же
   * набор, иначе отказанные. Нечего повторять — поля нет.
   */
  retry?: () => void
}

/**
 * Пакет операции записи, ждущий ответа (ADR 0219, §10): одна запись на пакет со словарём ячеек
 * по ключу ячейки — смена ожидания не переписывает срез по записи на ячейку.
 */
export interface PendingPackage {
  id: string
  cells: ReadonlyMap<string, SubmittedCell>
}

/** Срез плагина: активная правка, отправленные ячейки по ключу ячейки и ждущие пакеты. */
export interface CellEditingState {
  active: EditingCell
  submitted: Record<string, SubmittedCell>
  packages?: Readonly<Record<string, PendingPackage>>
  /** Итог последнего применения черновиков, пока плашку не закрыли (ADR 0227, §1). */
  applied?: ApplyOutcome
}

/** Данные коммита нового значения ячейки. */
export interface CellEditCommit {
  rowId: string
  columnId: string
  /** Новое значение в типе колонки: число, `Date`, запись, массив (ADR 0175, ED1). */
  value: unknown
  /** Набранный текст; у редактора без поля — текст значения по языку таблицы. */
  text: string
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
  /** Черновик в типе колонки — не теряется молча; `undefined` — текст не разбирается. */
  draft: unknown
  /** Черновик текстом. */
  text: string
  /** Значение ячейки на начало правки. */
  original: unknown
  /** Значение сейчас — для `conflict`. */
  current?: unknown
  /** Текст отказа сервера — черновик был отклонён (ADR 0041). */
  error?: string
}

/** Что получает редактор ячейки (ADR 0175, §3). */
export interface CellEditorProps {
  /** Черновик в типе колонки: на старте — значение ячейки; переживает прокрутку. */
  value: unknown
  /** Черновик текстом: на старте — значение по языку таблицы. */
  text: string
  /** Доступное имя поля (`localization.editCellValue` с именем колонки). */
  label: string
  /** Текст ошибки `validate` или разбора; поле — `aria-invalid` и связанный текст ошибки. */
  error?: string
  /** Сохранить значение в типе колонки. */
  commit: (value: unknown) => void
  /** Сохранить набранный текст: его разбирает тип колонки, не разобрался — ошибка поля. */
  commitText: (text: string) => void
  cancel: () => void
  /** Сообщить черновик в типе колонки: он живёт в срезе и уходит в `onEditCancel`. */
  setDraft: (value: unknown) => void
  /** Сообщить набранный текст. */
  setText: (text: string) => void
  cell: CellComponentProps
}

/**
 * Рендер редактора ячейки (BYO — со своей дизайн-системой). Не задан у колонки, типа и
 * плагина — встроенный по базовому типу колонки.
 */
export type CellEditor = (props: CellEditorProps) => ReactNode

/** Правка одной ячейки в пакете сохранения (ADR 0178, §5). */
export interface CellEditBatchItem {
  rowId: string
  columnId: string
  /** Значение в типе колонки. */
  value: unknown
  /** Набранный текст. */
  text: string
  /** Значение в данных сейчас. */
  original: unknown
}

/** Новая строка в пакете (ADR 0178, §7): временный id, значения и место. */
export interface RowInsertBatchItem {
  /** Временный id: по нему ответ возвращает сохранённую строку и отказы. */
  rowId: string
  values: Record<string, unknown>
  /** Место в видимом списке. */
  index: number
  /** Строка над новой; нет — новая первая. */
  after?: string
}

/** Пакет сохранения: правки ячеек, новые и удалённые строки. */
export interface CellEditBatch {
  /** Id операции записи в ячейки — вставки, очистки, массовой правки (ADR 0219, §6). */
  id?: string
  /** Откуда операция; нет — «Применить» черновиков (ADR 0178). */
  source?: CellWriteSource
  cells: readonly CellEditBatchItem[]
  inserts?: readonly RowInsertBatchItem[]
  deletes?: readonly { rowId: string }[]
}

/**
 * Ответ на пакет: отказы с причиной — по ячейке или, без `columnId`, по строке; остальное
 * сохранено. `saved` — сохранённые новые строки по временному id.
 */
export interface CellEditBatchResult {
  refused?: readonly { rowId: string; columnId?: string; reason: string }[]
  saved?: readonly { rowId: string; row: unknown }[]
}

/** `canEditCell` — условие показа кнопки редактирования по контексту ячейки. */
export interface CellEditingHooks extends CellEditHook {
  /**
   * Коммит нового значения ячейки. Промис — сохранение с ожиданием: ячейка ждёт
   * его итога, не блокируя правку других (ADR 0041). Сохранённая строка в ответе —
   * сразу или промисом — ложится в кэш серверной модели строк (ADR 0139). `signal`
   * прерывается, когда человек отменил ждущее сохранение (ADR 0177, §8).
   */
  onCellEdit: (
    commit: CellEditCommit,
    context: { signal: AbortSignal },
  ) => object | void | Promise<unknown>
  /** Правка завершилась без сохранения: Escape, запрет на лету (ADR 0040). */
  onEditCancel?: (end: CellEditCancel) => void
  /**
   * Сохранение (ADR 0178, §5): `'auto'` (по умолчанию) — законченная правка уходит в
   * `onCellEdit`; `'manual'` — становится черновиком ячейки, сохраняет пакет `onCommitEdits`.
   */
  saveMode?: 'auto' | 'manual'
  /**
   * Сохранить пакет черновиков одним вызовом. Промис — ожидание на ячейках пакета; ответ может
   * отказать части ячеек (`refused`) — у них отказ на объекте, черновик остаётся.
   */
  onCommitEdits?: (
    batch: CellEditBatch,
    context: { signal: AbortSignal },
  ) => CellEditBatchResult | void | PromiseLike<CellEditBatchResult | void>
  /**
   * Значение изменилось извне во время правки: `'commit'` (по умолчанию) —
   * сохранить и отдать `original`/`current` в `onCellEdit`; `'block'` — не
   * сохранять, завершить с `conflict`.
   */
  onConflict?: 'commit' | 'block'
  /** Пауза ввода перед запросом справочника в редакторе вариантов, мс (ADR 0175, ED18). */
  searchDebounceMs?: number
  /** Редактор ячеек по умолчанию; главнее — `editor` колонки и её типа (ADR 0175, ED3). */
  editor?: CellEditor
  /**
   * Текст ошибки для значения или `null`/`undefined`, если оно допустимо. Значение — в
   * типе колонки, `text` — набранный текст.
   */
  validate?: (
    value: unknown,
    ctx: CellComponentProps,
    text: string,
  ) => string | null | undefined
}

/* eslint-disable @typescript-eslint/no-unused-vars -- параметр типа обязан повторять
   объявление, иначе declaration merging не склеится */
declare module '../../core/dataTypes' {
  interface DataTypeFields<TData> {
    /** Редактор ячеек колонки или типа; главнее аргумента `editor` плагина (ADR 0175, ED3). */
    editor?: CellEditor
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */
