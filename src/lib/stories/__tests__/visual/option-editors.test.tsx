import axe from 'axe-core'
import { useMemo } from 'react'
import { commands, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test, vi } from 'vitest'

import type { ColumnOption, LoadOptions } from '../../../core/columnOptions'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { cellEditing, type CellEditCommit } from '../../../plugins'
import { humanClick, revealCellButtons } from '../helpers'
import { tableLabels } from '../labels'
import { inBothThemes } from './a11y-helpers'
import { waitForGrid } from './core-helpers'

// Редакторы вариантов (ADR 0175, ED8–ED10) настоящими событиями: поле с поиском у `select` и
// `object`, справочник с ожиданием и отказом, список с флажками у `multiSelect`, 1000 вариантов.

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

/** Конец анимаций появления поповера. */
const settle = () =>
  Promise.all(document.getAnimations().map(animation => animation.finished))

const STATUS = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
]
const TAGS = [
  { value: 'new', label: 'New' },
  { value: 'sale', label: 'Sale' },
  { value: 'eco', label: 'Eco' },
]
const MANY = Array.from({ length: 1000 }, (_, i) => ({
  value: `v${i}`,
  label: `Value ${String(i).padStart(4, '0')}`,
}))
const ANN = { id: 'm1', name: 'Ann' }
const BOB = { id: 'm2', name: 'Bob' }
const CY = { id: 'm3', name: 'Cy' }
/** Есть только в справочнике, не в данных. */
const DANA = { id: 'm4', name: 'Dana' }

const ROWS = [
  {
    id: 'r1',
    status: 'draft',
    manager: ANN,
    owner: ANN,
    tags: ['new'],
    code: 'v0',
    price: 12.5,
  },
  {
    id: 'r2',
    status: 'active',
    manager: BOB,
    owner: CY,
    tags: [],
    code: 'v1',
    price: 3,
  },
]

/** Справочник менеджеров: ответ и отказ — по команде теста. */
const directory = () => {
  const pending: {
    resolve: (options: ColumnOption[]) => void
    reject: (error: Error) => void
  }[] = []
  const load: LoadOptions = () =>
    new Promise((resolve, reject) => pending.push({ resolve, reject }))
  return {
    load,
    answer: () =>
      pending.splice(0).forEach(entry =>
        entry.resolve([
          { value: 'm1', label: 'Ann', record: ANN },
          { value: 'm2', label: 'Bob', record: BOB },
          { value: 'm4', label: 'Dana', record: DANA },
        ]),
      ),
    refuse: () =>
      pending.splice(0).forEach(entry => entry.reject(new Error('down'))),
  }
}

const Grid = ({
  onCellEdit,
  onEditCancel,
  load,
  localization,
}: {
  onCellEdit: (commit: CellEditCommit) => void
  onEditCancel: () => void
  load: LoadOptions
  localization?: Record<string, string>
}) => {
  const columns = useMemo(
    () => [
      {
        id: 'status',
        accessorKey: 'status',
        header: 'Status',
        dataType: 'select',
        options: STATUS,
      },
      {
        id: 'manager',
        accessorKey: 'manager',
        header: 'Manager',
        dataType: 'object',
        loadOptions: load,
      },
      {
        id: 'owner',
        accessorKey: 'owner',
        header: 'Owner',
        dataType: 'object',
        // Варианты без записи: запись берётся из данных по ключу.
        options: [
          { value: 'm1', label: 'Ann' },
          { value: 'm3', label: 'Cy' },
        ],
      },
      {
        id: 'tags',
        accessorKey: 'tags',
        header: 'Tags',
        dataType: 'multiSelect',
        options: TAGS,
      },
      {
        id: 'price',
        accessorKey: 'price',
        header: 'Price',
        dataType: 'number',
      },
      {
        id: 'code',
        accessorKey: 'code',
        header: 'Code',
        dataType: 'select',
        options: MANY,
      },
    ],
    [load],
  )
  const table = useCreateTable({
    columns: columns as never,
    data: ROWS,
    enableKeyboardNavigation: true,
    plugins: [cellEditing({ onCellEdit, onEditCancel })],
  })
  return (
    <div style={{ height: 400 }}>
      <DataGrid table={table} localization={localization} />
    </div>
  )
}

const cellOf = (column: string, row = 'r1') =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${row}"] .data-grid__body-cell[data-column-id="${column}"]`,
  )!
const field = () =>
  document.querySelector<HTMLInputElement>('[data-testid="edit-select"]')
const popup = () =>
  document.querySelector<HTMLElement>('[data-testid="edit-options"]')
const itemOf = (value: string) =>
  popup()?.querySelector<HTMLElement>(`[data-value="${value}"]`) ?? null

const openEdit = async (column: string, row = 'r1') => {
  await revealCellButtons(cellOf(column, row))
  await humanClick(
    cellOf(column, row).querySelector<HTMLElement>('.cell__button button')!,
  )
}

const renderGrid = async () => {
  const onCellEdit = vi.fn()
  const onEditCancel = vi.fn()
  const server = directory()
  await render(
    <Grid
      onCellEdit={onCellEdit}
      onEditCancel={onEditCancel}
      load={server.load}
    />,
  )
  await waitForGrid()
  return { onCellEdit, onEditCancel, server }
}

describe('редакторы вариантов (ADR 0175)', () => {
  test('ED8: select и object — поле с поиском сужает варианты набором, выбор стрелками и Enter; варианты из options, справочник из loadOptions с ожиданием, отказом и повтором; object выбирает запись по getKey и подписывает по getLabel; значение очищается отдельным пунктом', async () => {
    const { onCellEdit, onEditCancel, server } = await renderGrid()

    // Набор сужает варианты, Enter выбирает подсвеченный.
    await openEdit('status')
    await expect.poll(field).not.toBeNull()
    expect(document.activeElement).toBe(field())
    await expect.poll(() => itemOf('active')).not.toBeNull()
    await userEvent.type(field()!, 'arch')
    await expect.poll(() => itemOf('active')).toBeNull()
    expect(itemOf('archived')).not.toBeNull()
    await userEvent.keyboard('{Enter}')
    await expect.poll(field).toBeNull()
    expect(onCellEdit).toHaveBeenLastCalledWith(
      expect.objectContaining({ columnId: 'status', value: 'archived' }),
    )

    // Стрелки ходят по вариантам; отдельный пункт очищает значение.
    await openEdit('status', 'r2')
    await expect.poll(() => itemOf('draft')).not.toBeNull()
    await userEvent.keyboard('{ArrowDown}')
    await expect
      .poll(() =>
        popup()
          ?.querySelector('[data-highlighted]')
          ?.getAttribute('data-value'),
      )
      .toBeTruthy()
    const clear = popup()!.querySelector<HTMLElement>('[data-clear]')!
    expect(clear.textContent).toBe(tableLabels.editClear)
    await humanClick(clear)
    await expect.poll(field).toBeNull()
    expect(onCellEdit).toHaveBeenLastCalledWith(
      expect.objectContaining({ columnId: 'status', rowId: 'r2', value: null }),
    )

    // Escape — без сохранения.
    onCellEdit.mockClear()
    await openEdit('status')
    await expect.poll(field).not.toBeNull()
    await userEvent.keyboard('{Escape}')
    await expect.poll(field).toBeNull()
    expect(onCellEdit).not.toHaveBeenCalled()
    expect(onEditCancel).toHaveBeenCalled()

    // Справочник: ожидание, отказ с повтором, ответ; сохраняется запись варианта.
    await openEdit('manager')
    await expect
      .poll(() => popup()?.textContent)
      .toContain(tableLabels.filterLoadingOptions)
    server.refuse()
    await expect
      .poll(() => popup()?.querySelector('[role="alert"]')?.textContent)
      .toContain(tableLabels.filterOptionsError)
    await humanClick(
      popup()!.querySelector<HTMLElement>(
        '[data-testid="edit-options-retry"]',
      )!,
    )
    await expect.poll(() => (server.answer(), itemOf('m4'))).not.toBeNull()
    expect(itemOf('m1')!.textContent).toContain('Ann')
    await humanClick(itemOf('m4')!)
    await expect.poll(field).toBeNull()
    expect(onCellEdit.mock.lastCall![0].value).toBe(DANA)

    // Вариант без записи — запись с тем же ключом из данных.
    await openEdit('owner')
    await expect.poll(() => itemOf('m3')).not.toBeNull()
    await humanClick(itemOf('m3')!)
    await expect.poll(field).toBeNull()
    expect(onCellEdit.mock.lastCall![0].value).toBe(CY)
  })

  test('ED9: multiSelect — поповер со списком флажков и поиском; Enter сохраняет массив, Escape отменяет', async () => {
    const { onCellEdit, onEditCancel } = await renderGrid()
    const multi = () =>
      document.querySelector<HTMLElement>('[data-testid="edit-multiselect"]')
    const box = (value: string) =>
      multi()?.querySelector<HTMLElement>(
        `[data-value="${value}"] [role="checkbox"]`,
      ) ?? null
    const search = () =>
      multi()!.querySelector<HTMLInputElement>(
        '[data-testid="edit-options-search"]',
      )!

    await openEdit('tags')
    await expect.poll(multi).not.toBeNull()
    await expect.poll(() => document.activeElement).toBe(search())
    expect(box('new')).toHaveAttribute('aria-checked', 'true')
    await humanClick(box('sale')!)
    await userEvent.type(search(), 'ec')
    await expect.poll(() => box('sale')).toBeNull()
    await humanClick(box('eco')!)
    await userEvent.keyboard('{Enter}')
    await expect.poll(multi).toBeNull()
    expect(onCellEdit).toHaveBeenLastCalledWith(
      expect.objectContaining({
        columnId: 'tags',
        value: ['new', 'sale', 'eco'],
      }),
    )

    onCellEdit.mockClear()
    await openEdit('tags', 'r2')
    await expect.poll(multi).not.toBeNull()
    await humanClick(box('new')!)
    await userEvent.keyboard('{Escape}')
    await expect.poll(multi).toBeNull()
    expect(onCellEdit).not.toHaveBeenCalled()
    expect(onEditCancel).toHaveBeenCalled()
  })

  test('ED10: список из 1000 вариантов виртуализирован — в DOM только видимые пункты, клавиши проходят весь список', async () => {
    const { onCellEdit } = await renderGrid()
    await openEdit('code')
    await expect.poll(() => itemOf('v1')).not.toBeNull()
    expect(popup()!.querySelectorAll('[role="option"]').length).toBeLessThan(60)
    await userEvent.keyboard('{ArrowUp}')
    await expect.poll(() => itemOf('v999')).not.toBeNull()
    expect(itemOf('v999')).toHaveAttribute('data-highlighted')
    await userEvent.keyboard('{Enter}')
    await expect.poll(field).toBeNull()
    expect(onCellEdit).toHaveBeenLastCalledWith(
      expect.objectContaining({ columnId: 'code', value: 'v999' }),
    )
  })

  test('ED11: подписи редакторов — ключи словаря: ошибка числа, поиск, «нет вариантов», загрузка, отказ загрузки, очистка', async () => {
    const words = {
      editInvalidNumber: 'Только число',
      filterSearchOptions: 'Найти',
      filterNoOptions: 'Пусто',
      filterLoadingOptions: 'Ждём',
      filterOptionsError: 'Сбой',
      filterRetry: 'Ещё раз',
      editClear: 'Стереть',
    }
    const server = directory()
    await render(
      <Grid
        onCellEdit={() => {}}
        onEditCancel={() => {}}
        load={server.load}
        localization={words}
      />,
    )
    await waitForGrid()

    await openEdit('price')
    const price = () => cellOf('price').querySelector('input')
    await expect.poll(price).not.toBeNull()
    await userEvent.clear(price()!)
    await userEvent.type(price()!, 'abc{Enter}')
    await expect
      .poll(() => cellOf('price').querySelector('[role="alert"]')?.textContent)
      .toBe(words.editInvalidNumber)
    await userEvent.keyboard('{Escape}')

    await openEdit('status')
    await expect.poll(field).not.toBeNull()
    expect(field()!.placeholder).toBe('Draft')
    await expect
      .poll(() => popup()?.querySelector('[data-clear]')?.textContent)
      .toBe(words.editClear)
    await userEvent.type(field()!, 'zzz')
    await expect
      .poll(() => popup()?.textContent)
      .toContain(words.filterNoOptions)
    await userEvent.keyboard('{Escape}')

    await openEdit('manager')
    await expect
      .poll(() => popup()?.textContent)
      .toContain(words.filterLoadingOptions)
    expect(field()!.placeholder).toBe(words.filterSearchOptions)
    server.refuse()
    await expect
      .poll(() => popup()?.textContent)
      .toContain(words.filterOptionsError)
    expect(
      popup()!.querySelector('[data-testid="edit-options-retry"]')!.textContent,
    ).toBe(words.filterRetry)
  })

  test('ED12: редакторы проходят axe с color-contrast в обеих темах; роли combobox, listbox, dialog, aria-invalid у ошибки; вид в forced-colors', async () => {
    await renderGrid()
    const axeOn = async (root: Element) => {
      await inBothThemes(async () => {
        const { violations } = await axe.run(root, {
          rules: { region: { enabled: false } },
        })
        expect(violations.map(item => item.id)).toEqual([])
      })
    }

    await openEdit('status')
    await expect.poll(() => itemOf('active')).not.toBeNull()
    expect(field()).toHaveAttribute('role', 'combobox')
    expect(popup()!.querySelector('[role="listbox"]')).not.toBeNull()
    await settle()
    await axeOn(popup()!)
    await axeOn(cellOf('status'))

    // Высокая контрастность: подсвеченный вариант — системная пара Highlight.
    await fc.forcedColors(true)
    try {
      await userEvent.keyboard('{ArrowDown}')
      const highlighted = () =>
        popup()?.querySelector<HTMLElement>('[data-highlighted]') ?? null
      await expect.poll(highlighted).not.toBeNull()
      // Фон пункта меняется переходом — ждём его конца.
      await expect
        .poll(() => getComputedStyle(highlighted()!).backgroundColor)
        .toBe(sys('Highlight'))
      expect(getComputedStyle(highlighted()!).color).toBe(sys('HighlightText'))
    } finally {
      await fc.forcedColors(false)
    }
    await userEvent.keyboard('{Escape}')
    await expect.poll(field).toBeNull()

    await openEdit('tags')
    const multi = () =>
      document.querySelector<HTMLElement>('[data-testid="edit-multiselect"]')
    await expect.poll(multi).not.toBeNull()
    expect(multi()).toHaveAttribute('role', 'dialog')
    await settle()
    await axeOn(multi()!)
    await userEvent.keyboard('{Escape}')

    await openEdit('price')
    const price = () => cellOf('price').querySelector('input')
    await expect.poll(price).not.toBeNull()
    await userEvent.clear(price()!)
    await userEvent.type(price()!, 'abc{Enter}')
    await expect.poll(() => price()?.getAttribute('aria-invalid')).toBe('true')
    await axeOn(cellOf('price'))
  })
})
