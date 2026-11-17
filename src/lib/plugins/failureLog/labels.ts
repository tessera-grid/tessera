/** Подписи `failureLog` (ADR 0182, §8): ключи словаря таблицы `failureLog.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface FailureLogLabels {
  /** Журнал ошибок: заголовок поповера (ADR 0177, §7). */
  failureLog: string
  /** Пустой журнал ошибок. */
  failureLogEmpty: string
  /** Пояснение пустого журнала ошибок. */
  failureLogEmptyDescription: string
  /** Кнопка журнала ошибок с числом записей. */
  failureLogButton: (count: number) => string
  /** Закрыть все записи журнала, когда ни за одной нет правки (ADR 0227, §6). */
  failureClearAll: string
  /** Сбросить правки всех записей и закрыть прочие (ADR 0227, §6). */
  failureDiscardAll: string
  /** Вопрос перед сбрасыванием всех правок: их число. */
  failureDiscardAllQuestion: (count: number) => string
  /** Кнопки вопроса: сбросить и оставить правки. */
  failureDiscardAllConfirm: string
  failureDiscardAllDecline: string
  /** Группа журнала: сбросить её правки (ADR 0227, §4). */
  failureDiscardGroup: string
  /** Группа журнала: закрыть её записи без правок. */
  failureCloseGroup: string
  /** Число целей группы: ячейки, строки, прочие объекты. */
  failureGroupCells: (count: number) => string
  failureGroupRows: (count: number) => string
  failureGroupItems: (count: number) => string
  /** Запись журнала: прокрутить к цели. */
  failureShow: string
  /** Запись журнала: снять запись. */
  failureClose: string
  /** Прокрутка к цели записи не удалась (ADR 0227, §7). */
  targetNotFound: string
  /** Объявление новой записи журнала: число записей. */
  announceFailureLogged: (count: number) => string
  /** Подсказка точки записи (ADR 0224). */
  markHint: string
}

export const failureLogLabels = defineLabels<FailureLogLabels>()(
  'failureLog',
  {
    failureLog: 'Error log',
    failureLogEmpty: 'No errors',
    failureLogEmptyDescription:
      'Actions refused by the server will appear here',
    failureLogButton: 'Errors: {count}',
    failureClearAll: 'Close all',
    failureDiscardAll: 'Revert all changes',
    failureDiscardAllQuestion: 'Revert {count} changes?',
    failureDiscardAllQuestion_one: 'Revert {count} change?',
    failureDiscardAllConfirm: 'Revert',
    failureDiscardAllDecline: 'Keep changes',
    failureDiscardGroup: 'Revert changes',
    failureCloseGroup: 'Close all in the group',
    failureGroupCells: '{count} cells',
    failureGroupCells_one: '{count} cell',
    failureGroupRows: '{count} rows',
    failureGroupRows_one: '{count} row',
    failureGroupItems: '{count} errors',
    failureGroupItems_one: '{count} error',
    failureShow: 'Show',
    failureClose: 'Close',
    targetNotFound: "Couldn't find the row",
    announceFailureLogged: 'Errors in the log: {count}',
    markHint: 'Not done',
  },
  {
    failureLogButton: ['count'],
    failureDiscardAllQuestion: ['count'],
    failureGroupCells: ['count'],
    failureGroupRows: ['count'],
    failureGroupItems: ['count'],
    announceFailureLogged: ['count'],
  },
)

declare module '../../core/localization/pluginLabels' {
  interface PluginLabels {
    failureLog: typeof failureLogLabels
  }
}
