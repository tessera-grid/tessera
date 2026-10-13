import { useTableState } from '../../core/reactivity'

/**
 * Открытое меню или панель перерисовываются при любой смене состояния: их пункты и
 * разделы читают живое состояние. Закрытые — нет, вид зоны держит `zoneViewKey`
 * (ADR 0099, PF5).
 */
export const useStateWhileOpen = (table: unknown, open: boolean) =>
  useTableState(table as never, (state: unknown) => (open ? state : null))
