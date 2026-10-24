import { Bubble } from '../../ui/Bubble'
import type { SlotAction } from '../../core/headerActions'

import styles from '../../grid/headerActions/ActionButton.module.css'

/**
 * Включён ли кебаб (ADR 0129): `undefined` — среди свёрнутых нет действий с `active`, и
 * узла бабла у кнопки нет.
 */
export const kebabActive = (actions: SlotAction[], activeCount: number) =>
  actions.some(action => action.active) ? activeCount > 0 : undefined

/** Отметка отказа действия на кебабе (ADR 0078) — на месте точки включённых. */
export const ErrorDot = ({ shown }: { shown: boolean }) => (
  <Bubble
    size="dot"
    tone="error"
    className={styles.dot}
    data-error-indicator=""
    data-shown={shown}
    aria-hidden
  />
)
