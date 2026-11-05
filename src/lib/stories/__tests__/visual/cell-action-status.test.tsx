import axe from 'axe-core'
import { useMemo, useState } from 'react'
import { commands, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { useCellPending } from '../../../core/headerActions/cellActions'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import type { CellContext } from '../../../types'
import { Checkbox } from '../../../ui/Checkbox/Checkbox'
import { Switch } from '../../../ui/Switch'
import { humanClick, pendingArcOf } from '../helpers'
import { inBothThemes } from './a11y-helpers'
import { waitForGrid } from './core-helpers'

// Ожидание действия на ячейке (ADR 0176; AC2, AC5) настоящими событиями: свой флажок и
// переключатель ждут сами — дугой, текст без контрола — волной на ячейке.

const fc = commands as unknown as {
  forcedColors: (active: boolean) => Promise<void>
}

/** Системный цвет палитры, как его отдаёт браузер. */
const sys = (name: string) => {
  const probe = document.createElement('span')
  probe.style.color = name
  document.body.append(probe)
  const value = getComputedStyle(probe).color
  probe.remove()
  return value
}

interface Item {
  id: string
  name: string
  flag: boolean
  on: boolean
  level: number
}

const ROWS: Item[] = [
  { id: 'r1', name: 'Lamp', flag: false, on: false, level: 1 },
  { id: 'r2', name: 'Chair', flag: true, on: true, level: 2 },
]

/** «Сервер» теста: каждое сохранение ждёт команды. */
const server = () => {
  const waiting: { resolve: () => void; reject: (error: Error) => void }[] = []
  return {
    save: () =>
      new Promise<void>((resolve, reject) => waiting.push({ resolve, reject })),
    answer: () => waiting.splice(0).forEach(entry => entry.resolve()),
  }
}

type Context = CellContext<any, Item, unknown>

const useSave = <T,>(
  { table, row, column }: Context,
  save: () => Promise<void>,
  indicator: 'cell' | 'control',
) => {
  const [draft, setDraft] = useState<{ value: T }>()
  const pending = useCellPending(table, row.id, column.id) !== undefined
  const commit = (value: T) => {
    setDraft({ value })
    table
      .trackCellAction({ cell: [row.id, column.id] }, save(), { indicator })
      .finally(() => setDraft(undefined))
  }
  return {
    value: draft ? draft.value : (row.getValue(column.id) as T),
    pending,
    commit,
  }
}

const FlagCell = ({
  context,
  save,
}: {
  context: Context
  save: () => Promise<void>
}) => {
  const { value, pending, commit } = useSave<boolean>(context, save, 'control')
  return (
    <Checkbox
      className="row-select-checkbox"
      checked={value}
      pending={pending}
      label={`${context.row.original.name} flag`}
      onCheckedChange={checked => commit(checked)}
    />
  )
}

const OnCell = ({
  context,
  save,
}: {
  context: Context
  save: () => Promise<void>
}) => {
  const { value, pending, commit } = useSave<boolean>(context, save, 'control')
  return (
    <Switch
      checked={value}
      pending={pending}
      aria-label={`${context.row.original.name} on`}
      onCheckedChange={commit}
    />
  )
}

const LevelCell = ({
  context,
  save,
}: {
  context: Context
  save: () => Promise<void>
}) => {
  const { value, pending, commit } = useSave<number>(context, save, 'cell')
  return (
    <span
      data-testid="level"
      style={{ flex: 1, alignSelf: 'stretch', alignContent: 'center' }}
      onDoubleClick={() => {
        if (!pending) commit(value + 1)
      }}
    >
      {value}
    </span>
  )
}

const Grid = ({ save }: { save: () => Promise<void> }) => {
  const columns = useMemo(
    () => [
      { id: 'name', accessorKey: 'name', header: 'Name' },
      {
        id: 'flag',
        accessorKey: 'flag',
        header: 'Flag',
        cell: (context: Context) => <FlagCell context={context} save={save} />,
      },
      {
        id: 'on',
        accessorKey: 'on',
        header: 'On',
        cell: (context: Context) => <OnCell context={context} save={save} />,
      },
      {
        id: 'level',
        accessorKey: 'level',
        header: 'Level',
        cell: (context: Context) => <LevelCell context={context} save={save} />,
      },
    ],
    [save],
  )
  const table = useCreateTable({
    columns: columns as never,
    data: ROWS,
    plugins: [],
  })
  return (
    <div style={{ height: 300 }}>
      <DataGrid table={table} />
    </div>
  )
}

const cellOf = (column: string, row = 'r1') =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${row}"] .data-grid__body-cell[data-column-id="${column}"]`,
  )!
const checkbox = (row = 'r1') =>
  cellOf('flag', row).querySelector<HTMLElement>('[role="checkbox"]')!
const switchOf = (row = 'r1') =>
  cellOf('on', row).querySelector<HTMLElement>('[role="switch"]')!
const waves = () =>
  document
    .getAnimations()
    .filter(
      animation =>
        (animation.effect as KeyframeEffect | null)?.target instanceof
          HTMLElement &&
        ((animation.effect as KeyframeEffect).target as HTMLElement).closest(
          '[data-pending-wave]',
        ),
    )

const renderGrid = async () => {
  const backend = server()
  await render(<Grid save={backend.save} />)
  await waitForGrid()
  return backend
}

describe('ожидание действия на ячейке (ADR 0176)', () => {
  test("AC2: indicator 'cell' (по умолчанию) — подложка и блик на ячейках цели, как у действия из контекстного меню; indicator 'control' — без подложки и блика", async () => {
    const backend = await renderGrid()
    const underlay = (cell: HTMLElement) =>
      getComputedStyle(cell, '::after').backgroundColor

    const restBg = underlay(cellOf('level'))
    await userEvent.dblClick(
      cellOf('level').querySelector<HTMLElement>('[data-testid="level"]')!,
    )
    await expect
      .poll(() => cellOf('level').getAttribute('data-pending-wave'))
      .toBe('true')
    expect(cellOf('level')).toHaveAttribute('aria-busy', 'true')
    expect(underlay(cellOf('level'))).not.toBe(restBg)
    await expect.poll(() => waves().length).toBeGreaterThan(0)
    expect(cellOf('level', 'r2').hasAttribute('data-pending-wave')).toBe(false)

    // Контрол ждёт сам: ячейка занята, подложки и блика нет.
    await humanClick(checkbox())
    await expect
      .poll(() => cellOf('flag').getAttribute('aria-busy'))
      .toBe('true')
    expect(cellOf('flag').hasAttribute('data-pending-wave')).toBe(false)
    expect(underlay(cellOf('flag'))).toBe(underlay(cellOf('flag', 'r2')))

    backend.answer()
    await expect
      .poll(() => cellOf('level').hasAttribute('data-pending-wave'))
      .toBe(false)
    expect(cellOf('flag').hasAttribute('aria-busy')).toBe(false)
    expect(cellOf('level').textContent).toBe('1')
  })

  test('AC5: флажок и переключатель кита — проп pending: дуга вокруг контрола по его форме, aria-busy, нажатия игнорируются, контрол приглушён, как выключенный, а дуга — нет; контраст и forced-colors как у кнопок', async () => {
    const backend = await renderGrid()

    /** Дуга контрола — соседний слой в его обёртке (ADR 0176). */
    const arcOf = (control: () => HTMLElement) =>
      pendingArcOf(control().parentElement!)
    for (const control of [checkbox, switchOf]) {
      await humanClick(control())
      await expect.poll(() => control().getAttribute('aria-busy')).toBe('true')
      expect(arcOf(control)).not.toBeNull()
      // Приглушён, как выключенный; дуга — нет.
      await expect
        .poll(() => getComputedStyle(control()).opacity)
        .toBe(
          getComputedStyle(control())
            .getPropertyValue('--tsr-comp-disabled-opacity')
            .trim() || '0.5',
        )
      expect(getComputedStyle(arcOf(control)!).opacity).toBe('1')
      expect(control()).toHaveAttribute('aria-checked', 'true')
      // Нажатие во время ожидания не меняет значение.
      await humanClick(control())
      expect(control()).toHaveAttribute('aria-checked', 'true')
    }
    // Дуга вокруг контрола: снаружи его бокса, по центру.
    for (const control of [checkbox, switchOf]) {
      const box = control().getBoundingClientRect()
      const rect = arcOf(control)!.getBoundingClientRect()
      expect(rect.left).toBeLessThan(box.left)
      expect(rect.right).toBeGreaterThan(box.right)
      expect(rect.top).toBeLessThan(box.top)
      expect(rect.bottom).toBeGreaterThan(box.bottom)
      expect(
        Math.abs(rect.left + rect.width / 2 - (box.left + box.width / 2)),
      ).toBeLessThan(1)
      expect(
        Math.abs(rect.top + rect.height / 2 - (box.top + box.height / 2)),
      ).toBeLessThan(1)
    }

    await inBothThemes(async () => {
      const { violations } = await axe.run(cellOf('flag').closest('[role]')!, {
        rules: { region: { enabled: false } },
      })
      expect(violations.map(item => item.id)).toEqual([])
    })

    // Высокая контрастность: дуга — системный цвет, без бледной дорожки.
    await fc.forcedColors(true)
    try {
      for (const control of [checkbox, switchOf]) {
        const arcEl = arcOf(control)!
        const head = arcEl.querySelector<SVGRectElement>(':scope > g > rect')!
        expect(getComputedStyle(head).stroke).toBe(sys('Highlight'))
        expect(
          getComputedStyle(arcEl.querySelector(':scope > rect')!).stroke,
        ).toBe('rgba(0, 0, 0, 0)')
      }
    } finally {
      await fc.forcedColors(false)
    }

    backend.answer()
    await expect.poll(() => pendingArcOf(checkbox())).toBeNull()
    expect(pendingArcOf(switchOf())).toBeNull()
    expect(checkbox().hasAttribute('aria-busy')).toBe(false)
  })
})
