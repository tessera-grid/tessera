import { render } from 'vitest-browser-react'
import { server } from 'vitest/browser'
import { afterEach, describe, expect, test, vi } from 'vitest'

import '../../../core/themeVariables/theme.css'
import { __resetLogger, __setLoggerProduction } from '../../../core/logger'
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
// шапка, — замер, обрезка тела и предупреждения. Набор идёт ещё и в `test:browsers`:
// пределы у Firefox свои.

const FIREFOX = server.browser === 'firefox'
/** Пределы Firefox: 2^30 и 2^29 единиц раскладки по 1/60 px. */
const FIREFOX_HEIGHT = 2 ** 30 / 60
const FIREFOX_STICKY = 2 ** 29 / 60
const CHROMIUM_HEIGHT = 33_554_428
/** Координаты Firefox у предела — с шагом около 2px. */
const PRECISION = 2

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

const q = (selector: string) => document.querySelector<HTMLElement>(selector)
const scroller = () => q('.data-grid__container')!
const body = () => q('.data-grid__body')!
const rowHeight = () =>
  Number.parseFloat(
    getComputedStyle(scroller()).getPropertyValue('--tsr-comp-row-height'),
  )
const shownIndexes = () =>
  [
    ...document.querySelectorAll<HTMLElement>(
      '.data-grid__body-row[data-row-id]',
    ),
  ].map(row => Number(row.dataset.index))
/** Последняя строка с данными, видимая в области прокрутки. */
const lastVisibleIndex = () => {
  const view = scroller().getBoundingClientRect()
  const visible = [
    ...document.querySelectorAll<HTMLElement>(
      '.data-grid__body-row[data-row-id]',
    ),
  ].filter(row => {
    const rect = row.getBoundingClientRect()
    return (
      rect.height > 0 &&
      rect.top < view.bottom - PRECISION &&
      rect.bottom > view.top + PRECISION
    )
  })
  return Math.max(...visible.map(row => Number(row.dataset.index)))
}
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

const warnings = () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  return {
    messages: () => warn.mock.calls.map(call => String(call[0])),
    restore: () => warn.mockRestore(),
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

  test('BH3: замеры — один раз на документ и только для тела выше 8 млн px; предел липкости не меряется, когда предупреждение не печатается', async () => {
    const warn = warnings()
    const probes = watchProbes()
    try {
      let screen = await render(<Grid rowCount={1000} />)
      await expect.poll(shownIndexes).not.toEqual([])
      await screen.unmount()
      expect(probes.kinds).toEqual([])

      // В продакшене предупреждения не печатаются.
      __setLoggerProduction(true)
      screen = await render(<Grid rowCount={1_000_000} />)
      await expect.poll(shownIndexes).not.toEqual([])
      await screen.unmount()
      __setLoggerProduction(undefined)
      expect(probes.kinds).toEqual(['height'])

      for (let i = 0; i < 2; i++) {
        screen = await render(<Grid rowCount={1_000_000} />)
        await expect.poll(shownIndexes).not.toEqual([])
        await screen.unmount()
      }
      expect(probes.kinds).toEqual(['height', 'sticky'])
    } finally {
      __setLoggerProduction(undefined)
      await probes.stop()
      warn.restore()
    }
  })

  test('BH4: тело выше предела высоты обрезано до предела — список не схлопывается: первая строка видна, прокрутка до предела показывает строки', async () => {
    const warn = warnings()
    try {
      const screen = await render(<Grid rowCount={1_000_000} />)
      await expect.poll(shownIndexes).toContain(0)
      const shown = body().getBoundingClientRect().height
      const set = Number.parseFloat(
        getComputedStyle(scroller()).getPropertyValue('--tsr-comp-body-height'),
      )
      expect(shown).toBeGreaterThan(0)
      expect(shown).toBeLessThan(1_000_000 * rowHeight())
      expect(Math.abs(shown - set)).toBeLessThanOrEqual(PRECISION)

      scroller().scrollTop = scroller().scrollHeight
      await expect
        .poll(lastVisibleIndex)
        .toBe(Math.round(set / rowHeight()) - 1)
      await screen.unmount()
    } finally {
      warn.restore()
    }
  })

  test('BH5: тело выше предела липкости — предупреждение с номером строки, после которой шапка перестаёт прилипать, и советом о пагинации; без предела липкости — нет', async () => {
    const warn = warnings()
    try {
      let screen = await render(<Grid rowCount={1000} />)
      await expect.poll(shownIndexes).not.toEqual([])
      await screen.unmount()
      const sticky = (message: string) => message.includes('stops sticking')
      expect(warn.messages().some(sticky)).toBe(false)

      screen = await render(<Grid rowCount={1_000_000} />)
      await expect.poll(shownIndexes).not.toEqual([])
      const height = rowHeight()
      await screen.unmount()
      if (FIREFOX) {
        const row = Math.floor(measureStickyScrollLimit() / height)
        expect(warn.messages().find(sticky)).toMatch(
          new RegExp(`after row ${row} of 1000000.*pagination`),
        )
      } else {
        expect(warn.messages().some(sticky)).toBe(false)
      }
    } finally {
      warn.restore()
    }
  })

  test('BH6: тело выше предела высоты — предупреждение с номером последней доступной строки, пределом в px (не 0) и советом о пагинации; тело ниже — без предупреждения', async () => {
    const warn = warnings()
    try {
      const reach = (message: string) => message.includes('out of reach')
      let screen = await render(<Grid rowCount={1000} />)
      await expect.poll(shownIndexes).not.toEqual([])
      await screen.unmount()
      expect(warn.messages().some(reach)).toBe(false)

      screen = await render(<Grid rowCount={1_000_000} />)
      await expect.poll(shownIndexes).not.toEqual([])
      const limit = measureScrollHeightLimit()
      const message = warn.messages().find(reach) ?? ''
      expect(message).toMatch(
        new RegExp(
          `rows after \\d+ of 1000000 .*caps the list at ${Math.round(limit)}px.*pagination`,
        ),
      )
      expect(limit).toBeGreaterThan(0)
      const reachable = Number(/rows after (\d+)/.exec(message)![1])
      scroller().scrollTop = scroller().scrollHeight
      await expect.poll(lastVisibleIndex).toBe(reachable - 1)
      await screen.unmount()
    } finally {
      warn.restore()
    }
  })
})
