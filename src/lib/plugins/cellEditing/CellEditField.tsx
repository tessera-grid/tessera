/**
 * Владелец контента ячейки (cellSlot). В режиме правки замещает собственный рендер
 * ячейки редактором (подавление `{render}` идёт ядром — RenderCellSlot), иначе
 * показывает контент как есть. Редактор берётся из `hooks.editor` (BYO со своей
 * дизайн-системой) либо дефолтный встроенный. Сессия правки живёт в срезе плагина
 * (ADR 0040, §2): редактор стартует с черновика и пишет его через `setDraft`, поэтому
 * текст переживает прокрутку, смену страницы и сортировку. Сохранение с промисом
 * показывает ожидание, отказ — «ошибку» с меткой (ADR 0041, §2).
 */
import { useId, useState, type ReactNode } from 'react'

import type { PluginCellProps } from '../../core/definePlugin'
import { useLocalization } from '../../core/localization'
import { useSliceProjection } from '../../core/reactivity'
import { useIcons } from '../../ui/icons'
import { CellEditInput } from './CellEditInput'
import styles from './CellEditInput.module.css'
import {
  EDIT_SESSION_KEY,
  cancelEditSession,
  cellEditingViewOf,
  commitEditSession,
  endEditSession,
  isEditingCell,
  isUnchangedCommit,
  readEditSession,
  setEditDraft,
} from './session'
import type { CellEditingHooks, CellEditingState, CellEditor } from './types'

/** Дефолтный редактор: встроенный инлайн-ввод (Enter и потеря фокуса — коммит, Escape — отмена). */
const defaultEditor: CellEditor = ({
  value,
  label,
  error,
  commit,
  cancel,
  setDraft,
}) => (
  <CellEditInput
    initialValue={value}
    label={label}
    error={error}
    onCommit={commit}
    onCancel={cancel}
    onDraftChange={setDraft}
  />
)

export const CellEditField = (
  props: PluginCellProps<CellEditingHooks> & { content: ReactNode },
) => {
  const { row, column, table, content, hooks } = props
  const labels = useLocalization()
  const { saveFailed: FailedIcon } = useIcons()
  const errorId = useId()
  const [error, setError] = useState<string>()
  // Подписка только на состояние этой ячейки: ввод черновика другие ячейки не
  // перерисовывает.
  const view = useSliceProjection(
    table,
    EDIT_SESSION_KEY,
    (state: CellEditingState) => cellEditingViewOf(state, row.id, column.id),
  )

  // Сохранение ждёт сервера — отправленное значение, приглушённо (ADR 0041, §2).
  if (view && view !== 'editing' && view.status === 'pending') {
    return (
      <span className={styles.pending} aria-busy="true">
        {view.draft}
      </span>
    )
  }

  // Сервер отказал — значение из данных с меткой и текстом отказа; черновик ждёт
  // повторной правки.
  if (view && view !== 'editing') {
    return (
      <span
        className={styles.failed}
        aria-invalid="true"
        aria-describedby={errorId}
        title={view.error}
      >
        <span className={styles.failedContent}>{content}</span>
        <span className={styles.failedIcon} aria-hidden="true">
          <FailedIcon width={14} height={14} />
        </span>
        <span id={errorId} className={styles.visuallyHidden}>
          {view.error}
        </span>
      </span>
    )
  }

  // Не в правке — отдаём собственный контент ячейки как есть.
  if (view !== 'editing') {
    return <>{content}</>
  }
  // Правка открыта из «ошибки» — текст отказа, пока `validate` не сказала своё.
  const serverError = readEditSession(table)?.rejected?.error || undefined

  // Режим правки: контент замещается редактором (BYO или дефолтный).
  const editor = hooks.editor ?? defaultEditor
  return (
    <>
      {editor({
        value: readEditSession(table)?.draft ?? '',
        label: labels.editCellValue(
          typeof column.columnDef.header === 'string'
            ? column.columnDef.header
            : column.id,
        ),
        error: error ?? serverError,
        commit: value => {
          // Потеря фокуса после Enter или Escape: сессия уже закрыта.
          const session = readEditSession(table)
          if (!isEditingCell(session, row.id, column.id)) {
            return
          }
          // Значение не изменилось — просто закрыть правку, без onCellEdit (SS18).
          if (isUnchangedCommit(session, value)) {
            setError(undefined)
            endEditSession(table)
            return
          }
          const message = hooks.validate?.(value, props)
          if (message) {
            setError(message)
            return
          }
          setError(undefined)
          commitEditSession(
            table,
            { rowId: row.id, columnId: column.id },
            value,
            hooks,
          )
        },
        cancel: () => {
          setError(undefined)
          cancelEditSession(table, 'cancel', hooks)
        },
        setDraft: value => setEditDraft(table, value),
        cell: props,
      })}
    </>
  )
}
