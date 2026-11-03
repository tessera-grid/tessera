/**
 * Вид инлайн-кнопки действия: включено, есть неприменённое (ADR 0178, §3) и подписи. С
 * черновиком подписи говорят, что изменение не применено; включённое главнее в бабле.
 */
import type { TableLabels } from '../../core/localization'
import type { SlotAction } from '../../core/headerActions'

export const actionLook = (
  action: SlotAction,
  context: any,
  labels: TableLabels,
) => {
  const active = action.active?.(context)
  const draft = action.draft?.(context) === true
  const named = (name: string) =>
    !draft
      ? name
      : active
        ? labels.actionActiveDraft(name)
        : labels.actionDraft(name)
  const plain = action.label(context, labels)
  return {
    active,
    draft,
    /** Кнопка видна без наведения. */
    shown: !!active || draft || action.shown?.(context) === true,
    label: named(plain),
    ariaLabel: named(action.ariaLabel?.(context, labels) ?? plain),
  }
}
