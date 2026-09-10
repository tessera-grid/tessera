import { SlotAction, SlotActions } from './types'

/** Пустой набор действий по всем слотам — база для реактивной свёртки плагинов. */
export const createEmptySlotActions = (): SlotActions => ({
  leftHeaderSlot: [],
  rightHeaderSlot: [],
  leftCellSlot: [],
  rightCellSlot: [],
  actionRowSlot: [],
})

/**
 * Регистрирует действие в переданный `SlotActions` (чистая операция). Ядро
 * использует её, чтобы собрать действия реактивно из деклараций активных плагинов
 * (ADR 0010). Дедуплицирует по `id` в пределах слота: повторная регистрация
 * обновляет запись на месте, иначе вставляет по `order` (число — индекс splice)
 * или пушит в конец.
 */
export const registerSlotActionInto = (
  actions: SlotActions,
  action: SlotAction,
) => {
  const current = actions[action.slot]

  const existingIndex = current.findIndex(entry => entry.id === action.id)

  if (existingIndex !== -1) {
    current[existingIndex] = action

    return
  }

  if (action.order === undefined || action.order === 'last') {
    current.push(action)
  } else {
    current.splice(action.order, 0, action)
  }
}
