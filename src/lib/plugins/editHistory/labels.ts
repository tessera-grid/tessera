/** Подписи `editHistory` (ADR 0182, §8): ключи словаря таблицы `editHistory.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface EditHistoryLabels {
  /** Отменить последнюю правку (ADR 0222, §11). */
  undo: string
  /** Повторить отменённую правку. */
  redo: string
  /** Кнопка и пункт «Отменить» с подписью записи. */
  undoEntry: (name: string) => string
  /** Кнопка и пункт «Повторить» с подписью записи. */
  redoEntry: (name: string) => string
  /** Перейти к записи истории — действие справочника. */
  rewind: string
  /** История правок: кнопка и заголовок попапа. */
  history: string
  /** Пустая история. */
  historyEmpty: string
  /** Пояснение пустой истории. */
  historyEmptyDescription: string
  /** Запись истории: показать её ячейки. */
  historyShow: string
  /** Отметка «вы здесь» между выполненными и откаченными записями. */
  historyHere: string
  /** Откаченная запись — для скринридера. */
  historyUndone: string
  /** Запись операции над несколькими ячейками (`name` — действие, `count` — ячеек). */
  entryCells: (name: string, count: number) => string
  /** Запись правки одной ячейки (`name` — действие, `target` — ячейка). */
  entryCell: (name: string, target: string) => string
  /** Объявление отмены (`name` — запись). */
  announceUndone: (name: string) => string
  /** Объявление повтора. */
  announceRedone: (name: string) => string
  /** Ячейки изменились с тех пор и пропущены (ADR 0222, §6). */
  announceConflicts: (count: number) => string
  /** Ячеек больше нет в данных — пропущены (§7). */
  announceMissing: (count: number) => string
  /** Ячейки сейчас нельзя изменить — запись осталась (§3). */
  announceNotWritable: (count: number) => string
  /** Строку после переноса уже переставили — отмена её не тронула (§13). */
  announceMoveSkipped: string
  /** Ячейка записи скрыта фильтром или на другой странице (§9). */
  announceHidden: string
  /** Отменять нечего. */
  announceNothing: string
  /** Повторять нечего. */
  announceNothingToRedo: string
}

export const editHistoryLabels = defineLabels<EditHistoryLabels>()(
  'editHistory',
  {
    undo: 'Undo',
    redo: 'Redo',
    undoEntry: 'Undo: {name}',
    redoEntry: 'Redo: {name}',
    rewind: 'Go to change',
    history: 'Change history',
    historyEmpty: 'No changes yet',
    historyEmptyDescription: 'Edits you make in the table will appear here',
    historyShow: 'Show',
    historyHere: 'Current state',
    historyUndone: 'Undone',
    entryCells: '{name}, {count} cells',
    entryCells_one: '{name}, {count} cell',
    entryCell: '{name}: {target}',
    announceUndone: 'Undone: {name}',
    announceRedone: 'Redone: {name}',
    announceConflicts: '{count} cells changed since — skipped',
    announceConflicts_one: '{count} cell changed since — skipped',
    announceMissing: '{count} cells are no longer in the data — skipped',
    announceMissing_one: '{count} cell is no longer in the data — skipped',
    announceNotWritable: '{count} cells cannot be changed now',
    announceNotWritable_one: '{count} cell cannot be changed now',
    announceMoveSkipped: 'The row was moved again — not undone',
    announceHidden:
      'The changed cells are hidden by the filter or on another page',
    announceNothing: 'Nothing to undo',
    announceNothingToRedo: 'Nothing to redo',
  },
  {
    undoEntry: ['name'],
    redoEntry: ['name'],
    entryCells: ['name', 'count'],
    entryCell: ['name', 'target'],
    announceUndone: ['name'],
    announceRedone: ['name'],
    announceConflicts: ['count'],
    announceMissing: ['count'],
    announceNotWritable: ['count'],
  },
)

declare module '../../core/localization/pluginLabels' {
  interface PluginLabels {
    editHistory: typeof editHistoryLabels
  }
}
