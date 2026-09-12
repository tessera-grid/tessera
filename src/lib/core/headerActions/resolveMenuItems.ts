import { TableLabels } from '../localization'
import { HeaderMenuItem, SlotAction } from './types'

/**
 * Пункты подгруппы одного действия для меню: либо разворот `menuItems` (напр.
 * сортировка asc/desc/сброс или закрепление слева/справа), либо одна строка из
 * полей дескриптора (пин с одной стороны, группировка). Чистая: поля уже
 * вычислены с учётом `ctx`/`labels` — переиспользуется и кебабом
 * (`ActionMenu`), и инлайн-поповером (`ActionInlineMenu`).
 */
export const resolveMenuItems = (
  action: SlotAction,
  context: unknown,
  labels: TableLabels,
): HeaderMenuItem[] => {
  if (action.menuItems) {
    return action.menuItems(context, labels)
  }

  return [
    {
      id: action.id,
      label: action.label(context, labels),
      icon: action.icon(context),
      onSelect: () => action.onSelect(context),
      disabled: action.disabled?.(context) ?? false,
      active: action.active?.(context) ?? false,
    },
  ]
}
