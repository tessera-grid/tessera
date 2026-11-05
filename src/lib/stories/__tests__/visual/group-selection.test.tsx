import axe from 'axe-core'
import { render } from 'vitest-browser-react'
import { commands, server as browser, userEvent } from 'vitest/browser'
import { describe, expect, test } from 'vitest'

import '../../../ui/theme/theme.css'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  quickSearchModel,
  rowExpanding,
  rowGrouping,
  rowSelection,
} from '../../../plugins'
import { humanClick } from '../helpers'
import { AXE_OPTIONS } from './a11y-helpers'

// Выбор при клиентской группировке (ADR 0185): CG1–CG3, CG8, CG10. CG4–CG7, CG9, CG11 — модульный
// clientGroupSelection.dom, CG12 — перф в scroll, CG13 — в interaction.

const fc = commands as unknown as {
  forcedColors: (active: boolean) => Promise<void>
}

interface Item {
  id: string
  country: string
  city: string
}

const ITEMS: Item[] = [
  { id: 'a', country: 'US', city: 'NY' },
  { id: 'b', country: 'US', city: 'NY' },
  { id: 'c', country: 'US', city: 'LA' },
  { id: 'd', country: 'DE', city: 'Berlin' },
]
const COLUMNS = [
  { id: 'country', accessorKey: 'country', header: 'Country' },
  { id: 'city', accessorKey: 'city', header: 'City' },
  { id: 'id', accessorKey: 'id', header: 'Id' },
]

let captured: { setGlobalFilter: (value: string) => void }

const Grid = ({
  grouping = ['country'],
  search,
  navigation = false,
  colorMode,
}: {
  grouping?: string[]
  search?: string
  navigation?: boolean
  colorMode?: 'light' | 'dark'
}) => {
  const table = useCreateTable({
    enableKeyboardNavigation: navigation,
    columns: COLUMNS as never,
    data: ITEMS,
    getRowId: (row: Item) => row.id,
    plugins: [
      quickSearchModel({ initialGlobalFilter: search }),
      rowExpanding({ initialExpanded: true }),
      rowGrouping({ initialGrouping: grouping }),
      rowSelection(),
    ] as never,
  })
  captured = table as never
  return (
    <div style={{ width: 640, height: 420 }}>
      <DataGrid table={table as never} colorMode={colorMode} />
    </div>
  )
}

const rowOf = (id: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${id}"]`,
  )
const groupRow = (value: string) =>
  [...document.querySelectorAll<HTMLElement>('.data-grid__body-row')].find(
    row =>
      row.dataset.rowId !== undefined &&
      row.dataset.rowId.endsWith(`:${value}`),
  )
const flagIn = (row: Element | null | undefined) =>
  row?.querySelector<HTMLElement>('.row-select-checkbox') ?? null
const headFlag = () =>
  document.querySelector<HTMLElement>(
    '.data-grid__head-cell .row-select-checkbox',
  )
const checkedOf = (flag: Element | null | undefined) =>
  flag?.getAttribute('aria-checked') ?? null

describe('выбор при клиентской группировке (ADR 0185)', () => {
  test('CG1: при активной группировке флажки у строк данных и групп, в шапке — «выбрать всё»', async () => {
    const screen = await render(<Grid />)
    await expect.poll(() => rowOf('a')).not.toBeNull()
    expect(flagIn(rowOf('a'))).not.toBeNull()
    expect(flagIn(groupRow('US'))).not.toBeNull()
    expect(headFlag()).not.toBeNull()
    await humanClick(flagIn(rowOf('a'))!)
    await expect.poll(() => checkedOf(flagIn(rowOf('a')))).toBe('true')
    await screen.unmount()
  })

  test('CG2: флажок группы выбирает и снимает потомков, прошедших фильтр; скрытые фильтром не меняются', async () => {
    const screen = await render(<Grid search="NY" />)
    await expect.poll(() => rowOf('a')).not.toBeNull()
    expect(rowOf('c')).toBeNull()
    await humanClick(flagIn(groupRow('US'))!)
    await expect.poll(() => checkedOf(flagIn(rowOf('a')))).toBe('true')
    expect(checkedOf(flagIn(rowOf('b')))).toBe('true')
    expect(checkedOf(flagIn(groupRow('US')))).toBe('true')
    await humanClick(flagIn(groupRow('US'))!)
    await expect.poll(() => checkedOf(flagIn(rowOf('a')))).toBe('false')
    await humanClick(flagIn(groupRow('US'))!)
    await expect.poll(() => checkedOf(flagIn(rowOf('a')))).toBe('true')
    // Поиск снят: строка, скрытая при выборе группы, не выбрана.
    captured.setGlobalFilter('')
    await expect.poll(() => rowOf('c')).not.toBeNull()
    expect(checkedOf(flagIn(rowOf('c')))).toBe('false')
    await expect.poll(() => checkedOf(flagIn(groupRow('US')))).toBe('mixed')
    await screen.unmount()
  })

  test('CG3: флажок группы в трёх состояниях по потомкам на всех уровнях', async () => {
    const screen = await render(<Grid grouping={['country', 'city']} />)
    await expect.poll(() => rowOf('a')).not.toBeNull()
    expect(checkedOf(flagIn(groupRow('US')))).toBe('false')
    await humanClick(flagIn(rowOf('a'))!)
    await expect.poll(() => checkedOf(flagIn(groupRow('NY')))).toBe('mixed')
    expect(checkedOf(flagIn(groupRow('US')))).toBe('mixed')
    await humanClick(flagIn(rowOf('b'))!)
    await expect.poll(() => checkedOf(flagIn(groupRow('NY')))).toBe('true')
    expect(checkedOf(flagIn(groupRow('US')))).toBe('mixed')
    await humanClick(flagIn(rowOf('c'))!)
    await expect.poll(() => checkedOf(flagIn(groupRow('US')))).toBe('true')
    await screen.unmount()
  })

  test('CG8: Space на группе делает то же, что флажок; выбранная группа несёт aria-selected и заливку; aria-checked="mixed"', async () => {
    const screen = await render(<Grid navigation />)
    await expect.poll(() => rowOf('a')).not.toBeNull()
    await humanClick(flagIn(rowOf('a'))!)
    await expect.poll(() => checkedOf(flagIn(groupRow('US')))).toBe('mixed')
    expect(groupRow('US')!.getAttribute('aria-selected')).toBe('false')

    await humanClick(
      groupRow('US')!.querySelector<HTMLElement>('[data-column-id="id"]')!,
    )
    await userEvent.keyboard(' ')
    await expect.poll(() => checkedOf(flagIn(groupRow('US')))).toBe('true')
    expect(groupRow('US')!.getAttribute('aria-selected')).toBe('true')
    expect(groupRow('US')!.getAttribute('data-selected')).toBe('true')
    expect(checkedOf(flagIn(rowOf('c')))).toBe('true')
    await screen.unmount()
  })

  test('CG10: axe с color-contrast в обеих темах для всех трёх состояний, флажок группы в forced-colors', async () => {
    const options = {
      ...AXE_OPTIONS,
      rules: { ...AXE_OPTIONS.rules, 'color-contrast': { enabled: true } },
    }
    const root = () => document.querySelector('.data-grid-theme')!
    for (const colorMode of ['light', 'dark'] as const) {
      const screen = await render(<Grid colorMode={colorMode} />)
      await expect.poll(() => rowOf('a')).not.toBeNull()
      // «Не выбрано» у DE, «частично» у US.
      await humanClick(flagIn(rowOf('a'))!)
      await expect.poll(() => checkedOf(flagIn(groupRow('US')))).toBe('mixed')
      expect((await axe.run(root(), options)).violations).toEqual([])
      await humanClick(flagIn(rowOf('d'))!)
      await expect.poll(() => checkedOf(flagIn(groupRow('DE')))).toBe('true')
      expect((await axe.run(root(), options)).violations).toEqual([])
      if (colorMode === 'light' && browser.browser !== 'webkit') {
        await fc.forcedColors(true)
        try {
          expect((await axe.run(root(), options)).violations).toEqual([])
        } finally {
          await fc.forcedColors(false)
        }
      }
      await screen.unmount()
    }
  })
})
