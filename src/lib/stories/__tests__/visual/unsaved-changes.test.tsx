import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import type { Draft } from '../../../core/drafts/drafts'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { cellEditing, columnFiltering, unsavedChanges } from '../../../plugins'
import { humanClick } from '../helpers'
import { tableLabels } from '../labels'
import { waitForGrid } from './core-helpers'
import { unsavedChangesLabels } from '../../../plugins/unsavedChanges/labels'
import { columnFilteringLabels } from '../../../plugins/columnFiltering/labels'

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
        unsavedChangesLabels(tableLabels).unsavedChanges,
      )
      await openPanel()
      expect(
        popover()!.querySelector('[data-testid="unsaved-changes-empty"]')
          ?.textContent,
      ).toContain(unsavedChangesLabels(tableLabels).unsavedChangesEmpty)
      await userEvent.keyboard('{Escape}')
      await expect.poll(popover).toBeNull()

      api.setDraft(draftOn('name', 'Name 1'))
      api.setDraft(draftOn('city', 'Rome'))
      await expect.poll(count).toBe('2')
      expect(button()!.getAttribute('aria-label')).toBe(
        unsavedChangesLabels(tableLabels).unsavedChangesButton(2),
      )

      // Записи — в разделе фильтров: текст записи — кнопка перехода, колонка и условие, две кнопки с подписями из словаря.
      await openPanel()
      expect(entries()).toHaveLength(2)
      expect(popover()!.textContent).toContain(
        columnFilteringLabels(tableLabels).filters,
      )
      const name = entryOf('Name 1')
      expect(actionOf(name, 'show').textContent).toContain('Name')
      expect(actionOf(name, 'show').textContent).toContain('Name 1')
      for (const [action, label] of [
        ['apply', unsavedChangesLabels(tableLabels).draftApply],
        ['discard', unsavedChangesLabels(tableLabels).draftDiscard],
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

// Пульт с тысячей черновиков (ADR 0178, DR56): список виртуализирован.
const MANY_ROWS = Array.from({ length: 1000 }, (_, i) => ({
  id: String(i),
  name: `Name ${i}`,
  city: 'Paris',
}))
const MANY_DRAFTS: Draft[] = [
  ...MANY_ROWS.map((row): Draft => ({
    kind: 'cellValue',
    target: { cell: [row.id, 'name'] },
    value: { value: `New ${row.id}`, text: `New ${row.id}` },
  })),
  draftOn('city', 'Rome'),
]
const ManyGrid = () => {
  const table = useCreateTable({
    columns: COLUMNS as never,
    data: MANY_ROWS,
    getRowId: (row: (typeof MANY_ROWS)[number]) => row.id,
    dataMode: { filtering: 'server' },
    initialDrafts: MANY_DRAFTS,
    plugins: [
      cellEditing({ saveMode: 'manual', onCommitEdits: () => {} } as never),
      columnFiltering({ onFilterChange: () => Promise.resolve() }),
      unsavedChanges(),
    ] as never,
  })
  return (
    <div style={{ width: 760, height: 480 }}>
      <DataGrid table={table as never} height={440} />
    </div>
  )
}

describe('Пульт с тысячей черновиков (ADR 0178)', () => {
  test('DR56: пульт рисует записи окна прокрутки и несколько рядом — при 1000 черновиках в DOM не больше 30 записей; прокрутка до конца показывает последнюю запись и раздел фильтров с заголовком; список изменений данных назван именем пульта, список раздела — заголовком раздела', async () => {
    const screen = await render(<ManyGrid />)
    try {
      await waitForGrid()
      await expect.poll(button).not.toBeNull()
      await openPanel()
      await expect.poll(() => entries().length).toBeGreaterThan(0)
      expect(entries().length).toBeLessThanOrEqual(30)
      // Первая запись — первая правка; список данных назван именем пульта.
      const own = unsavedChangesLabels(tableLabels)
      const dataList = entries()[0]!.closest<HTMLElement>('[role="list"]')!
      expect(entries()[0]!.textContent).toContain('New 0')
      expect(dataList.getAttribute('aria-label')).toBe(own.unsavedChanges)

      // Прокрутка до конца: последняя правка и раздел фильтров с заголовком.
      const scroller = popover()!.querySelector<HTMLElement>(
        '[data-popup-scroller]',
      )!
      for (let i = 0; i < 5; i++) {
        scroller.scrollTop = scroller.scrollHeight
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => requestAnimationFrame(resolve))
      }
      await expect
        .poll(() =>
          entries().some(entry => entry.textContent?.includes('New 999')),
        )
        .toBe(true)
      expect(entries().length).toBeLessThanOrEqual(30)
      const filter = entries().find(
        entry => entry.dataset.draftKind === 'columnFilter',
      )!
      expect(filter).toBeTruthy()
      const filterList = filter.closest<HTMLElement>('[role="list"]')!
      const title = document.getElementById(
        filterList.getAttribute('aria-labelledby')!,
      )!
      expect(title.textContent).toBe(columnFilteringLabels(tableLabels).filters)
      // Заголовок — над записью раздела, запись видна в окне прокрутки.
      expect(title.getBoundingClientRect().bottom).toBeLessThanOrEqual(
        filter.getBoundingClientRect().top + 1,
      )
      const box = scroller.getBoundingClientRect()
      expect(filter.getBoundingClientRect().bottom).toBeLessThanOrEqual(
        box.bottom + 1,
      )
    } finally {
      await screen.unmount()
    }
  })
})
