/**
 * Владелец контента ячейки (cellSlot). В режиме правки замещает собственный рендер
 * ячейки редактором (подавление `{render}` идёт ядром — RenderCellSlot), иначе
 * показывает контент как есть. Редактор — `editor` колонки, её типа или плагина, иначе
 * встроенный по базовому типу (ADR 0175, ED3). Сессия правки живёт в срезе плагина
 * (ADR 0040, §2): редактор стартует с черновика и пишет его через `setText`, поэтому
 * текст переживает прокрутку, смену страницы и сортировку. Пока сохранение с промисом
 * ждёт, ячейка показывает отправленное значение, после отказа — значение из данных;
 * ожидание и отказ показывает кнопка правки (ADR 0127, §6), итог на ячейке — вспышка
 * (ADR 0134).
 */
import type { ReactNode } from 'react'

import type { PluginCellProps } from '../../core/definePlugin'
import { useLocalization } from '../../core/localization'
import { useSliceProjection } from '../../core/reactivity'
import { alignOf } from '../../core/dataTypeFormat'
import { SelectCheckbox } from '../../ui/SelectCheckbox/SelectCheckbox'
import { defaultCell } from '../../core/commonFeature'
import { useDraft } from '../../core/drafts/drafts'
import { sourceOf } from '../../core/debugActions'
import { beginEdit, editorOf, togglesInPlace } from './editors'
import styles from './CellEditInput.module.css'
import {
  CELL_VALUE_DRAFT,
  type CellDraftValue,
  EDIT_SESSION_KEY,
  cancelEditSession,
  cellEditingViewOf,
  isEditingCell,
  readEditSession,
  saveEdit,
  setEditDraft,
  setEditText,
} from './session'
import type { CellEditingHooks, CellEditingState } from './types'
import { cellEditingLabels } from './labels'

const noop = () => {}

/** Булево правится встроенным флажком: своя ячейка колонки не задана, правка разрешена. */
export const booleanToggle = (
  props: PluginCellProps<CellEditingHooks>,
): boolean =>
  props.column.columnDef.cell === defaultCell &&
  props.column.getDataType()?.base === 'boolean' &&
  togglesInPlace(props.table, props.column, props.hooks) &&
  props.hooks.canEditCell(props)

export const CellEditField = (
  props: PluginCellProps<CellEditingHooks> & { content: ReactNode },
) => {
  const { row, column, table, content, hooks } = props
  const labels = useLocalization()
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

  // Несохранённое значение ячейки (ADR 0178, §5): модели считают по данным, ячейка — по нему.
  const draft = useDraft(table, CELL_VALUE_DRAFT, {
    cell: [row.id, column.id],
  })?.value as CellDraftValue | undefined

  const header =
    typeof column.columnDef.header === 'string'
      ? column.columnDef.header
      : column.id
  const submitted = view && view !== 'editing' ? view : null
  const pending = submitted?.status === 'pending'
  // Сохранение ждёт сервера — отправленное значение; ожидание показывает кнопка правки.
  // Редактируемое булево — флажок кита во всю ячейку: нажатие сохраняет сразу, ожидание —
  // дугой на флажке, отказ — вспышкой отката (ED21, ADR 0176).
  if (view !== 'editing' && booleanToggle(props)) {
    const value =
      pending && typeof submitted!.draft === 'boolean'
        ? submitted!.draft
        : draft && typeof draft.value === 'boolean'
          ? draft.value
          : row.getValue(column.id) === true
    return (
      <span
        className={styles.booleanCell}
        data-align={alignOf(table as never, column as never)}
        onClick={event => {
          if (!pending) beginEdit(table, row, column, hooks, sourceOf(event))
        }}
      >
        <SelectCheckbox
          selected={value}
          label={header}
          tabIndex={-1}
          pending={pending}
          onClick={noop}
        />
      </span>
    )
  }

  if (submitted && pending) {
    return <span className={styles.pending}>{submitted.text}</span>
  }

  // Несохранённое значение — его текст; отметка — полый уголок ячейки.
  if (view !== 'editing' && draft) {
    return <span className={styles.draft}>{draft.text}</span>
  }

  // Не в правке или сервер отказал — собственный контент ячейки, то есть значение из
  // данных; черновик отказа ждёт повторной правки, отметка — на кнопке правки.
  if (view !== 'editing') {
    return content
  }
  const session = readEditSession(table)
  // Правка открыта из «ошибки» — текст отказа, пока `validate` не сказала своё.
  const serverError = session?.rejected?.error || undefined
  const cell = { rowId: row.id, columnId: column.id }

  // Режим правки: контент замещается редактором колонки, типа, плагина или встроенным.
  return editorOf(
    table,
    column,
    hooks,
  )({
    value: session?.draft,
    text: session?.text ?? '',
    label: cellEditingLabels(labels).editCellValue(header),
    error: error ?? serverError,
    commit: value => saveEdit(table, cell, { value }, hooks, props),
    commitText: text => saveEdit(table, cell, { text }, hooks, props),
    // Уход фокуса из редактора после открытия правки другой ячейки её не отменяет.
    cancel: () => {
      if (isEditingCell(readEditSession(table), row.id, column.id))
        cancelEditSession(table, 'cancel', hooks)
    },
    setDraft: value => setEditDraft(table, value),
    setText: text => setEditText(table, text),
    cell: props,
  })
}
