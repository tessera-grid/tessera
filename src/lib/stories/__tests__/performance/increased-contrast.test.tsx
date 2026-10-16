import { describe, expect, test } from 'vitest'

import type { TesseraFeatureEntry } from '../../../core/features'
import { measureScrollWork, recordPerf, renderGrid } from '../helpers'
import { waitForGrid } from '../visual/core-helpers'
import { againstBase, axesCeiling, medianAxes } from './baseline'
import {
  ANIMATION_BUDGET_MS,
  CONTENT_SCROLL,
  CPU_THROTTLE_RATE,
  LARGE,
  PERF_TIMEOUT,
  highlightSeed,
} from './perf-cases'

// Повышенный контраст (ADR 0088, MC10): спокойная прокрутка 1000×1000 с выбранными
// строками, подсветкой и линиями дерева при `contrast="more"` (контуры строк, плотные
// линии) против того же грида в обычном режиме.

/** Каждая 10-я строка выбрана — один раз, когда появились строки. */
const selectionSeed = (rows: number): TesseraFeatureEntry => {
  let done = false
  return {
    id: 'perfSelection',
    reconcile: table => {
      const t = table as {
        getCoreRowModel: () => { rows: unknown[] }
        setRowSelection: (value: Record<string, boolean>) => void
      }
      if (done || t.getCoreRowModel().rows.length === 0) return
      done = true
      const selection: Record<string, boolean> = {}
      for (let i = 0; i < rows; i += 10) selection[`item-id-${i}`] = true
      t.setRowSelection(selection)
    },
  }
}

/** Цена режима против того же грида в обычном режиме (ADR 0099, §1а). */
const MC10_COST = { ratio: 1.3, plusMs: 4 }

describe('Производительность прокрутки — повышенный контраст', () => {
  test(
    'MC10: прокрутка 1000×1000 с выбором, подсветкой и линиями дерева при повышенном контрасте не дороже того же грида в обычном режиме',
    async () => {
      const measure = async (more: boolean) => {
        const screen = renderGrid({
          ...LARGE,
          contrast: more ? 'more' : 'auto',
          enableRowSelection: true,
          enableRowExpanding: true,
          enableTreeLines: true,
          dataNesting: 'nested',
          initialExpanded: true,
          extraPlugins: [
            selectionSeed(LARGE.dataCount),
            highlightSeed(LARGE.dataCount),
          ],
        })
        await waitForGrid()
        await expect
          .poll(() =>
            document.querySelector(
              '.data-grid__body-row[data-selected="true"]',
            ),
          )
          .not.toBeNull()
        const y = await measureScrollWork('y', CONTENT_SCROLL.y)
        const x = await measureScrollWork('x', CONTENT_SCROLL.x)
        ;(await screen).unmount()
        return { y, x }
      }

      const runs = await againstBase(measure)
      const base = medianAxes(runs.base)
      const more = medianAxes(runs.variant)
      const ceiling = axesCeiling(base, MC10_COST)
      const record = (
        id: string,
        label: string,
        r: typeof base,
        gated: boolean,
      ) =>
        recordPerf({
          id,
          label,
          operation: 'scroll',
          size: '1000×1000',
          plugins: 'rowSelection, rowExpanding, highlight',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: (['y', 'x'] as const).map(axis => ({
            axis,
            kind: 'animation' as const,
            metric: 'p95' as const,
            valueMs: r[axis].p95Ms,
            targetMs: ANIMATION_BUDGET_MS,
            ceilingMs: gated ? ceiling[axis] : undefined,
            ...r[axis],
          })),
        })
      await record('MC10-base', 'обычный режим', base, false)
      await record('MC10', 'contrast: more', more, true)

      for (const axis of ['y', 'x'] as const) {
        expect(
          more[axis].p95Ms,
          `${axis} p95=${more[axis].p95Ms.toFixed(1)}ms (база ${base[axis].p95Ms.toFixed(1)}ms, потолок ${ceiling[axis].toFixed(1)})`,
        ).toBeLessThanOrEqual(ceiling[axis])
      }
    },
    PERF_TIMEOUT * 2,
  )
})
