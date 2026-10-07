import { commands } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { expect } from 'vitest'

import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { columnVisibility, dataExport, pagination } from '../../../plugins'
import { composed } from '../stories'
import { renderGrid } from '../helpers'
import { waitForGrid } from './core-helpers'

// Общая обвязка тестов ленивых поповеров (ADR 0061): перехват загрузки модуля и грид
// с тулбаром и пагинацией. Модуль грузится один раз на документ, поэтому каждый
// сценарий берёт ещё не загруженный модуль — свой файл или другой модуль.

const network = commands as unknown as {
  routeModule: (pattern: string, mode: 'hold' | 'fail') => Promise<void>
  releaseModule: (pattern: string) => Promise<void>
  heldModuleRequests: (pattern: string) => Promise<number>
}

/** Задержать загрузку модуля до `releaseModule`. */
export const holdModule = (pattern: string) =>
  network.routeModule(pattern, 'hold')
/** Обрывать каждую загрузку модуля. */
export const failModule = (pattern: string) =>
  network.routeModule(pattern, 'fail')
/** Пропустить задержанные и будущие загрузки модуля. */
export const releaseModule = (pattern: string) => network.releaseModule(pattern)

/** Сколько запросов модуля удержано. */
export const heldRequests = (pattern: string) =>
  network.heldModuleRequests(pattern)

export const MODULE = {
  columns: 'ColumnVisibilityPopover.tsx',
  export: 'ExportPanel.tsx',
  pageSize: 'PageSizeSelect.tsx',
  contextMenu: 'ContextMenuPopup.tsx',
  handleMenu: 'HandleMenuPopup.tsx',
  kebab: '/headerActions/ActionMenu.tsx',
  inlineMenu: 'ActionInlineMenu.tsx',
  panel: '/headerActions/ActionPanel.tsx',
} as const

const DATA = Array.from({ length: 60 }, (_, i) => ({
  id: String(i),
  name: `Row ${i}`,
  city: i % 2 ? 'Rome' : 'Paris',
}))

const COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name' },
  { id: 'city', accessorKey: 'city', header: 'City' },
]

const ToolbarGrid = () => {
  const table = useCreateTable({
    columns: COLUMNS as never,
    data: DATA,
    getRowId: (row: (typeof DATA)[number]) => row.id,
    plugins: [columnVisibility(), dataExport(), pagination()] as never,
  })
  return (
    <div style={{ height: 400 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

export const renderToolbarGrid = async () => {
  const screen = await render(<ToolbarGrid />)
  await expect
    .poll(() => document.querySelector('[role="toolbar"]'))
    .not.toBeNull()
  return screen
}

export const columnsButton = () =>
  document.querySelector<HTMLElement>(
    '[data-testid="column-visibility-button"]',
  )!
export const exportButton = () =>
  document.querySelector<HTMLElement>('[data-testid="export-button"]')!
export const pageSizeButton = () =>
  document.querySelector<HTMLElement>(
    'nav[data-testid="pagination"] button[aria-label="Rows per page"]',
  )!
export const columnsPopover = () =>
  document.querySelector('[role="dialog"] [role="checkbox"]')
export const exportPanel = () =>
  document.querySelector('[data-testid="export-panel"]')
export const pageSizeOptions = () =>
  document.querySelectorAll('[role="option"]').length

export const sleep = (ms: number) =>
  new Promise(resolve => setTimeout(resolve, ms))

/** Тексты live-области грида с момента вызова: каждое объявление — новый узел. */
export const recordAnnouncements = () => {
  const messages: string[] = []
  const REGION = '[role="status"][aria-live="polite"]'
  const observer = new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        const host =
          node instanceof Element ? node : (node.parentElement ?? null)
        const text = node.textContent ?? ''
        if (text && host?.closest(REGION)) messages.push(text)
      }
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })
  return { messages, stop: () => observer.disconnect() }
}

/** Все значения атрибута элемента, пока идёт наблюдение. */
export const recordAttribute = (target: () => Element | null, name: string) => {
  const values: (string | null)[] = []
  const observer = new MutationObserver(() =>
    values.push(target()?.getAttribute(name) ?? null),
  )
  observer.observe(document.body, {
    attributes: true,
    subtree: true,
    attributeFilter: [name],
  })
  return { values, stop: () => observer.disconnect() }
}

export const renderContextMenuGrid = async () => {
  const screen = await render(<composed.ContextMenu />)
  await expect
    .poll(() => document.querySelectorAll(BODY_CELL).length)
    .toBeGreaterThan(4)
  return screen
}

const BODY_CELL = '.data-grid__body-cell[data-column-id]'

/** Ячейка данных: строка `row`, вторая колонка (первая может быть служебной). */
export const dataCell = (row = 0) => {
  const rows = [
    ...document.querySelectorAll<HTMLElement>('.data-grid__body-row'),
  ]
    .filter(el => el.getAttribute('data-index') !== null)
    .sort(
      (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top,
    )
  const cells = [...rows[row].querySelectorAll<HTMLElement>(BODY_CELL)].sort(
    (a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left,
  )
  return cells[1]
}

/** Правый клик как у браузера: `mousedown` (кнопка 2), затем `contextmenu`. */
export const rightClick = (el: Element) => {
  const rect = el.getBoundingClientRect()
  const init = {
    bubbles: true,
    cancelable: true,
    button: 2,
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
  }
  el.dispatchEvent(new MouseEvent('mousedown', init))
  const event = new MouseEvent('contextmenu', init)
  el.dispatchEvent(event)
  return event
}

export const contextMenu = () => document.querySelector('[role="menu"]')
export const gridScroller = () =>
  document.querySelector<HTMLElement>('.data-grid__container')!

export const renderHandleGrid = async () => {
  const screen = renderGrid({
    columnCount: 5,
    dataCount: 6,
    enableColumnResizing: true,
    enableColumnDragging: true,
  })
  await waitForGrid()
  return screen
}

const handleHead = () =>
  [...document.querySelectorAll<HTMLElement>('.data-grid__head-cell')]
    .filter(cell => cell.querySelector('.drag__handler--column[aria-label]'))
    .sort(
      (a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left,
    )[0]

/** Заголовок с ручкой перетаскивания и грипом ширины. */
export const handleCell = () => handleHead()
export const columnHandle = () =>
  handleHead().querySelector<HTMLElement>('.drag__handler--column[aria-label]')!
export const gripWrapper = () =>
  handleHead().querySelector<HTMLElement>('.resize__handler--column')!
export const gripSeparator = () =>
  gripWrapper().querySelector<HTMLElement>('[role="separator"]')!
export const handleMenu = () => document.querySelector('[role="menu"]')
