import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import type { Draft } from '../../../core/drafts/drafts'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { columnFiltering, unsavedChanges } from '../../../plugins'
import { humanClick } from '../helpers'
import { tableLabels } from '../labels'
import { waitForGrid } from './core-helpers'

// Пульт черновиков (ADR 0178, §8; DR11): кнопка тулбара со счётчиком, поповер черновиков,
// переход к цели, применение, отбрасывание, «Применить всё» и «Отменить всё».

const COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name', size: 240 },
  { id: 'city', accessorKey: 'city', header: 'City', size: 240 },
]
const DATA = Array.from({ length: 20 }, (_, i) => ({
  id: String(i),
  name: `Name ${i}`,
  city: i % 2 ? 'Rome' : 'Paris',
}))

interface Api {
  getDrafts: () => readonly Draft[]
  setDraft: (draft: Draft) => void
}

let api: Api
const requests: unknown[] = []

const Grid = () => {
  const table = useCreateTable({
    columns: COLUMNS as never,
    data: DATA,
    getRowId: (row: (typeof DATA)[number]) => row.id,
    dataMode: { filtering: 'server' },
    plugins: [
      columnFiltering({
        onFilterChange: (filters: unknown) => {
          requests.push(filters)
          return Promise.resolve()
        },
      }),
      unsavedChanges(),
    ] as never,
  })
  api = table as unknown as Api
  return (
    <div style={{ width: 760, height: 480 }}>
      <DataGrid table={table as never} height={440} />
    </div>
  )
}

const draftOn = (column: string, value: string): Draft => ({
  kind: 'columnFilter',
  target: { column },
  value: { operator: 'contains', value },
})

const button = () =>
  document.querySelector<HTMLElement>('[data-testid="unsaved-changes-button"]')
const popover = () =>
  document.querySelector<HTMLElement>('[data-testid="unsaved-changes"]')
const entries = () => [
  ...(popover()?.querySelectorAll<HTMLElement>('[data-draft-kind]') ?? []),
]
const entryOf = (text: string) =>
  entries().find(entry => entry.textContent?.includes(text))!
const actionOf = (entry: HTMLElement, action: string) =>
  entry.querySelector<HTMLElement>(`button[data-action="${action}"]`)!
const footer = (action: string) =>
  popover()!.querySelector<HTMLElement>(`button[data-action="${action}"]`)!
const count = () => {
  const bubble = button()!.querySelector('[data-active-indicator]')
  return bubble?.getAttribute('data-shown') === 'true'
    ? bubble.textContent
    : '0'
}
const filterActive = (column: string) =>
  !!document.querySelector(
    `.data-grid__head-cell[data-column-id="${column}"] .column-filter__button[data-active]`,
  )
const columnFlashed = (column: string) =>
  !!document.querySelector(
    `.data-grid__head-cell[data-column-id="${column}"][data-column-flash]`,
  )

const openPanel = async () => {
  if (popover()) return
  await humanClick(button()!)
  await expect.poll(popover).not.toBeNull()
}

const mount = async () => {
  requests.length = 0
  const screen = await render(<Grid />)
  await waitForGrid()
  await expect.poll(button).not.toBeNull()
  return screen
}

describe('Пульт черновиков (ADR 0178)', () => {
  test('DR11: плагин unsavedChanges() — кнопка тулбара со счётчиком; поповер — список с переходом к цели нажатием на запись, «Применить», «Отбросить» у записи и «Применить всё», «Отменить всё» внизу; переход и применение закрывают поповер', async () => {
    const screen = await mount()
    try {
      // Без черновиков: без счётчика, пустой пульт — компактная заглушка.
      expect(count()).toBe('0')
      expect(button()!.getAttribute('aria-label')).toBe(
        tableLabels.unsavedChanges,
      )
      await openPanel()
      expect(
        popover()!.querySelector('[data-testid="unsaved-changes-empty"]')
          ?.textContent,
      ).toContain(tableLabels.unsavedChangesEmpty)
      await userEvent.keyboard('{Escape}')
      await expect.poll(popover).toBeNull()

      api.setDraft(draftOn('name', 'Name 1'))
      api.setDraft(draftOn('city', 'Rome'))
      await expect.poll(count).toBe('2')
      expect(button()!.getAttribute('aria-label')).toBe(
        tableLabels.unsavedChangesButton(2),
      )

      // Записи — в разделе фильтров: текст записи — кнопка перехода, колонка и условие, две кнопки с подписями из словаря.
      await openPanel()
      expect(entries()).toHaveLength(2)
      expect(popover()!.textContent).toContain(tableLabels.filters)
      const name = entryOf('Name 1')
      expect(actionOf(name, 'show').textContent).toContain('Name')
      expect(actionOf(name, 'show').textContent).toContain('Name 1')
      for (const [action, label] of [
        ['apply', tableLabels.draftApply],
        ['discard', tableLabels.draftDiscard],
      ] as const) {
        expect(actionOf(name, action).getAttribute('aria-label')).toBe(label)
      }

      // Переход к цели закрывает пульт и вспыхивает колонку.
      await humanClick(actionOf(name, 'show'))
      await expect.poll(popover).toBeNull()
      await expect.poll(() => columnFlashed('name')).toBe(true)

      // «Отбросить» снимает черновик, пульт остаётся открытым.
      await openPanel()
      await humanClick(actionOf(entryOf('Rome'), 'discard'))
      await expect.poll(() => entries().length).toBe(1)
      expect(popover()).not.toBeNull()
      expect(api.getDrafts()).toHaveLength(1)

      // «Применить» закрывает пульт; условие уходит серверу и действует.
      await humanClick(actionOf(entryOf('Name 1'), 'apply'))
      await expect.poll(popover).toBeNull()
      await expect.poll(() => filterActive('name')).toBe(true)
      expect(requests).toHaveLength(1)
      await expect.poll(count).toBe('0')

      // «Отменить всё» снимает все, «Применить всё» применяет все.
      api.setDraft(draftOn('city', 'Paris'))
      api.setDraft(draftOn('name', 'Name 2'))
      await openPanel()
      await humanClick(footer('discard-all'))
      await expect.poll(() => api.getDrafts().length).toBe(0)
      expect(popover()).not.toBeNull()
      await userEvent.keyboard('{Escape}')
      await expect.poll(popover).toBeNull()

      api.setDraft(draftOn('city', 'Paris'))
      await openPanel()
      await humanClick(footer('apply-all'))
      await expect.poll(popover).toBeNull()
      await expect.poll(() => filterActive('city')).toBe(true)
      expect(api.getDrafts()).toHaveLength(0)
    } finally {
      await screen.unmount()
    }
  })
})
