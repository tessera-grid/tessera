/**
 * Сторож значения смонтированной ячейки (ADR 0221, §4) — вклад в тело: ячейка зовёт `watch`
 * после коммита, когда её значение сменилось; первая отрисовка — не смена. Вспышки одного
 * коммита пишутся в срез одной записью на итог.
 */
import type { BodyContributions } from '../../core/bodyContributions'
import { readPluginHooks } from '../../core/definePlugin'
import {
  flashOutcome,
  type FlashOutcome,
} from '../../core/flashes/flashFeature'
import { consumeOwnWrite } from '../../shared/ownWrites'
import type { Cell } from '../../types'
import {
  changeOutcome,
  sameCellValue,
  type CompareColumn,
} from '../../shared/cellValues'
import type { ValueChangeFlashHooks } from './types'
import type { ValueChangeFlashColumnDef } from './valueChangeFlashFeature'

export const ID = 'valueChangeFlash'

type Pending = Map<string, { cell: [string, string]; outcome: FlashOutcome }>

const queues = new WeakMap<object, Pending>()

/** Кадр без браузера (серверный рендер, тесты в node) — следующая задача. */
const nextFrame = (run: () => void) => {
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run)
  else setTimeout(run, 0)
}

/**
 * Вспышки коммита — одной записью на итог в следующем кадре: новые значения красятся сразу, а
 * перерисовка вспыхнувших ячеек не удлиняет задачу смены данных (ADR 0221, §4, VC18).
 */
const enqueue = (
  table: { store: object },
  rowId: string,
  columnId: string,
  outcome: FlashOutcome,
) => {
  let queue = queues.get(table.store)
  if (!queue) {
    const pending: Pending = new Map()
    queue = pending
    queues.set(table.store, pending)
    nextFrame(() => {
      queues.delete(table.store)
      const byOutcome = new Map<FlashOutcome, { cell: [string, string] }[]>()
      for (const { cell, outcome: kind } of pending.values()) {
        const list = byOutcome.get(kind) ?? []
        list.push({ cell })
        byOutcome.set(kind, list)
      }
      for (const [kind, targets] of byOutcome)
        flashOutcome(table, targets, kind)
    })
  }
  queue.set(`${rowId}\u0000${columnId}`, { cell: [rowId, columnId], outcome })
}

interface WatchColumn extends CompareColumn {
  columnDef: ValueChangeFlashColumnDef
  getIsActionsColumn: () => boolean
  getServiceColumn: () => unknown
}

/** Вид колонки: своё поле или умолчание плагина; служебные колонки не вспыхивают. */
const modeOf = (
  column: WatchColumn,
  columnDefault: ValueChangeFlashHooks['columnDefault'],
) =>
  column.getServiceColumn() || column.getIsActionsColumn()
    ? false
    : (column.columnDef.changeFlash ?? columnDefault)

/** Смена значения ячейки: своя запись и равное по типу — без вспышки. */
const watch = (
  cell: Cell<any, any, unknown>,
  value: unknown,
  previous: unknown,
) => {
  const row = cell.row as { id: string; getIsGrouped?: () => boolean }
  if (row.getIsGrouped?.()) return
  const column = cell.column as unknown as WatchColumn
  const table = cell.getContext().table as unknown as { store: object }
  // Без слайса хуков плагин выключен: его вклад в тело ещё не ушёл.
  const hooks = readPluginHooks<Partial<ValueChangeFlashHooks>>(
    table as never,
    ID,
  )
  if (hooks.columnDefault === undefined) return
  const mode = modeOf(column, hooks.columnDefault)
  if (mode === false) return
  if (sameCellValue(table, column, previous, value)) return
  if (consumeOwnWrite(table, row.id, column.id)) return
  enqueue(
    table,
    row.id,
    column.id,
    changeOutcome(column, previous, value, mode === 'direction'),
  )
}

export const valueChangeFlashBody: BodyContributions = {
  cell: {
    id: ID,
    slices: [],
    select: () => null,
    render: () => null,
    watch,
  },
}
