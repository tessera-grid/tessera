/**
 * Приложение историй вспышки при смене значения (ADR 0221): «сокет» шлёт обновления строк
 * транзакцией `update`, данные — у истории (`onDataChange`). Таблицу открывает «семя»
 * транзакций (`clientTxSeed`).
 */
import type { TesseraFeatureEntry } from '../../core/features'
import { clientTx, transact } from './clientTransactionsGuide'

interface Row {
  id: string
  [key: string]: unknown
}

const rows = () => (clientTx.table?.options.data ?? []) as Row[]

/** `id` строки данных на месте `index`. */
export const dataRowId = (index: number) => rows()[index]?.id

/** Строка данных приложения по `id`; нет строки — пустой объект. */
export const rowData = (rowId: string | undefined) =>
  rows().find(row => row.id === rowId) ?? {}

/** Значение поля строки в данных приложения. */
export const dataValue = (rowId: string, field: string) =>
  rows().find(row => row.id === rowId)?.[field]

/**
 * Пришло обновление: поля строк приняли новые значения. Уже принятое не шлётся второй раз —
 * действие шага повторяемо.
 */
export const push = (changes: Record<string, Record<string, unknown>>) => {
  const update = rows()
    .filter(row =>
      Object.entries(changes[row.id] ?? {}).some(
        ([field, value]) => !Object.is(row[field], value),
      ),
    )
    .map(row => ({ ...row, ...changes[row.id] }))
  if (update.length) transact({ update })
}

/** Ячейка тела по строке и колонке. */
export const cellOf = (root: ParentNode, rowId: string, columnId: string) =>
  root.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${rowId}"] .data-grid__body-cell[data-column-id="${columnId}"]`,
  )

/** Итог вспышки ячейки или `null`. */
export const flashOf = (root: ParentNode, rowId: string, columnId: string) =>
  cellOf(root, rowId, columnId)?.getAttribute('data-flash') ?? null

/** Направление стрелки ячейки или `undefined`. */
export const arrowOf = (root: ParentNode, rowId: string, columnId: string) =>
  cellOf(root, rowId, columnId)?.querySelector<HTMLElement>(
    '[data-flash-direction]',
  )?.dataset.flashDirection

/**
 * Такт потока `Playground`: у трёх строк окна визиты растут или падают — по кругу, без
 * случайности: одинаковый поток при каждом открытии.
 */
const liveTick = (tick: number) => {
  const data = rows()
  if (data.length < 8) return
  const changes: Record<string, Record<string, unknown>> = {}
  for (let k = 0; k < 3; k++) {
    const row = data[(tick * 3 + k * 5) % 8]!
    const visits = Number(row.visits ?? 0)
    changes[row.id] = { visits: visits + ((tick + k) % 2 === 0 ? 7 : -5) }
  }
  push(changes)
}

const streams = new Map<number, TesseraFeatureEntry>()

/** Поток обновлений приложения на время жизни таблицы; одна запись на период. */
export const valueStream = (intervalMs: number): TesseraFeatureEntry => {
  let entry = streams.get(intervalMs)
  if (!entry) {
    entry = {
      id: 'valueChangeFlashLive',
      setup: () => {
        let tick = 0
        const timer = setInterval(() => liveTick(++tick), intervalMs)
        return () => clearInterval(timer)
      },
    }
    streams.set(intervalMs, entry)
  }
  return entry
}

/** Строка, которую подсвечивает приложение (ADR 0080): поверх её заливки ложится вспышка. */
export const HIGHLIGHTED_ROW = 2

/** Подсветка строки — один раз, как только появились строки: без строк подсветка не ставится. */
export const highlightSeed: TesseraFeatureEntry = {
  id: 'valueChangeFlashHighlight',
  setup: table => {
    const t = table as {
      getCoreRowModel: () => { rows: { id: string }[] }
      highlight: (target: object, options: { tone: string }) => unknown
    }
    let frame = 0
    const apply = () => {
      const row = t.getCoreRowModel().rows[HIGHLIGHTED_ROW]
      if (!row) {
        frame = requestAnimationFrame(apply)
        return
      }
      t.highlight({ row: row.id }, { tone: 'warning' })
    }
    apply()
    return () => cancelAnimationFrame(frame)
  },
}
