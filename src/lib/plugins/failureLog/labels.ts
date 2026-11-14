/** Подписи `failureLog` (ADR 0182, §8): ключи словаря таблицы `failureLog.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface FailureLogLabels {
  /** Журнал отказов: заголовок поповера (ADR 0177, §7). */
  failureLog: string
  /** Пустой журнал отказов. */
  failureLogEmpty: string
  /** Пояснение пустого журнала отказов. */
  failureLogEmptyDescription: string
  /** Кнопка журнала отказов с числом записей. */
  failureLogButton: (count: number) => string
  /** Закрыть все записи журнала. */
  failureClearAll: string
  /** Запись журнала: прокрутить к цели. */
  failureShow: string
  /** Запись журнала: снять запись. */
  failureClose: string
  /** Объявление новой записи журнала: число записей. */
  announceFailureLogged: (count: number) => string
  /** Подсказка точки записи (ADR 0224). */
  markHint: string
}

export const failureLogLabels = defineLabels<FailureLogLabels>()(
  'failureLog',
  {
    failureLog: 'Failure log',
    failureLogEmpty: 'No failures',
    failureLogEmptyDescription:
      'Actions refused by the server will appear here',
    failureLogButton: 'Failures: {count}',
    failureClearAll: 'Clear all',
    failureShow: 'Show',
    failureClose: 'Close',
    announceFailureLogged: 'Failures in the log: {count}',
    markHint: 'Not done',
  },
  {
    failureLogButton: ['count'],
    announceFailureLogged: ['count'],
  },
)

declare module '../../core/localization/pluginLabels' {
  interface PluginLabels {
    failureLog: typeof failureLogLabels
  }
}
