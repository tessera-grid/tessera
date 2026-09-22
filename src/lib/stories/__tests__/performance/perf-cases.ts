// Общие оси перф-матрицы для first-render.test.tsx и scroll.test.tsx.
//
// Покрытие производительности — это куб 2×2×2: операция (первая
// отрисовка / прокрутка) × объём данных (небольшой / большой) × плагины (без /
// все). Операция задаётся файлом (first-render vs scroll), а два оставшихся
// измерения — здесь, чтобы оба файла гоняли одну и ту же сетку.

// Абсолютные пороги RAIL/CWV и параметры замера — из чистого модуля perf.constants
// (безопасен и в браузере, и в Node).
export {
  ANIMATION_BUDGET_MS,
  CPU_THROTTLE_RATE,
  FRAME_BUDGET_60FPS,
  LOAD_BUDGET_MS,
  LONG_TASK_MS,
} from '../perf.constants'

/** Небольшая выборка: умеренный грид, переполняющий обе оси. */
export const SMALL = { columnCount: 30, dataCount: 500 } as const
/** Большая выборка: экстремальный грид. */
export const LARGE = { columnCount: 1000, dataCount: 1000 } as const

/** Режим без плагинов — чистая виртуализация. */
export const NO_PLUGINS: Record<string, boolean> = {}
/** Все плагины включены одновременно. */
export const ALL_PLUGINS: Record<string, boolean> = {
  enableColumnSorting: true,
  enableColumnResizing: true,
  enableColumnPinning: true,
  enableColumnDragging: true,
  enableRowSelection: true,
  enableRowDragging: true,
  enableRowActions: true,
  enableCellSelection: true,
  enableFooter: true,
}

/** Общий таймаут перф-теста (большой грид со всеми плагинами монтируется долго). */
export const PERF_TIMEOUT = 60_000
