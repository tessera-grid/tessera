import { render } from 'vitest-browser-react'
import { expect } from 'vitest'
import { userEvent } from 'vitest/browser'

import type { ColorMode } from '../../../ui/theme'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { columnPinning, columnSorting, rowGrouping } from '../../../plugins'
import { humanClick } from '../helpers'

// Настоящие кнопки шапки грида (сортировка, закрепление, группировка) — для тестов
// темы рядом с публичными примитивами `/ui`: расхождение между ними видно (ADR 0062).

const DATA = Array.from({ length: 6 }, (_, i) => ({
  id: String(i),
  name: `Name ${i % 3}`,
  age: 20 + i,
}))

const HeaderButtonsGrid = ({ colorMode }: { colorMode: ColorMode }) => {
  const table = useCreateTable({
    columns: [
      { id: 'name', accessorKey: 'name', header: 'Name' },
      {
        id: 'age',
        accessorKey: 'age',
        header: 'Age',
        pinSides: 'start',
      },
    ] as never,
    data: DATA,
    getRowId: (row: (typeof DATA)[number]) => row.id,
    plugins: [columnSorting(), columnPinning(), rowGrouping()] as never,
  })
  return (
    <div style={{ width: 600, height: 300 }}>
      <DataGrid table={table as never} colorMode={colorMode} />
    </div>
  )
}

export type HeaderButtonKind = 'sort' | 'pin' | 'group'

const BUTTON: Record<HeaderButtonKind, { column: string; cls: string }> = {
  sort: { column: 'name', cls: 'column-sort__button' },
  pin: { column: 'age', cls: 'column-pin__button' },
  group: { column: 'name', cls: 'column-group__button' },
}

/** Грид с кнопками шапки; `button(kind)` — кнопка, `activate(kind)` — включить её мышью. */
export const renderHeaderButtons = async (colorMode: ColorMode = 'light') => {
  const screen = await render(<HeaderButtonsGrid colorMode={colorMode} />)
  const head = (column: string) =>
    screen.container.querySelector<HTMLElement>(
      `.data-grid__head-cell[data-column-id="${column}"]`,
    )
  await expect.poll(() => head('age')).not.toBeNull()
  const button = (kind: HeaderButtonKind) =>
    head(BUTTON[kind].column)!.querySelector<HTMLElement>(
      `.${BUTTON[kind].cls}`,
    )!
  const activate = async (kind: HeaderButtonKind) => {
    await userEvent.hover(head(BUTTON[kind].column)!)
    await humanClick(button(kind))
    await expect
      .poll(() => button(kind).parentElement!.dataset.buttonActive)
      .toBe('true')
  }
  return { screen, button, activate }
}
