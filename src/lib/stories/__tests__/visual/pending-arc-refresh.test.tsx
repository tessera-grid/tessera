import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'
import { useState } from 'react'

import '../../../ui/theme/theme.css'
import { definePlugin } from '../../../core/definePlugin'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { CellButton } from '../../../ui/CellButton/CellButton'
import { pendingArcOf } from '../helpers'
import { waitForGrid } from './core-helpers'

const DATA = Array.from({ length: 30 }, (_, i) => ({
  id: `r${i}`,
  name: `Name ${String(i).padStart(2, '0')}`,
}))

// Занятая кнопка ячейки — свой контрол автора (ADR 0176): у кнопок-источников дуги нет (ADR 0177).
const busyButton = definePlugin()({
  id: 'busyButton',
  slots: [
    {
      id: 'busyButton',
      slot: 'rightCellSlot',
      component: ({ row }: { row: { id: string } }) =>
        row.id === 'r1' ? (
          <CellButton
            label="Saving"
            icon={<span aria-hidden>B</span>}
            pending
          />
        ) : null,
    },
  ],
})

let setRefreshing: (value: boolean) => void = () => {}

const BusyGrid = () => {
  const [refreshing, set] = useState(false)
  setRefreshing = set
  const table = useCreateTable({
    columns: [{ id: 'name', accessorKey: 'name', header: 'Name' }] as never,
    data: DATA,
    getRowId: (row: (typeof DATA)[number]) => row.id,
    loading: refreshing ? 'refresh' : false,
    refreshOptions: { delayMs: 0 },
    plugins: [busyButton()] as never,
  })
  return (
    <div style={{ width: 640, height: 420 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const busy = () =>
  document.querySelector<HTMLElement>(
    '.data-grid__body-row[data-row-id="r1"] [aria-label="Saving"]',
  )
const body = () => document.querySelector<HTMLElement>('.data-grid__body')!
const refreshing = () =>
  document.querySelector('[data-tsr-grid]')!.hasAttribute('data-refreshing')

/** Прозрачность кнопки внутри тела: само приглушение тела (ADR 0094) не в счёт. */
const opacityInBody = (node: HTMLElement) => {
  let value = 1
  for (let el: HTMLElement | null = node; el && el !== body();) {
    value *= parseFloat(getComputedStyle(el).opacity)
    el = el.parentElement
  }
  return value
}

/** Состояние всех анимаций дуги — одно на всех или 'mixed'. */
const playState = (button: HTMLElement) => {
  const states = new Set(
    getComputedStyle(pendingArcOf(button)!)
      .animationPlayState.split(',')
      .map(state => state.trim()),
  )
  return states.size === 1 ? [...states][0] : 'mixed'
}

describe('Дуга при обновлении данных', () => {
  test('IR27: приглушение тела при обновлении данных не гасит дугу — занятая кнопка видна без наведения, дуга в ожидании и идёт', async () => {
    await render(<BusyGrid />)
    await waitForGrid()
    await userEvent.hover(document.body, { position: { x: 1, y: 1 } })
    await expect.poll(() => busy()).not.toBeNull()
    await expect.poll(() => playState(busy()!)).toBe('running')

    setRefreshing(true)
    await expect.poll(refreshing).toBe(true)
    await expect.poll(() => getComputedStyle(body()).opacity).toBe('0.6')

    const button = busy()!
    expect(button.getAttribute('aria-busy')).toBe('true')
    expect(pendingArcOf(button)?.dataset.phase).toBe('pending')
    expect(playState(button)).toBe('running')
    expect(opacityInBody(button)).toBe(1)
    expect(getComputedStyle(pendingArcOf(button)!).visibility).toBe('visible')

    setRefreshing(false)
    await expect.poll(refreshing).toBe(false)
    expect(pendingArcOf(busy()!)?.dataset.phase).toBe('pending')
  })
})
