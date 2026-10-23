// @vitest-environment happy-dom
/**
 * Короткие формы счётчиков нижней панели (ADR 0083, TX8): умолчания и замена через
 * `localization`.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'

import {
  ENGLISH_LABELS,
  LocalizationProvider,
  type TableLabels,
  useLocalization,
} from '../core/localization'

;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

const shortForms = (labels: TableLabels) => [
  labels.loadedRowsOfShort(12_340, 100_000),
  labels.loadedRowsShort(12_340),
  labels.selectedRowsShort(12),
  labels.selectedRowsHiddenShort(3),
  labels.filteredRowsShort(12, 100),
]

describe('Короткие формы счётчиков', () => {
  it('TX8: короткие формы счётчиков задаются через localization', () => {
    expect(shortForms(ENGLISH_LABELS)).toEqual([
      '12,340 / 100,000',
      '12,340',
      '12 selected',
      '3 hidden',
      '12 / 100',
    ])

    let seen: TableLabels | undefined
    const Probe = () => {
      seen = useLocalization()
      return null
    }
    const root = createRoot(document.createElement('div'))
    act(() =>
      root.render(
        <LocalizationProvider
          localization={{
            loadedRowsShort: count => `L${count}`,
            loadedRowsOfShort: count => `L${count}`,
            selectedRowsShort: count => `S${count}`,
            selectedRowsHiddenShort: count => `H${count}`,
            filteredRowsShort: (shown, total) => `F${shown}/${total}`,
          }}
        >
          <Probe />
        </LocalizationProvider>,
      ),
    )
    expect(shortForms(seen!)).toEqual([
      'L12340',
      'L12340',
      'S12',
      'H3',
      'F12/100',
    ])
    act(() => root.unmount())
  })
})
