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

import type { TesseraFeatureEntry } from '../../../core/features'
import { setPluginState } from '../../../core/definePlugin'
import { cellKey } from '../../../plugins/cellEditing/session'

/** Небольшая выборка: умеренный грид, переполняющий обе оси. */
export const SMALL = { columnCount: 30, dataCount: 500 } as const
/** Большая выборка: экстремальный грид. */
export const LARGE = { columnCount: 1000, dataCount: 1000 } as const

/** Пагинированный набор (ADR 0038, I7–I8): много строк, страница режется моделью. */
export const PAGED = { columnCount: 30, dataCount: 100_000 } as const

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

/**
 * Засев отправленных ячеек правки (ADR 0041, AS14): служебная запись с `reconcile`
 * один раз, когда появились строки (история подаёт данные эффектом), пишет в срез
 * `cellEditing` ячейки редактируемых колонок первых `rows` строк —
 * чётные строки ждут сервера, нечётные в «ошибке». Через интерфейс набирать
 * столько ячеек долго, а замеряется отрисовка их состояний при прокрутке.
 */
export const submittedCellsSeed = (
  rows: number,
  /** `mixed` — через строку ожидание и «ошибка»; `pending` — все в ожидании (блик). */
  mode: 'mixed' | 'pending' = 'mixed',
): TesseraFeatureEntry => {
  let seeded = false
  return {
    id: 'perfSubmittedCells',
    reconcile: table => {
      const t = table as {
        getCoreRowModel: () => {
          rows: { id: string; getValue: (id: string) => unknown }[]
        }
      }
      const available = t.getCoreRowModel().rows
      if (seeded || available.length === 0) {
        return
      }
      seeded = true
      const submitted: Record<string, unknown> = {}
      available.slice(0, rows).forEach((row, index) => {
        for (const columnId of EDITABLE_COLUMNS) {
          const original = row.getValue(columnId)
          submitted[cellKey(row.id, columnId)] = {
            rowId: row.id,
            columnId,
            draft: String(original ?? ''),
            original,
            status: mode === 'pending' || index % 2 === 0 ? 'pending' : 'error',
            error:
              mode === 'pending' || index % 2 === 0 ? undefined : 'Server down',
            attempt: -1 - index,
          }
        }
      })
      setPluginState(table, 'cellEditing', { active: null, submitted })
    },
  }
}

/**
 * Скорость прокрутки ниже порогов быстрой прокрутки (2000 px/s по Y, 4500 по X) с
 * запасом на разброс кадров: ячейки рисуются своим содержимым, а не скелетами, —
 * замер видит цену состояний ячеек (AS14, CF12).
 */
export const CONTENT_SCROLL = {
  y: { velocity: 600 },
  x: { velocity: 2000 },
} as const

/** Колонки, которые демо разрешает править (как `CELL_EDITABLE_COLUMNS` историй). */
const EDITABLE_COLUMNS = ['age', 'visits', 'gender']

/** Общий таймаут перф-теста (большой грид со всеми плагинами монтируется долго). */
export const PERF_TIMEOUT = 60_000
