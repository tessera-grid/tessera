import { render } from 'vitest-browser-react'
import { server } from 'vitest/browser'
import { afterEach, describe, expect, test } from 'vitest'

import '../../../ui/theme/theme.css'
import { __resetLogger, __setLoggerProduction } from '../../../util/logger'
import {
  __resetScrollLimits,
  LIMIT_PROBE_ATTRIBUTE,
  measureScrollHeightLimit,
  measureStickyScrollLimit,
} from '../../../core/scrollHeightLimit'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { serverRowModel, type ServerRowsRequest } from '../../../plugins'

// Пределы браузера (ADR 0141): высота элемента и прокрутка, до которой держится липкая
// шапка, — замер; они задают границу растяжки (ADR 0142). Набор идёт ещё и в `test:browsers`:
// пределы у Firefox свои.

const FIREFOX = server.browser === 'firefox'
/** Пределы Firefox: 2^30 и 2^29 единиц раскладки по 1/60 px. */
const FIREFOX_HEIGHT = 2 ** 30 / 60
const FIREFOX_STICKY = 2 ** 29 / 60
const CHROMIUM_HEIGHT = 33_554_428
const COLUMNS = [{ id: 'name', accessorKey: 'name', header: 'Name' }]
interface Item {
  id: string
  name: string
}
const NO_DATA: Item[] = []
const getRows = ({ start, end }: ServerRowsRequest) => ({
  rows: Array.from({ length: end - start }, (_, k) => ({
    id: `r${start + k}`,
    name: `N${start + k}`,
  })),
})

const Grid = ({ rowCount }: { rowCount: number }) => {
  const table = useCreateTable({
    columns: COLUMNS as never,
    data: NO_DATA,
    getRowId: (row: Item) => row.id,
    plugins: [serverRowModel({ getRows, rowCount })],
  } as never)
  return (
    <div style={{ width: 400, height: 400 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const shownIndexes = () =>
  [
    ...document.querySelectorAll<HTMLElement>(
      '.data-grid__body-row[data-row-id]',
    ),
  ].map(row => Number(row.dataset.index))
const nextFrame = () => new Promise(requestAnimationFrame)

/** Пробники, добавленные в документ, — по виду замера. */
const watchProbes = () => {
  const kinds: string[] = []
  const observer = new MutationObserver(records => {
    for (const record of records)
      for (const node of record.addedNodes)
        if (
          node instanceof HTMLElement &&
          node.hasAttribute(LIMIT_PROBE_ATTRIBUTE)
        )
          kinds.push(node.getAttribute(LIMIT_PROBE_ATTRIBUTE)!)
  })
  observer.observe(document.body, { childList: true })
  return {
    kinds,
    stop: async () => {
      observer.takeRecords()
      await nextFrame()
      observer.disconnect()
    },
  }
}

afterEach(() => {
  __resetScrollLimits()
  __resetLogger()
})

describe('Пределы браузера (ADR 0141)', () => {
  test('BH1: предел высоты — наибольшая высота, которую блок получает: в Firefox около 17,9 млн px (не 0), в Chromium и WebKit — 33,5 млн px', () => {
    const limit = measureScrollHeightLimit()
    if (FIREFOX) expect(Math.abs(limit - FIREFOX_HEIGHT)).toBeLessThan(2)
    else expect(limit).toBe(CHROMIUM_HEIGHT)
  })

  test('BH2: предел липкости — наибольшая прокрутка, на которой sticky; top: 0 у верха области: в Firefox около 8,9 млн px, в Chromium и WebKit предела нет', () => {
    const limit = measureStickyScrollLimit()
    if (FIREFOX) expect(Math.abs(limit - FIREFOX_STICKY)).toBeLessThan(2)
    else expect(limit).toBe(Infinity)
  })

  test('BH3: замеры — один раз на документ и только для тела выше 8 млн px: у таблицы ниже пробник в DOM не появляется; для тела выше меряются оба предела, и в продакшене', async () => {
    const probes = watchProbes()
    try {
      let screen = await render(<Grid rowCount={1000} />)
      await expect.poll(shownIndexes).not.toEqual([])
      await screen.unmount()
      expect(probes.kinds).toEqual([])

      // В продакшене предупреждения не печатаются — граница растяжки нужна и там.
      __setLoggerProduction(true)
      for (let i = 0; i < 2; i++) {
        screen = await render(<Grid rowCount={1_000_000} />)
        await expect.poll(shownIndexes).not.toEqual([])
        await screen.unmount()
      }
      expect(probes.kinds).toEqual(['height', 'sticky'])
    } finally {
      __setLoggerProduction(undefined)
      await probes.stop()
    }
  })
})
