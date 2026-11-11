// @vitest-environment happy-dom
/**
 * Render-тест BodyCell (happy-dom): DOM-контракт ячейки — role, размеры через
 * CSS-переменные, пиннинг-атрибуты (start), контент через flexRender.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { constructTable } from '@tanstack/react-table'
import { storeReactivityBindings } from '../../../node_modules/@tanstack/table-core/dist/store-reactivity-bindings.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { defaultCell } from '../core/commonFeature'
import { buildTesseraFeatures, foldEntries } from '../core/features'
import { columnPinning } from '../plugins/columnPinning'
import { columnSizing } from '../plugins/columnSizing'
import { BodyCell } from '../grid/BodyCell'

;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

const makeTable = (
  value = 'Xenia',
  cell: unknown = (info: any) => String(info.getValue()),
) => {
  const entries = [
    {
      id: 'reactivity',
      features: { coreReactivityFeature: storeReactivityBindings() },
    },
    columnPinning(),
    columnSizing(),
  ]
  const features = buildTesseraFeatures(entries as never)
  const folded = foldEntries(entries)
  return constructTable({
    features,
    data: [{ id: '1', name: value }],
    columns: [
      {
        id: 'name',
        accessorKey: 'name',
        size: 120,
        cell,
      },
    ],
    getRowId: (row: any) => row.id,
    ...folded.options,
  } as never) as any
}

const cellOf = (table: any) =>
  table
    .getRowModel()
    .rows[0].getAllCells()
    .find((c: any) => c.column.id === 'name')

let container: HTMLElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('BodyCell (happy-dom)', () => {
  it('DOM-контракт: role, aria-colindex, размер-переменная, контент', () => {
    const table = makeTable()
    act(() => {
      root.render(<BodyCell cell={cellOf(table)} rowIndex={0} />)
    })

    const cellEl = container.querySelector('[role="cell"]') as HTMLElement
    expect(cellEl).toBeTruthy()
    expect(cellEl.getAttribute('data-column-id')).toBe('name')
    expect(cellEl.getAttribute('aria-colindex')).toBe('1')
    expect(cellEl.style.width).toBe('var(--col-name-size)')
    expect(cellEl.textContent).toContain('Xenia')
    // Не закреплена → data-cell-pinned пустой/false.
    expect(cellEl.getAttribute('data-cell-pinned')).toBe('false')
  })

  it('пиннинг start отражается в data-cell-pinned и left-offset', () => {
    const table = makeTable()
    table.setColumnPinning({ start: ['name'], end: [] })

    act(() => {
      root.render(<BodyCell cell={cellOf(table)} rowIndex={0} />)
    })

    const cellEl = container.querySelector('[role="cell"]') as HTMLElement
    // DOM-контракт грида остался left/right (CSS/тесты/бейзлайны), хотя v9
    // getIsPinned даёт start/end — маппинг pinnedSideToDom.
    expect(cellEl.getAttribute('data-cell-pinned')).toBe('left')
    // Первая закреплённая слева → смещение 0px.
    expect(cellEl.style.left).toBe('0px')
  })

  it('TN2: слот ячейки с записями рисуется, как прежде: слева, справа и владелец получают контекст ячейки и её содержимое', () => {
    const table = makeTable()
    const seen: string[] = []
    const Side =
      (label: string) =>
      ({ cell }: { cell: { id: string } }) => {
        seen.push(`${label}:${cell.id}`)
        return <i data-side={label}>{label}</i>
      }
    const Owner = ({ content }: { content: unknown }) => (
      <b data-owner="">{content as never}</b>
    )
    act(() => {
      root.render(
        <BodyCell
          cell={cellOf(table)}
          rowIndex={0}
          leftCellSlot={[{ id: 'left', component: Side('L') }] as never}
          rightCellSlot={[{ id: 'right', component: Side('R') }] as never}
          cellSlot={[{ id: 'owner', component: Owner }] as never}
        />,
      )
    })
    const wrapper = container.querySelector('.data-grid__cell-wrapper-content')!
    expect([...wrapper.children].map(child => child.tagName)).toEqual([
      'I',
      'B',
      'I',
    ])
    expect(
      wrapper.querySelector('[data-owner] .data-grid__cell-wrapper-title')!
        .textContent,
    ).toBe('Xenia')
    const id = cellOf(table).id
    expect(seen).toEqual(expect.arrayContaining([`L:${id}`, `R:${id}`]))
  })

  it('TN3: DOM ячейки тела прежний — обёртка .data-grid__cell-wrapper-content, в ней подпись .data-grid__cell-wrapper-title с data-testid; пустое содержимое — без подписи', () => {
    act(() => {
      root.render(<BodyCell cell={cellOf(makeTable())} rowIndex={0} />)
    })
    const cellEl = container.querySelector('[role="cell"]')!
    const wrapper = cellEl.querySelector(
      ':scope > .data-grid__cell-wrapper-content',
    )!
    expect(wrapper).not.toBeNull()
    const title = wrapper.querySelector(
      ':scope > .data-grid__cell-wrapper-title',
    )!
    expect(title.getAttribute('data-testid')).toBe('table-field-cell-name')
    expect(title.textContent).toBe('Xenia')

    act(() => {
      // Ячейка ядра с пустым значением — пустое содержимое.
      root.render(
        <BodyCell cell={cellOf(makeTable('', defaultCell))} rowIndex={0} />,
      )
    })
    expect(
      container.querySelector('.data-grid__cell-wrapper-content'),
    ).not.toBeNull()
    expect(container.querySelector('.data-grid__cell-wrapper-title')).toBeNull()
  })
})
