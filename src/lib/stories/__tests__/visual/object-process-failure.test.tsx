import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test } from 'vitest'

import type { Failure } from '../../../core/failures/failuresFeature'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { columnVisibility, dataExport } from '../../../plugins'
import { humanClick, pendingArcOf } from '../helpers'
import { tableLabels } from '../labels'
import {
  MODULE,
  columnsButton,
  exportButton,
  failModule,
  holdModule,
  heldRequests,
  recordAnnouncements,
  releaseModule,
  sleep,
} from './lazy-helpers'
import { dataExportLabels } from '../../../plugins/dataExport/labels'
import { columnVisibilityLabels } from '../../../plugins/columnVisibility/labels'

// Отказ процесса вне таблицы (ADR 0177, OB2): выгрузка и ленивый модуль поповера — дуга и
// «стоп» на своей кнопке, отказ — без отметки, объявлением и записью реестра. Отдельный
// файл: модуль поповера грузится один раз на документ.

afterEach(() => releaseModule(MODULE.columns))

const DATA = Array.from({ length: 20 }, (_, i) => ({
  id: String(i),
  name: `Row ${i}`,
}))

let failures: () => Failure[] = () => []
let refuseExport: (reason: Error) => void = () => {}

const Grid = () => {
  const table = useCreateTable({
    columns: [{ id: 'name', accessorKey: 'name', header: 'Name' }] as never,
    data: DATA,
    getRowId: (row: (typeof DATA)[number]) => row.id,
    // Выгрузку делает «сервер»: промис колбэка — в руках теста.
    dataMode: 'server',
    plugins: [
      columnVisibility(),
      dataExport({
        allow: { rows: ['all'], columns: ['all'], formats: ['csv'] },
        onExport: () =>
          new Promise<void>((_, reject) => {
            refuseExport = reject
          }),
      }),
    ] as never,
  })
  failures = () => (table as { getFailures: () => Failure[] }).getFailures()
  return (
    <div style={{ height: 400 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

/** «Стоп» внутри дуги виден. */
const stopShown = (el: HTMLElement) => {
  const stop = el.querySelector<HTMLElement>('[data-cancel-icon]')
  return !!stop && getComputedStyle(stop).display === 'flex'
}
const armed = (el: HTMLElement) => el.hasAttribute('data-cancel-armed')
/** Отметки отказа на кнопке нет: ни узла отметки, ни описания с причиной. */
const unmarked = (el: HTMLElement) =>
  !el.querySelector('[data-failure-indicator]') &&
  !el.hasAttribute('aria-describedby') &&
  el.getAttribute('aria-busy') !== 'true'

describe('Отказ процесса вне таблицы (ADR 0177)', () => {
  test('OB2: процесс вне таблицы — выгрузка, ленивый модуль поповера — показывает дугу и «стоп» на своей кнопке; отказ останавливает дугу без отметки на кнопке, объявляется с причиной и пишет запись в реестр', async () => {
    await holdModule(MODULE.columns)
    await render(<Grid />)
    await expect
      .poll(() => document.querySelector('[role="toolbar"]'))
      .not.toBeNull()
    const announcements = recordAnnouncements()

    // Выгрузка.
    await humanClick(exportButton())
    await expect.poll(() => pendingArcOf(exportButton())).not.toBeNull()
    await userEvent.hover(exportButton())
    await expect.poll(() => armed(exportButton())).toBe(true)
    await expect.poll(() => stopShown(exportButton())).toBe(true)
    refuseExport(new Error('Disk full'))
    await expect.poll(() => pendingArcOf(exportButton())).toBeNull()
    expect(unmarked(exportButton())).toBe(true)
    await expect
      .poll(() => announcements.messages)
      .toContain(
        tableLabels.announceActionFailed(
          dataExportLabels(tableLabels).export,
          'Disk full',
        ),
      )
    expect(failures()).toEqual([
      expect.objectContaining({
        action: { plugin: 'dataExport', action: 'export' },
        target: { process: 'export' },
        reason: 'Disk full',
        retry: expect.any(Function),
      }),
    ])

    // Ленивый модуль поповера: загрузка задержана, затем оборвана.
    await humanClick(columnsButton())
    await expect.poll(() => heldRequests(MODULE.columns)).toBeGreaterThan(0)
    await expect.poll(() => pendingArcOf(columnsButton())).not.toBeNull()
    await userEvent.hover(columnsButton())
    await expect.poll(() => armed(columnsButton())).toBe(true)
    await expect.poll(() => stopShown(columnsButton())).toBe(true)
    await failModule(MODULE.columns)
    await expect.poll(() => pendingArcOf(columnsButton())).toBeNull()
    await sleep(100)
    expect(unmarked(columnsButton())).toBe(true)
    expect(
      document.querySelector('[role="dialog"] [role="checkbox"]'),
    ).toBeNull()
    await expect
      .poll(() => announcements.messages)
      .toContain(
        tableLabels.loadFailed(columnVisibilityLabels(tableLabels).columns),
      )
    expect(failures().map(failure => failure.target)).toEqual([
      { process: 'export' },
      { process: `lazy:${columnVisibilityLabels(tableLabels).columns}` },
    ])
    announcements.stop()
  })
})
