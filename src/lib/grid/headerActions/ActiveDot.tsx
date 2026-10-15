/**
 * Точка «действие включено» в правом верхнем углу кнопки (ADR 0062). Кнопка-носитель
 * уже `position: relative` (контур ожидания), поэтому точка не меняет её размер.
 * Скрытая точка остаётся в DOM — появление и исчезновение идут переходом.
 */
import { Bubble } from '../../ui/Bubble'

import styles from '../../grid/headerActions/ActionButton.module.css'

export const ActiveDot = ({ shown }: { shown: boolean }) => (
  <Bubble
    size="dot"
    tone="active"
    className={styles.dot}
    data-active-indicator=""
    data-shown={shown}
    aria-hidden
  />
)

/**
 * Точка для действия с признаком `active`. Довесок (`adornment`, номер приоритета
 * сортировки) занимает её место — точки нет.
 */
export const actionDot = (
  hasActive: boolean,
  active: boolean,
  hasAdornment: boolean,
) => (hasActive && !hasAdornment ? <ActiveDot shown={active} /> : null)

/**
 * Отметка отказа действия на кебабе (ADR 0078) — на месте точки включённых. `delayed` —
 * появляется, когда погаснет красный свет отказа (ADR 0116, §5).
 */
export const ErrorDot = ({
  shown,
  delayed,
}: {
  shown: boolean
  delayed?: boolean
}) => (
  <Bubble
    size="dot"
    tone="error"
    className={styles.dot}
    data-error-indicator=""
    data-shown={shown}
    data-delayed={delayed || undefined}
    aria-hidden
  />
)
