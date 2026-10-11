import { describe, expect, test } from 'vitest'

import type { TesseraFeatureEntry } from '../../../core/features'
import { measureScrollWork, recordPerf, renderGrid } from '../helpers'
import { waitForGrid } from '../visual/core-helpers'
import {
  CONTENT_SCROLL,
  CPU_THROTTLE_RATE,
  LARGE,
  PERF_TIMEOUT,
  highlightSeed,
} from './perf-cases'

// Повышенный контраст (ADR 0088, MC10): спокойная прокрутка 1000×1000 с выбранными
// строками, подсветкой и линиями дерева при `contrast="more"` (контуры строк, плотные
// линии) против того же грида в обычном режиме. Потолок — как у HC12.

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

const CEILING = { y: 26, x: 40 }

describe('Производительность прокрутки — повышенный контраст', () => {
  test(
    'MC10: прокрутка 1000×1000 с выбором, подсветкой и линиями дерева при повышенном контрасте — в пределах потолка HC12; база в обычном режиме в дашборде',
    async () => {
      const measure = async (more: boolean) => {
        const screen = renderGrid({
          ...LARGE,
          contrast: more ? 'more' : 'auto',
          enableRowSelection: true,
          enableRowExpanding: true,
          rowExpandingTreeLines: true,
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

      const base = await measure(false)
      const more = await measure(true)
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
          knownShortfall: false,
          metrics: (['y', 'x'] as const).map(axis => ({
            axis,
            kind: 'animation' as const,
            metric: 'p95' as const,
            valueMs: r[axis].p95Ms,
            budgetMs: CEILING[axis],
            pass: !gated || r[axis].p95Ms <= CEILING[axis],
            ...r[axis],
          })),
        })
      await record('MC10-base', 'обычный режим', base, false)
      await record('MC10', 'contrast: more', more, true)

      for (const axis of ['y', 'x'] as const) {
        expect(
          more[axis].p95Ms,
          `${axis} p95=${more[axis].p95Ms.toFixed(1)}ms (база ${base[axis].p95Ms.toFixed(1)}ms, потолок ${CEILING[axis]})`,
        ).toBeLessThanOrEqual(CEILING[axis])
      }
    },
    PERF_TIMEOUT * 2,
  )
})
