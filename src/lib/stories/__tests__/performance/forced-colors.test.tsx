import { commands } from 'vitest/browser'
import { afterEach, describe, expect, test } from 'vitest'

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

// Высокая контрастность (ADR 0087, HC12): спокойная прокрутка 1000×1000 с выбранными
// строками, подсветкой и линиями дерева в `forced-colors: active` против того же грида
// в обычном режиме. Потолок — как у HL19 (1000×1000 с подсветкой).

const fc = commands as unknown as {
  forcedColors: (active: boolean) => Promise<void>
}

afterEach(() => fc.forcedColors(false))

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

describe('Производительность прокрутки — высокая контрастность', () => {
  test(
    'HC12: прокрутка 1000×1000 с выбором, подсветкой и линиями дерева в forced-colors — в пределах потолка HL19; база в обычном режиме в дашборде',
    async () => {
      const measure = async (forced: boolean) => {
        await fc.forcedColors(forced)
        const screen = renderGrid({
          ...LARGE,
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
      const forced = await measure(true)
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
      await record('HC12-base', 'обычный режим', base, false)
      await record('HC12', 'forced-colors: active', forced, true)

      for (const axis of ['y', 'x'] as const) {
        expect(
          forced[axis].p95Ms,
          `${axis} p95=${forced[axis].p95Ms.toFixed(1)}ms (база ${base[axis].p95Ms.toFixed(1)}ms, потолок ${CEILING[axis]})`,
        ).toBeLessThanOrEqual(CEILING[axis])
      }
    },
    PERF_TIMEOUT * 2,
  )
})
