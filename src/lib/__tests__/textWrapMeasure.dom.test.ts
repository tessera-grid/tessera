// @vitest-environment happy-dom
/**
 * Замер высоты строк по содержимому (ADR 0218, §5): строка, ушедшая из окна, держит последнюю
 * высоту — она служит оценкой этой строки до перемера, а не оценка таблицы.
 */
import { afterEach, describe, expect, it } from 'vitest'

import { rowNeedsOf, rowSizeOf } from '../core/rowSizes'
import { disposeMeasurer, measurerOf } from '../plugins/textWrap/measure'

const table = { store: {}, options: { estimatedRowHeight: 40 } }

/** Строка с ячейкой колонки `autoHeight`: проба и обёртка содержимого высотой `height`. */
const mountRow = (id: string, height: number) => {
  const row = document.createElement('div')
  row.className = 'data-grid__body-row'
  row.dataset.rowId = id
  const cell = document.createElement('div')
  const probe = document.createElement('span')
  const wrapper = document.createElement('div')
  wrapper.className = 'data-grid__cell-wrapper-content'
  wrapper.getBoundingClientRect = () => ({ height }) as DOMRect
  cell.append(probe, wrapper)
  row.append(cell)
  document.body.append(row)
  return { row, probe }
}

const microtask = () => new Promise<void>(resolve => queueMicrotask(resolve))

afterEach(() => {
  disposeMeasurer(table)
  document.body.replaceChildren()
})

describe('Замер высоты строк textWrap', () => {
  it('AH14: сброшенный размер строки служит её оценкой до перемера — полная высота не падает к оценке таблицы', async () => {
    const { row, probe } = mountRow('r1', 90)
    measurerOf(table).track(probe)
    await microtask()
    expect(rowNeedsOf(table).get('r1')).toBe(90)

    // Строка ушла из окна: проба снята вместе со строкой.
    row.remove()
    measurerOf(table).untrack(probe)
    await microtask()
    await microtask()
    const needs = rowNeedsOf(table)
    expect(needs.get('r1')).toBe(90)
    expect(rowSizeOf(needs, 'r1', 50, 40)).toBe(90)

    // Вернулась другой высоты — перемерена при монтировании.
    const back = mountRow('r1', 70)
    measurerOf(table).track(back.probe)
    await microtask()
    expect(rowNeedsOf(table).get('r1')).toBe(70)

    // Скрыли колонку: строка на месте, ячеек autoHeight нет — высота строки, а не прежняя.
    measurerOf(table).untrack(back.probe)
    await microtask()
    await microtask()
    expect(rowSizeOf(rowNeedsOf(table), 'r1', 50, 40)).toBe(50)
  })
})
