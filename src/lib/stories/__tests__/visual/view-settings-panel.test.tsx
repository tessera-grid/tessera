import axe from 'axe-core'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { definePlugin } from '../../../core/definePlugin'
import { useCreateTable } from '../../../core/useCreateTable'
import type { ViewSettingsSection } from '../../../core/viewSettings'
import { DataGrid } from '../../../grid/DataGrid'
import { columnVisibility } from '../../../plugins'
import { tableLabels } from '../labels'
import { preloadable } from '../../../util/preloadable'
import { AXE_OPTIONS, inBothThemes } from './a11y-helpers'
import { waitForGrid } from './core-helpers'
import { openSettingsSection } from '../viewSettings'

// Отказ загрузки своей панели раздела «Настроек вида» (ADR 0215, VW17).

/** axe с проверкой контраста: в общих опциях она выключена. */
const AXE_CONTRAST = {
  ...AXE_OPTIONS,
  rules: { ...AXE_OPTIONS.rules, 'color-contrast': { enabled: true } },
}

const DATA = Array.from({ length: 5 }, (_, i) => ({
  id: String(i),
  name: `Name ${i}`,
}))
const COLUMNS = [{ id: 'name', accessorKey: 'name', header: 'Name' }]
const SECTION = 'ownPanel'
const LABEL = 'Own panel'

/** Модуль панели: первая загрузка отказывает, повтор приходит. */
const failingOnce = () => {
  let tries = 0
  return preloadable(() => {
    tries += 1
    return tries === 1
      ? Promise.reject(new Error('chunk failed'))
      : Promise.resolve(() => <p data-testid="own-panel-content">Loaded</p>)
  })
}

const sectionWith = (panel: ViewSettingsSection['panel']) =>
  definePlugin<{ enabled?: boolean }>()({
    id: SECTION,
    diagnose: () => undefined,
    viewSettingsSections: [
      {
        id: SECTION,
        plugin: SECTION,
        icon: 'columns',
        slices: [],
        label: () => LABEL,
        active: () => false,
        value: () => '',
        panel,
      },
    ],
  })

const Grid = ({ plugin }: { plugin: unknown }) => {
  const table = useCreateTable({
    columns: COLUMNS as never,
    data: DATA,
    getRowId: (row: (typeof DATA)[number]) => row.id,
    plugins: [columnVisibility(), plugin] as never,
  })
  return (
    <div style={{ width: 600, height: 360 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const errorBlock = () =>
  document.querySelector<HTMLElement>(
    '[data-view-settings-open] [role="alert"]',
  )
const retry = () =>
  document.querySelector<HTMLElement>(
    '[data-testid="view-settings-panel-retry"]',
  )

describe('Панель раздела «Настроек вида» (ADR 0215)', () => {
  test('VW17: модуль своей панели раздела не загрузился — на месте строк-скелетов блок ошибки с причиной и повтором; повтор грузит модуль заново, и панель приходит; axe с color-contrast в обеих темах', async () => {
    const plugin = sectionWith(failingOnce())()
    await render(<Grid plugin={plugin} />)
    await waitForGrid()
    await openSettingsSection(SECTION)

    await expect.poll(errorBlock).not.toBeNull()
    expect(errorBlock()!.textContent).toContain(tableLabels.loadFailed(LABEL))
    expect(
      document.querySelector('[data-view-settings-open] [data-skeleton]'),
    ).toBeNull()
    expect(retry()!.textContent).toContain(tableLabels.loadMoreRetry)
    await inBothThemes(async () => {
      const result = await axe.run(errorBlock()!, AXE_CONTRAST)
      expect(result.violations.map(v => v.id)).toEqual([])
    })

    await userEvent.click(retry()!)
    await expect
      .poll(() => document.querySelector('[data-testid="own-panel-content"]'))
      .not.toBeNull()
    expect(errorBlock()).toBeNull()
  })
})
