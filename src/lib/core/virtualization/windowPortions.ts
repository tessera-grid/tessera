import type { Table } from '../../types'

/** Смена всего окна порциями (ADR 0203) включена; перф WS6–WS7 выключает её для базы. */
export const windowPortions = { enabled: true }

/** Грид рисует первый рендер и смену всего окна по кускам (ADR 0203, `enableIncrementalRender`). */
export const isIncremental = (table: Table<any, any>) =>
  windowPortions.enabled && table.options.enableIncrementalRender !== false
