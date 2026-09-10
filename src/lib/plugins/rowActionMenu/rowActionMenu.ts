import { ActionMenuDeclaration } from '../../core/headerActions'
import { RegistryEntry } from '../types'
import { RowActionMenuOptions } from './types'

/**
 * Плагин схлопывания действий СТРОКИ (`actionRowSlot`) в единую кебаб-кнопку с
 * раскрывающимся меню — overflow-меню действий строки.
 *
 * Как и `headerActionMenu`, не вносит своих действий и не имеет фичи-инстанса —
 * лишь объявляет `actionMenu` для слота `actionRowSlot`, по которому зона действий
 * (`ActionsZone`) в колонке действий решает: рисовать кнопки инлайн или схлопнуть
 * схлопываемые действия-дескрипторы (`RowAction`) в кебаб. Опаковые/немигрированные
 * кнопки строки в меню не уезжают.
 */
export const rowActionMenu = (
  opts: RowActionMenuOptions = {},
): RegistryEntry => {
  const actionMenu: ActionMenuDeclaration = {
    mode: opts.mode ?? 'auto',
    threshold: opts.threshold ?? 2,
    slots: ['actionRowSlot'],
  }

  return {
    id: 'rowActionMenu',
    enabled: opts.enabled,
    feature: {},
    actionMenu,
  }
}
