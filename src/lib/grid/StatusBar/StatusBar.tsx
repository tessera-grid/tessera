/**
 * Нижняя панель грида (ADR 0038): сведения о данных из `statusBarSlot` — слева
 * слоты `align: 'start'`, справа `'end'`. Роль не задаёт: содержимое размечает плагин.
 */
import type { StatusBarSlot } from '../../core/createSlots'
import { RenderSlot } from '../../core/renderSlots'
import { resolveStatusBarSides } from '../../core/statusBar'
import type { Table } from '../../types'
import styles from './StatusBar.module.css'

interface StatusBarProps {
  table: Table<any, any>
  slot: StatusBarSlot
}

export const StatusBar = ({ table, slot }: StatusBarProps) => {
  const { start, end } = resolveStatusBarSides(slot)

  return (
    <div className={styles['status-bar']} data-testid="data-grid-status-bar">
      <div className={styles['status-bar__side']} data-align="start">
        <RenderSlot slot={start} context={{ table }} />
      </div>
      <div className={styles['status-bar__side']} data-align="end">
        <RenderSlot slot={end} context={{ table }} />
      </div>
    </div>
  )
}
