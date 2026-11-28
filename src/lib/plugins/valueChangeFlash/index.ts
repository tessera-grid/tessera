/**
 * Плагин valueChangeFlash (ADR 0221) — вспышка ячейки, чьё значение сменилось с новыми данными,
 * а не записью человека. Сторож значения — вклад в тело: ячейка зовёт его после коммита, цена —
 * по окну, а не по данным. Колонка выбирает вид полем `changeFlash`, умолчание — `columnDefault`.
 */
import { withBody } from '../../core/bodyContributions'
import { definePlugin } from '../../core/definePlugin'
import { neverInert } from '../../core/pluginDiagnostics'
import type { ValueChangeFlashHooks } from './types'
import { valueChangeFlashFeature } from './valueChangeFlashFeature'
import { watchTotalsWith } from './totals'
import { followEnteringRows, ID, valueChangeFlashBody } from './watch'

export interface ValueChangeFlashOptions {
  /** `false` — плагин отключён. */
  enabled?: boolean
  /** Вид колонок без своего `changeFlash`; по умолчанию `true` — вспыхивают все колонки данных. */
  columnDefault?: ValueChangeFlashHooks['columnDefault']
}

const valueChangeFlashEntry = definePlugin<ValueChangeFlashOptions>()({
  id: ID,
  features: { valueChangeFlashFeature },
  diagnose: neverInert,
  setup: () => followEnteringRows,
  hooks: (o): ValueChangeFlashHooks => ({
    columnDefault: o.columnDefault ?? true,
  }),
  // Итоги футера вспыхивают по тем же правилам колонки (ADR 0221, §9).
  options: o => ({
    watchColumnTotal:
      o.enabled === false
        ? undefined
        : watchTotalsWith(o.columnDefault ?? true),
  }),
})

export const valueChangeFlash = withBody(
  valueChangeFlashEntry,
  valueChangeFlashBody,
)

export type { ValueChangeFlashColumnDef } from './valueChangeFlashFeature'
export type { ValueChangeFlashHooks } from './types'
