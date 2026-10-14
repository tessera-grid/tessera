/**
 * Отметки перестановки (ADR 0110): переставленная строка получает момент и вспыхивает
 * слоем прихода, пока не выйдет `--tsr-comp-row-arrival-duration`.
 */
import { createExpiringMarks } from '../../core/expiringMarks'
import type { RowDrops } from './rowDraggingFeature'

type DropsTable = {
  atoms: { rowDrops?: { get: () => RowDrops } }
  setRowDrops?: (updater: (prev: RowDrops) => RowDrops) => void
}

const NONE: RowDrops = {}

const drops = createExpiringMarks({
  read: table => (table as DropsTable).atoms.rowDrops?.get() ?? NONE,
  write: (table, updater) => (table as DropsTable).setRowDrops?.(updater),
  token: '--tsr-comp-row-arrival-duration',
  fallback: 300,
})

/** Отметить переставленную строку моментом «сейчас». */
export const markRowDrop = (table: unknown, rowId: string) =>
  drops.mark(table, [rowId])
