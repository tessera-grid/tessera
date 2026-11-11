// usePanelOpening: открытие поповера действия с панелью после `SlotAction.preload`
// (ADR 0024, AM28–AM30) — общий договор ленивого открытия (ADR 0061) для действия.
import { actionDetailOf, actionOwnerOf } from '../../core/actionOwners'
import { reportAction, sourceOf } from '../../core/debugActions'
import {
  type LazyTriggerState,
  lazyTriggerHandlers,
  useLazyOpening,
} from '../../core/lazyOpening'
import type { Preloadable } from '../../util/preloadable'
import type { SlotAction } from '../../core/headerActions'
import { actionRefOf, menuActionLabel } from '../../core/actions'
import { useLocalization } from '../../core/localization'

interface Context {
  table: unknown
}

export const usePanelOpening = (context: Context) => {
  const opening = useLazyOpening(context.table)
  const labels = useLocalization()

  /**
   * Открыть панель `action`, когда загрузятся её содержимое и, если ещё не пришёл,
   * модуль поповера `module`; `onFail` — при ошибке.
   */
  const request = (
    action: SlotAction,
    open: () => void,
    onFail?: () => void,
    module?: Preloadable,
  ) => {
    // Панель слот-действия — действие его владельца (ADR 0125, AL4).
    reportAction(context.table, {
      plugin: actionOwnerOf(action),
      action: 'openPanel',
      detail: () => ({ ...actionDetailOf(context), action: action.id }),
      source: sourceOf(globalThis.event),
    })
    const loadModule = module && !module.isLoaded()
    opening.request(
      action.preload || loadModule
        ? {
            load: () =>
              Promise.all([
                loadModule ? module.reload() : undefined,
                action.preload?.(context),
              ]),
            label: labels => menuActionLabel(action, context, labels),
            action: actionRefOf(action, context, labels),
          }
        : undefined,
      open,
      onFail,
    )
  }

  return { ...opening, request }
}

/** Состояние открытия панели для её кнопки. */
export interface PanelButtonState {
  pending: boolean
  /** Загрузка содержимого отказала: дуга останавливается. */
  failed?: boolean
  /** Наведение или фокус: пора грузить содержимое. */
  onIntent: () => void
  /** Escape или уход фокуса: отменить ожидание. */
  onCancel: () => void
  /** Фокус на заглушке до загрузки модуля (ADR 0061, LZ25). */
  onFocus?: LazyTriggerState['onFocus']
}

/** Пропсы `IconButton` кнопки, открывающей панель. */
export const panelButtonProps = (state: PanelButtonState | undefined) =>
  state && {
    pending: state.pending,
    failed: state.failed,
    ...lazyTriggerHandlers(state),
  }
