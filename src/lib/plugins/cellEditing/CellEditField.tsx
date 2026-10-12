/**
 * Владелец контента ячейки (cellSlot). В режиме правки замещает собственный рендер
 * ячейки редактором (подавление `{render}` идёт ядром — RenderCellSlot), иначе
 * показывает контент как есть. Редактор берётся из `hooks.editor` (BYO со своей
 * дизайн-системой) либо дефолтный встроенный. Сессия правки живёт в срезе плагина
 * (ADR 0040, §2): редактор стартует с черновика и пишет его через `setDraft`, поэтому
 * текст переживает прокрутку, смену страницы и сортировку. Сохранение с промисом
 * показывает ожидание, отказ — «ошибку» с меткой (ADR 0041, §2). Слой поверх ячейки
 * несёт блик ожидания, вспышку отказа и подсветку сохранения (ADR 0057).
 */
import {
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'

import clsx from 'clsx'

import type { PluginCellProps } from '../../core/definePlugin'
import { useLocalization } from '../../core/localization'
import { useSliceProjection, useTableState } from '../../core/reactivity'
import { useErrorFlash } from '../../ui/buttonStates/useErrorFlash'
import ring from '../../ui/ringStates/ringStates.module.css'
import { useIcons } from '../../ui/icons'
import { CellEditInput } from './CellEditInput'
import styles from './CellEditInput.module.css'
import {
  EDIT_SESSION_KEY,
  cancelEditSession,
  cellEditingViewOf,
  cellKey,
  commitEditSession,
  endEditSession,
  isEditingCell,
  isUnchangedCommit,
  readEditSession,
  setEditDraft,
  setEditError,
} from './session'
import type { CellEditingHooks, CellEditingState, CellEditor } from './types'

/**
 * Фаза света ожидания от 0 до 1 по ключу ячейки: соседние ячейки вспыхивают не в такт,
 * а одна и та же ячейка — всегда одинаково.
 */
const pendingPhase = (key: string) => {
  let hash = 2166136261
  for (let i = 0; i < key.length; i++) {
    hash = Math.imul(hash ^ key.charCodeAt(i), 16777619)
  }
  hash = Math.imul(hash ^ (hash >>> 15), 0x2c1b3c6d)
  return ((hash ^ (hash >>> 12)) >>> 0) / 2 ** 32
}

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
  // Подписка только на состояние этой ячейки: ввод черновика другие ячейки не
  // перерисовывает.
  const view = useSliceProjection(
    table,
    EDIT_SESSION_KEY,
    (state: CellEditingState) => cellEditingViewOf(state, row.id, column.id),
  )
  const error = useSliceProjection(
    table,
    EDIT_SESSION_KEY,
    (state: CellEditingState) =>
      isEditingCell(state.active, row.id, column.id)
        ? state.active!.invalid
        : undefined,
  )

  const submitted = view && view !== 'editing' ? view : null
  const pending = submitted?.status === 'pending'
  const saved = useTableState(
    table as never,
    state =>
      cellKey(row.id, column.id) in
      ((state as { cellSaved?: object }).cellSaved ?? {}),
  ) as boolean
  const layerRef = useRef<HTMLSpanElement>(null)
  const flash = useErrorFlash(
    layerRef,
    submitted?.status === 'error' ? submitted.attempt : undefined,
  )
  // Слой появляется с первым ожиданием или сохранением и остаётся до размонтирования:
  // блик переходит во вспышку, а подсветка гаснет на том же элементе.
  const [layer, setLayer] = useState(false)
  if (!layer && (pending || saved)) {
    setLayer(true)
  }
  const feedback = layer ? (
    <span
      ref={layerRef}
      className={clsx(
        'cell-edit-feedback',
        ring.ring,
        ring.layer,
        styles.feedback,
      )}
      aria-hidden="true"
      style={
        {
          '--tsr-pending-phase': pendingPhase(cellKey(row.id, column.id)),
        } as CSSProperties
      }
      data-pending={pending || undefined}
      data-error-flash={flash}
      data-saved={saved || undefined}
    />
  ) : null

  // Сохранение ждёт сервера — отправленное значение и свет по периметру (ADR 0057, §1).
  if (submitted && pending) {
    return (
      <>
        {feedback}
        <span className={styles.pending} aria-busy="true">
          {submitted.draft}
        </span>
      </>
    )
  }

  // Сервер отказал — значение из данных с меткой и текстом отказа; черновик ждёт
  // повторной правки.
  if (submitted) {
    return (
      <>
        {feedback}
        <span
          className={styles.failed}
          aria-invalid="true"
          aria-describedby={errorId}
          title={submitted.error}
        >
          <span className={styles.failedContent}>{content}</span>
          <span className={styles.failedIcon} aria-hidden="true">
            <FailedIcon width={14} height={14} />
          </span>
          <span id={errorId} className={styles.visuallyHidden}>
            {submitted.error}
          </span>
        </span>
      </>
    )
  }

  // Не в правке — отдаём собственный контент ячейки как есть.
  if (view !== 'editing') {
    return (
      <>
        {feedback}
        {content}
      </>
    )
  }
  // Правка открыта из «ошибки» — текст отказа, пока `validate` не сказала своё.
  const serverError = readEditSession(table)?.rejected?.error || undefined

  // Режим правки: контент замещается редактором (BYO или дефолтный).
  const editor = hooks.editor ?? defaultEditor
  return (
    <>
      {feedback}
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
            endEditSession(table)
            return
          }
          const message = hooks.validate?.(value, props)
          if (message) {
            setEditError(table, message)
            return
          }
          commitEditSession(
            table,
            { rowId: row.id, columnId: column.id },
            value,
            hooks,
          )
        },
        cancel: () => {
          cancelEditSession(table, 'cancel', hooks)
        },
        setDraft: value => setEditDraft(table, value),
        cell: props,
      })}
    </>
  )
}
