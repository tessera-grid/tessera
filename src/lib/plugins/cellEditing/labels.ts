/** Подписи `cellEditing` (ADR 0182, §8): ключи словаря таблицы `cellEditing.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface CellEditingLabels {
  /** Фильтр дат (ADR 0047): условия, пресеты, поле времени, листание месяцев */
  time: string
  /** Тултип и доступное имя кнопки правки ячейки (`cellEditing`) */
  editCell: string
  /** Доступное имя поля встроенного редактора ячейки (`column` — имя колонки) */
  editCellValue: (column: string) => string
  /** Ошибка поля правки: набранное — не число (ADR 0175, ED4) */
  editInvalidNumber: string
  /** Ошибка поля правки: набранное не разбирается в тип колонки (ADR 0175, ED2) */
  editInvalidValue: string
  /** Причина отклонения правки: значение изменилось во время правки (ADR 0175, ED22) */
  editConflict: string
  /** Пункт поля с поиском, очищающий значение ячейки (ADR 0175, ED8) */
  editClear: string
  /** Поиск по вариантам в редакторе ячейки (ADR 0175, ED19) */
  editSearchOptions: string
  /** Редактор ячейки: вариантов нет */
  editNoOptions: string
  /** Редактор ячейки: варианты справочника загружаются */
  editLoadingOptions: string
  /** Редактор ячейки: варианты справочника не загрузились */
  editOptionsError: string
  /** Редактор ячейки: повторить загрузку вариантов */
  editRetry: string
  /** Вид черновика значения ячейки в пульте (ADR 0178, §5). */
  cellDraftKind: string
  /** Отметка несохранённого значения ячейки: имя и причина «было, стало». */
  cellDraft: string
  cellDraftReason: (was: string, now: string) => string
  /** Откатить несохранённое значение ячейки. */
  cellDraftRollback: string
  /** Строки до сохранения (ADR 0178, §7): виды в пульте и откат в колонке действий. */
  rowInsertDraftKind: string
  rowDeleteDraftKind: string
  /** Сводка новой строки в пульте: первые значения и сколько ещё (DR43). */
  rowInsertDraftMore: (values: string, count: number) => string
  rowInsertDiscard: string
  rowDeleteDiscard: string
  /** Объявление отказа сохранения ячейки (`column` — имя колонки) */
  announceSaveFailed: (name: string, target: string, error: string) => string
  /** Действие: изменить черновик правки */
  actionChangeDraft: string
  /** Действие: значение не прошло проверку */
  actionValidationFailed: string
  /** Действие: переключить булево значение клавишей */
  actionToggle: string
  /** Действие: откат новой или удалённой строки */
  actionRowDraftDiscard: string
}

export const cellEditingLabels = defineLabels<CellEditingLabels>()(
  'cellEditing',
  {
    time: 'Time',
    editCell: 'Edit cell',
    editCellValue: 'Edit {column}',
    editInvalidNumber: 'Enter a number',
    editInvalidValue: 'Invalid value',
    editClear: 'Clear value',
    editConflict: 'The value changed while you were editing — not saved',
    editSearchOptions: 'Search values',
    editNoOptions: 'No values',
    editLoadingOptions: 'Loading…',
    editOptionsError: "Couldn't load values",
    editRetry: 'Retry',
    cellDraftKind: 'Edit',
    cellDraft: 'Unsaved change',
    cellDraftReason: 'Was: {was}. Now: {now}',
    cellDraftRollback: 'Roll back',
    rowInsertDraftKind: 'New row',
    rowDeleteDraftKind: 'Deleted row',
    rowInsertDraftMore: '{values} and {count} more',
    rowInsertDiscard: 'Remove row',
    rowDeleteDiscard: 'Restore row',
    announceSaveFailed: '{name}, {target}: {error}',
    actionChangeDraft: 'Change the draft',
    actionValidationFailed: 'Check the value',
    actionToggle: 'Toggle the value',
    actionRowDraftDiscard: 'Undo the row change',
  },
  {
    editCellValue: ['column'],
    cellDraftReason: ['was', 'now'],
    rowInsertDraftMore: ['values', 'count'],
    announceSaveFailed: ['name', 'target', 'error'],
  },
)

declare module '../../core/localization/pluginLabels' {
  interface PluginLabels {
    cellEditing: typeof cellEditingLabels
  }
}
