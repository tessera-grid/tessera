/**
 * Плагин журнала отказов (ADR 0177, §7): кнопка тулбара с красным счётчиком, пока в реестре
 * отказов ядра есть записи; поповер — список записей с переходом к цели, повтором и закрытием.
 * Тулбар кнопка не вызывает: она встаёт в тулбар, который у таблицы уже есть.
 */
import { announceLabel } from '../../core/announcer'
import {
  placeToolbarSlot,
  type ToolbarPlacementOption,
} from '../../shared/toolbarPlacement'
import { definePlugin } from '../../core/definePlugin'
import { neverInert } from '../../core/pluginDiagnostics'
import { FailureLogButton } from './FailureLogButton'
import { failureLogLabels } from './labels'

/** Группа тулбара: последней справа, после групп потребителя (ранг — `core/toolbar`). */
export const FAILURE_LOG_TOOLBAR_GROUP = 'failures'

export interface FailureLogOptions extends ToolbarPlacementOption {
  /** `false` — плагин отключён. */
  enabled?: boolean
}

type FailuresAtom = {
  get: () => Record<string, unknown> | undefined
  subscribe: (listener: (next: Record<string, unknown>) => void) => {
    unsubscribe: () => void
  }
}

/**
 * Новая запись — объявление числа записей (JR4). Отдельной задачей: источник отказа
 * объявляет причину в том же кадре, и live-область оставила бы только одно из двух.
 */
const announceNewRecords = (table: unknown) => {
  const atom = (table as { atoms: { failures?: FailuresAtom } }).atoms.failures
  if (!atom) return undefined
  let known = new Set(Object.keys(atom.get() ?? {}))
  let timer: ReturnType<typeof setTimeout> | undefined
  const subscription = atom.subscribe(next => {
    const keys = Object.keys(next ?? {})
    const added = keys.some(key => !known.has(key))
    known = new Set(keys)
    if (!added) return
    clearTimeout(timer)
    timer = setTimeout(() =>
      announceLabel(table, labels =>
        failureLogLabels(labels).announceFailureLogged(known.size),
      ),
    )
  })
  return () => {
    clearTimeout(timer)
    subscription.unsubscribe()
  }
}

export const failureLog = definePlugin<FailureLogOptions>()({
  id: 'failureLog',
  labels: [failureLogLabels],
  actions: {
    clearAll: labels => failureLogLabels(labels).failureClearAll,
    close: labels => failureLogLabels(labels).failureClose,
    show: labels => failureLogLabels(labels).failureShow,
    retry: labels => labels.failureRetry,
  },
  diagnose: neverInert,
  setup: () => table => announceNewRecords(table),
  slots: o =>
    placeToolbarSlot(
      {
        id: 'failureLogButton',
        slot: 'toolbarSlot',
        group: FAILURE_LOG_TOOLBAR_GROUP,
        order: 0,
        showsPanel: false,
        component: FailureLogButton,
      },
      o.toolbar,
    ),
})
