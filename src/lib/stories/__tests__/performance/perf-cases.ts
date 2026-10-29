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
  PR_CASES,
} from '../perf.constants'

import type { TesseraFeatureEntry } from '../../../core/features'
import { setPluginState } from '../../../core/definePlugin'
import { cellKey } from '../../../plugins/cellEditing/session'
import { ROW_ACTIONS_COLUMN_ID } from '../../../core/createColumns/actionColumnParams'
import {
  type ActionStatus,
  type MenuAction,
  actionStatusKey,
} from '../../../core/headerActions'

/** Небольшая выборка: умеренный грид, переполняющий обе оси. */
export const SMALL = { columnCount: 30, dataCount: 500 } as const
/** Большая выборка: экстремальный грид. */
export const LARGE = { columnCount: 1000, dataCount: 1000 } as const

/** Пагинированный набор (ADR 0038, I7–I8): много строк, страница режется моделью. */
export const PAGED = { columnCount: 30, dataCount: 100_000 } as const

/**
 * Обвязка историй без включённых плагинов: выключенные фабрики в наборе — база гейтов
 * «фича против базы». Край матрицы «без плагинов» — `renderPluginsGrid` (ADR 0004).
 */
export const NO_PLUGINS: Record<string, boolean> = {}
/**
 * Все встроенные плагины включены (ADR 0004), кроме пагинации и ленты: они меняют
 * число строк в окне, их цена — в I7–I8 и IS16–IS17.
 */
export const ALL_PLUGINS: Record<string, boolean> = {
  enableColumnSorting: true,
  enableColumnSizing: true,
  enableColumnPinning: true,
  enableColumnDragging: true,
  enableColumnVisibility: true,
  enableColumnFiltering: true,
  enableQuickSearch: true,
  enableHeaderActionMenu: true,
  enableRowSelection: true,
  enableRowDragging: true,
  enableRowExpanding: true,
  enableTreeLines: true,
  enableRowGrouping: true,
  enableRowActions: true,
  enableRowActionMenu: true,
  enableCellEditing: true,
  enableCellSelection: true,
  enableContextMenu: true,
  enableDataExport: true,
  enableBackToTop: true,
  enableFooter: true,
  enableKeyboardNavigation: true,
}

/**
 * Кнопки заголовка в ряд при всех плагинах: `headerActionMenu` в наборе, но порог
 * выше числа действий — иначе от трёх они уходят в кебаб (ADR 0024).
 */
export const INLINE_HEADER_ACTIONS = { headerActionMenuThreshold: 100 }

/** Ширина колонки, в которую встают все кнопки заголовка: иначе лишние — в кебаб (ADR 0111). */
const WIDE_COLUMN_SIZE = 360

/** Кнопки заголовка в ряд и колонки под них — для кейсов, что нажимают кнопку заголовка. */
export const inlineHeaderActions = <C extends object>(
  columns: readonly C[],
) => ({
  ...INLINE_HEADER_ACTIONS,
  columnsOverride: columns.map(column => ({
    ...column,
    size: WIDE_COLUMN_SIZE,
  })),
})

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
 * Засев кебабов строк (ADR 0078, MI23): у первых `rows` строк действие «Delete»
 * через строку ждёт или упало — блик и отметка ошибки на каждом смонтированном кебабе.
 */
export const actionStatusSeed = (rows: number): TesseraFeatureEntry => {
  let seeded = false
  return {
    id: 'perfActionStatus',
    reconcile: table => {
      const t = table as {
        getCoreRowModel: () => { rows: { id: string }[] }
        setActionStatus?: (updater: () => ActionStatus) => void
        getSlotActions?: () => { actionRowSlot: MenuAction[] } | undefined
      }
      const available = t.getCoreRowModel().rows
      if (seeded || available.length === 0) {
        return
      }
      seeded = true
      const action = t
        .getSlotActions?.()
        ?.actionRowSlot.find(entry => entry.id === 'delete')
      const status: ActionStatus = {}
      available.slice(0, rows).forEach((row, index) => {
        const key = actionStatusKey(
          { id: 'delete' },
          { row, column: { id: ROW_ACTIONS_COLUMN_ID } },
        )
        status[key] =
          index % 2 === 0
            ? { pending: true, action, menu: true }
            : {
                failed: true,
                error: new Error('Server down'),
                action,
                menu: true,
              }
      })
      t.setActionStatus?.(() => status)
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

/**
 * Быстрая прокрутка — на четверть выше порогов входа (2000 px/s по Y, 4500 по X) по
 * реальному времени кадра: ячейки — скелеты на любом гриде, а нагрузка — самый дешёвый
 * режим быстрой прокрутки. Шаг на кадр зависит от частоты кадров — на тяжёлом гриде
 * скорость падала ниже порога (P7/P8 по X мерили содержимое).
 */
export const FAST_SCROLL = {
  y: { velocity: 2500, fast: true },
  x: { velocity: 5600, fast: true },
} as const

/** Колонки, которые демо разрешает править (как `CELL_EDITABLE_COLUMNS` историй). */
const EDITABLE_COLUMNS = ['age', 'visits', 'gender']

/** Общий таймаут перф-теста (большой грид со всеми плагинами монтируется долго). */
export const PERF_TIMEOUT = 60_000

/**
 * Засев мультисортировки по всем колонкам (ADR 0062, AI10): служебная запись один
 * раз, когда колонки собраны, сортирует по каждой сортируемой колонке — у каждого
 * заголовка номер приоритета. Через интерфейс набирать 1000 сортировок долго.
 */
export const sortAllColumnsSeed = (): TesseraFeatureEntry => {
  let seeded = false
  return {
    id: 'perfSortAllColumns',
    reconcile: table => {
      const t = table as {
        getAllLeafColumns: () => { id: string; getCanSort: () => boolean }[]
        setSorting: (sorting: { id: string; desc: boolean }[]) => void
      }
      const sortable = t.getAllLeafColumns().filter(c => c.getCanSort())
      if (seeded || sortable.length === 0) {
        return
      }
      seeded = true
      t.setSorting(sortable.map(c => ({ id: c.id, desc: false })))
    },
  }
}

/**
 * Засев вспышек итога (ADR 0134, OF20): 1500 ячеек — по 500 строк в трёх колонках,
 * итоги `arrived`, `accepted`, `reverted`. Вспышка ставится после монтирования грида —
 * время берётся из токенов темы, поэтому `flash()` зовёт тест.
 */
export const outcomeFlashSeed = (rows: number) => {
  let table:
    | {
        flashOutcome: (targets: object[], outcome: string) => void
        getAllLeafColumns: () => { id: string }[]
      }
    | undefined
  const entry: TesseraFeatureEntry = {
    id: 'perfOutcomeFlash',
    setup: t => {
      table = t as typeof table
    },
  }
  const flash = () => {
    const columns = table!.getAllLeafColumns().slice(0, 3)
    const outcomes = ['arrived', 'accepted', 'reverted']
    columns.forEach((column, i) =>
      table!.flashOutcome(
        Array.from({ length: Math.min(rows, 500) }, (_, row) => ({
          cell: [`item-id-${row}`, column.id],
        })),
        outcomes[i]!,
      ),
    )
  }
  return { entry, flash }
}

/**
 * Засев вспышки диапазона (ADR 0152, TG11): один диапазон на всё тело — все строки и все
 * колонки. Как у `outcomeFlashSeed`, вспышку ставит тест после монтирования.
 */
export const rangeFlashSeed = (rows: number) => {
  let table:
    | {
        flashOutcome: (target: object, outcome: string) => void
        getAllLeafColumns: () => { id: string }[]
      }
    | undefined
  const entry: TesseraFeatureEntry = {
    id: 'perfRangeFlash',
    setup: t => {
      table = t as typeof table
    },
  }
  const flash = () => {
    const columns = table!.getAllLeafColumns()
    table!.flashOutcome(
      {
        range: {
          rows: ['item-id-0', `item-id-${rows - 1}`],
          columns: [columns[0]!.id, columns.at(-1)!.id],
        },
      },
      'reverted',
    )
  }
  return { entry, flash }
}

/**
 * Засев ожидания на цели (ADR 0152, TG18): действие меню ждёт с целью-диапазоном на всё
 * тело — по всем ячейкам окна идёт волна ожидания. Ставит тест после монтирования.
 */
export const pendingWaveSeed = (rows: number) => {
  let table:
    | {
        setActionStatus: (updater: (prev: object) => object) => void
        getAllLeafColumns: () => { id: string }[]
      }
    | undefined
  const entry: TesseraFeatureEntry = {
    id: 'perfPendingWave',
    setup: t => {
      table = t as typeof table
    },
  }
  const pend = () => {
    const columns = table!.getAllLeafColumns()
    table!.setActionStatus(prev => ({
      ...prev,
      'perf|wave': {
        pending: true,
        target: [
          {
            range: {
              rows: ['item-id-0', `item-id-${rows - 1}`],
              columns: [columns[0]!.id, columns.at(-1)!.id],
            },
          },
        ],
      },
    }))
  }
  return { entry, pend }
}

/**
 * Засев подсветки (ADR 0080, HL19): каждая 10-я строка и третья колонка залиты.
 * Через публичный `table.highlight` из `setup`, как плагин.
 */
export const highlightSeed = (rows: number): TesseraFeatureEntry => ({
  id: 'perfHighlight',
  setup: table => {
    const t = table as {
      highlight: (target: object, options?: object) => unknown
      getAllLeafColumns: () => { id: string }[]
    }
    for (let i = 0; i < rows; i += 10) {
      t.highlight({ row: `item-id-${i}` }, { tone: 'warning' })
    }
    t.highlight({ column: t.getAllLeafColumns()[2]!.id }, { tone: 'success' })
  },
})
