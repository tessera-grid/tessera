import { useState } from 'react'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import type { Draft } from '../../../core/drafts/drafts'
import type { LabelDictionary } from '../../../core/localization'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { columnFiltering, failureLog, unsavedChanges } from '../../../plugins'
import { RU_LABELS } from '../../__mocks__/localization.ru'
import { humanClick } from '../helpers'
import { waitForGrid } from './core-helpers'

// Подпись действия — при показе (ADR 0182, §2; AN2): смена языка таблицы переводит записи
// журнала отказов и пульта черновиков на месте, без пересоздания таблицы.

const COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name', size: 240 },
  { id: 'city', accessorKey: 'city', header: 'City', size: 240 },
]
const DATA = Array.from({ length: 10 }, (_, i) => ({
  id: String(i),
  name: `Name ${i}`,
  city: i % 2 ? 'Rome' : 'Paris',
}))

interface Api {
  reportFailure: (report: object) => string
  setDraft: (draft: Draft) => void
}
let api: Api
let setLanguage: (ru: boolean) => void = () => {}

const Grid = () => {
  const [ru, setRu] = useState(false)
  setLanguage = setRu
  const table = useCreateTable({
    columns: COLUMNS as never,
    data: DATA,
    getRowId: (row: (typeof DATA)[number]) => row.id,
    dataMode: { filtering: 'server' },
    locale: ru ? 'ru-RU' : undefined,
    plugins: [
      columnFiltering({ onFilterChange: () => Promise.resolve() }),
      unsavedChanges(),
      failureLog(),
    ] as never,
  })
  api = table as unknown as Api
  return (
    <div style={{ width: 760, height: 480 }}>
      <DataGrid
        table={table as never}
        height={440}
        localization={ru ? (RU_LABELS as LabelDictionary) : undefined}
      />
    </div>
  )
}

const button = (id: string) =>
  document.querySelector<HTMLElement>(`[data-testid="${id}"]`)
const popoverText = (id: string) =>
  document.querySelector<HTMLElement>(`[data-testid="${id}"]`)?.textContent ??
  ''
const open = async (trigger: string, popover: string) => {
  await expect.poll(() => button(trigger)).not.toBeNull()
  if (!document.querySelector(`[data-testid="${popover}"]`))
    await humanClick(button(trigger)!)
  await expect.poll(() => popoverText(popover)).not.toBe('')
}

describe('Справочник действий (ADR 0182)', () => {
  test('AN2: подпись собирается при показе: смена localization или locale на лету переводит записи журнала и пульта без пересоздания таблицы', async () => {
    const screen = await render(<Grid />)
    try {
      await waitForGrid()
      api.reportFailure({
        action: { plugin: 'core', action: 'search' },
        target: { table: true },
        reason: 'Server down',
      })
      api.setDraft({
        kind: 'columnFilter',
        target: { column: 'name' },
        value: { operator: 'contains', value: 'Bob' },
      })

      await open('failure-log-button', 'failure-log')
      expect(popoverText('failure-log')).toContain('Search')
      await open('unsaved-changes-button', 'unsaved-changes')
      expect(popoverText('unsaved-changes')).toContain('Filters')

      // Язык меняется на лету: те же записи — на русском, таблица та же.
      setLanguage(true)
      await expect
        .poll(() => popoverText('unsaved-changes'))
        .toContain(RU_LABELS['columnFiltering.filters'])
      await open('failure-log-button', 'failure-log')
      await expect
        .poll(() => popoverText('failure-log'))
        .toContain(RU_LABELS.actionSearch)
      expect(popoverText('failure-log')).not.toContain('Search')
    } finally {
      await screen.unmount()
    }
  })
})
