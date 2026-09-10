import { ActionMenuDeclaration } from '../../core/headerActions'
import { RegistryEntry } from '../types'
import { HeaderActionMenuOptions } from './types'

/**
 * Плагин схлопывания кнопок заголовка в единую кебаб-кнопку с раскрывающимся меню.
 *
 * Не вносит своих действий и не имеет фичи-инстанса — лишь объявляет `actionMenu`
 * для слотов заголовка, по которому зона действий (`ActionsZone`) решает: рисовать
 * кнопки инлайн или схлопнуть схлопываемые действия в кебаб. Работает поверх
 * декларативных действий плагинов (единый дескриптор `SlotAction`); опаковые/
 * немигрированные кнопки в меню не уезжают.
 */
export const headerActionMenu = (
  opts: HeaderActionMenuOptions = {},
): RegistryEntry => {
  const actionMenu: ActionMenuDeclaration = {
    mode: opts.mode ?? 'auto',
    threshold: opts.threshold ?? 3,
    slots: opts.slots ?? ['rightHeaderSlot'],
  }

  return {
    id: 'headerActionMenu',
    enabled: opts.enabled,
    feature: {},
    actionMenu,
  }
}
