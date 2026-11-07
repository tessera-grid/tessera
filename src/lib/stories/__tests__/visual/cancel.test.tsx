import axe from 'axe-core'
import { commands, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test } from 'vitest'

import { definePlugin } from '../../../core/definePlugin'
import { setColumnFilterByUser } from '../../../shared/filtering/filtering'
import type { ContextMenuAction, RowAction } from '../../../core/headerActions'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  columnFiltering,
  columnSorting,
  contextMenu,
  dataExport,
  pagination,
  quickSearch,
  rowActionMenu,
  rowActions,
  rowExpanding,
} from '../../../plugins'
import { failureShownOn, humanClick, pendingArcOf, tabInto } from '../helpers'
import { tableLabels } from '../labels'
import { backgroundOf, contrast, inBothThemes, toRgba } from './a11y-helpers'
import { waitForGrid } from './core-helpers'
import { dataExportLabels } from '../../../plugins/dataExport/labels'
import { rowExpandingLabels } from '../../../plugins/rowExpanding/labels'

// Отмена длительных операций (ADR 0153; CA2–CA5, CA10): «стоп» занятой кнопки, ждущий
// пункт меню, тихая отмена и плашка серверного действия — настоящими событиями браузера.
// CA1, CA8–CA9, CA11–CA12 — модульные (`src/lib/__tests__/cancellation.dom.test.tsx`), CA6 —
// в `server-cell-selection`, CA7 — в `touch`.

interface Deferred {
  promise: Promise<void>
  resolve: () => void
  reject: (error: unknown) => void
}

const deferred = (): Deferred => {
  let resolve!: () => void
  let reject!: (error: unknown) => void
  const promise = new Promise<void>((ok, fail) => {
    resolve = ok
    reject = fail
  })
  promise.catch(() => {})
  return { promise, resolve, reject }
}

interface Call {
  kind: string
  signal: AbortSignal
  answer: Deferred
}

let calls: Call[] = []

/** Колбэк, чей ответ держит тест; `signal` — из последнего аргумента. */
const held =
  (kind: string) =>
  (...args: unknown[]) => {
    const { signal } = args.at(-1) as { signal: AbortSignal }
    const call = { kind, signal, answer: deferred() }
    calls.push(call)
    return call.answer.promise
  }
const lastCall = (kind: string) =>
  calls.filter(call => call.kind === kind).at(-1)

const icon = (letter: string) => () => <span aria-hidden>{letter}</span>
const rowAction = (
  id: string,
  label: string,
  rest: Partial<RowAction> = {},
): RowAction => ({
  id,
  slot: 'actionRowSlot',
  icon: icon(label[0]!),
  label: () => label,
  onSelect: held(id),
  ...rest,
})
const recalculate: ContextMenuAction = {
  id: 'recalculate',
  icon: icon('R'),
  label: () => 'Recalculate',
  onSelect: held('recalculate'),
}

const recalculateTable: ContextMenuAction = {
  id: 'recalculateTable',
  icon: icon('T'),
  label: () => 'Recalculate table',
  target: () => 'table',
  onSelect: held('table'),
}

const probe = definePlugin()({
  id: 'cancelProbe',
  slotActions: [
    rowAction('archive', 'Archive', { order: 0 }),
    rowAction('remove', 'Remove', { order: 1, placement: 'menu' }),
    rowAction('merge', 'Merge', { order: 2, inlineAsMenu: () => true }),
  ],
  contextMenuActions: [recalculate, recalculateTable],
})

interface Node {
  id: string
  name: string
  kids?: number
}

const DATA: Node[] = Array.from({ length: 25 }, (_, index) => ({
  id: `r${index}`,
  name: `Row ${index}`,
  kids: index === 0 ? 3 : 0,
}))

const Grid = ({ menu }: { menu: boolean }) => {
  const table = useCreateTable({
    enableKeyboardNavigation: true,
    rowCount: 1000,
    columns: [{ id: 'name', accessorKey: 'name', header: 'Name' }] as never,
    data: DATA,
    getRowId: (row: Node) => row.id,
    refreshOptions: { delayMs: 0, minDurationMs: 0 },
    dataMode: 'server',
    plugins: [
      probe(),
      rowActions(),
      ...(menu ? [rowActionMenu({ mode: 'always' })] : []),
      contextMenu(),
      columnSorting({ onToggleColumnSort: held('sort') }),
      columnFiltering({ onFilterChange: held('filter') }),
      quickSearch({ onSearchChange: held('search') }),
      pagination({
        initialPageSize: 25,
        onPageChange: held('page'),
      }),
      rowExpanding({
        hasChildren: row => (row.original.kids ?? 0) > 0,
        loadChildren: held('children') as never,
      }),
      dataExport({
        allow: { rows: ['all'], columns: ['all'], formats: ['csv'] },
        onExport: held('export'),
      }),
    ] as never,
  })
  captured = table
  return (
    <div style={{ width: 760, height: 520 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

let captured: unknown

const mount = async (menu = false) => {
  calls = []
  await render(<Grid menu={menu} />)
  await waitForGrid()
}

afterEach(() => {
  document.documentElement.classList.remove('dark')
})

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
/** `--tsr-comp-cancel-arm-delay` с запасом. */
const ARM = 650

const rowEl = (id: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${id}"]`,
  )!
const nameCell = (id: string) =>
  rowEl(id).querySelector<HTMLElement>('[data-column-id="name"]')!
const headCell = () =>
  document.querySelector<HTMLElement>(
    '.data-grid__head-cell[data-column-id="name"][aria-colindex]',
  )!
const sortButton = () =>
  headCell().querySelector<HTMLElement>('.column-sort__button')!
const filterButton = () =>
  headCell().querySelector<HTMLElement>('.column-filter__button')!
const archiveButton = (id = 'r1') =>
  rowEl(id).querySelector<HTMLElement>('button[aria-label$="Archive"]')!
const toggle = () =>
  rowEl('r0').querySelector<HTMLElement>('.row-expand-button')!
const exportButton = () =>
  document.querySelector<HTMLElement>('[data-testid="export-button"]')!
const nextPage = () =>
  document.querySelector<HTMLElement>('[data-page-action="next"]')!
const sizeTrigger = () =>
  document.querySelector<HTMLElement>('[data-testid="page-size-select"]')!
const sizeOption = (text: string) =>
  [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(
    el => el.textContent?.trim() === text,
  )
const searchInput = () =>
  document.querySelector<HTMLInputElement>('[data-testid="quick-search"]')!
const items = () => [
  ...document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
]
const itemByText = (text: string) =>
  items().find(el => el.textContent?.includes(text))
const rowKebab = (id = 'r1') =>
  rowEl(id).querySelector<HTMLElement>(`[aria-label^="${tableLabels.rowMenu}"]`)
const pendingBanner = () =>
  document.querySelector<HTMLElement>('[data-testid="pending-action-banner"]')
const loadBanner = () =>
  document.querySelector<HTMLElement>('[data-testid="load-error-banner"]')
const liveRegion = () =>
  document.querySelector<HTMLElement>('[role="status"][aria-live="polite"]')!
const tooltipShown = (text: string) =>
  [...document.querySelectorAll('[data-side]')].some(
    el => el.textContent?.trim() === text,
  )

const armed = (el: HTMLElement) => el.hasAttribute('data-cancel-armed')
const busy = (el: HTMLElement) => el.getAttribute('aria-busy') === 'true'
const stopShown = (el: HTMLElement) => {
  const stop = el.querySelector<HTMLElement>('[data-cancel-icon]')
  return !!stop && getComputedStyle(stop).display === 'flex'
}
const parkPointer = () =>
  userEvent.hover(document.body, { position: { x: 1, y: 1 } })

type Method = 'pointer' | 'Enter' | 'Space'

/** Нажать взведённую кнопку мышью или клавишей с фокусом на ней. */
const press = async (el: HTMLElement, method: Method) => {
  if (method === 'pointer') {
    await humanClick(el)
    return
  }
  el.focus()
  await userEvent.keyboard(method === 'Enter' ? '{Enter}' : ' ')
}

interface Carrier {
  name: string
  kind: string
  button: () => HTMLElement
  /** Имя взведённой кнопки; у сортировки подпись зависит от направления. */
  label: string | RegExp
  start: () => Promise<void>
  method: Method
}

// «Стоп» — у кнопки процесса вне таблицы (ADR 0177, §2); запрос данных отменяет полоса
// под шапкой (CA5), действие строки — пункт меню (CA3).
const carriers = (): Carrier[] => [
  {
    name: 'выгрузка',
    kind: 'export',
    button: exportButton,
    label: tableLabels.cancelAction(dataExportLabels(tableLabels).export),
    start: () => humanClick(exportButton()),
    method: 'Enter',
  },
  {
    name: 'тоггл ленивых детей',
    kind: 'children',
    button: toggle,
    label: tableLabels.cancelAction(rowExpandingLabels(tableLabels).expandRow),
    start: () => humanClick(toggle()),
    method: 'pointer',
  },
  {
    name: 'тоггл ленивых детей, Space',
    kind: 'children',
    button: toggle,
    label: tableLabels.cancelAction(rowExpandingLabels(tableLabels).expandRow),
    start: () => humanClick(toggle()),
    method: 'Space',
  },
]

describe('Отмена длительных операций (ADR 0153)', () => {
  test('CA2: занятая кнопка процесса вне таблицы — выгрузка и тоггл ленивых детей — при наведении и фокусе показывает «стоп» внутри дуги, имя и тултип «Отменить: ‹имя›»; нажатие мышью, Enter и Space прерывает signal и снимает ожидание; «стоп» — не раньше --tsr-comp-cancel-arm-delay после старта', async () => {
    await mount()
    // Кнопка выгрузки — из ленивого модуля тулбара.
    await expect
      .poll(() => document.querySelector('[data-testid="export-button"]'))
      .not.toBeNull()
    for (const carrier of carriers()) {
      const count = calls.length
      await carrier.start()
      await expect
        .poll(() => calls.length, { message: carrier.name })
        .toBeGreaterThan(count)
      const call = lastCall(carrier.kind)!
      const button = carrier.button()

      // Сразу после старта «стопа» нет: повторное нажатие не отменяет.
      expect(armed(button), carrier.name).toBe(false)
      expect(call.signal.aborted, carrier.name).toBe(false)
      await sleep(ARM)
      await expect.poll(() => armed(carrier.button())).toBe(true)

      // Наведение: «стоп» внутри дуги, имя и подсказка — «Отменить: ‹имя›».
      await userEvent.hover(carrier.button())
      await expect
        .poll(() => stopShown(carrier.button()), { message: carrier.name })
        .toBe(true)
      expect(pendingArcOf(carrier.button()), carrier.name).not.toBeNull()
      const name = carrier.button().getAttribute('aria-label') ?? ''
      if (typeof carrier.label === 'string') {
        expect(name, carrier.name).toBe(carrier.label)
      } else expect(name, carrier.name).toMatch(carrier.label)
      await expect
        .poll(() => tooltipShown(name), { message: carrier.name })
        .toBe(true)

      // Фокус с клавиатуры без наведения — тоже «стоп».
      await parkPointer()
      await tabInto(carrier.button())
      await expect
        .poll(() => stopShown(carrier.button()), { message: carrier.name })
        .toBe(true)

      await press(carrier.button(), carrier.method)
      await expect
        .poll(() => call.signal.aborted, { message: carrier.name })
        .toBe(true)
      await expect
        .poll(() => busy(carrier.button()) || armed(carrier.button()), {
          message: carrier.name,
        })
        .toBe(false)
      await parkPointer()
    }
  })

  test('CA3: ждущий пункт меню (контекстное меню, кебаб) доступен: подпись «Отменить: ‹имя›», спиннер справа; выбор мышью и клавиатурой отменяет; меню на занятых ячейках открывается как обычно', async () => {
    await mount(true)

    // Контекстное меню: действие ждёт, меню на той же ячейке открывается снова.
    await userEvent.click(nameCell('r2'), { button: 'right' })
    await expect.poll(() => itemByText('Recalculate')).toBeTruthy()
    await humanClick(itemByText('Recalculate')!)
    await expect.poll(() => items().length).toBe(0)
    const recalc = lastCall('recalculate')!
    await expect
      .poll(() => nameCell('r2').getAttribute('aria-busy'))
      .toBe('true')
    await userEvent.click(nameCell('r2'), { button: 'right' })
    const cancelRecalc = tableLabels.cancelAction('Recalculate')
    await expect.poll(() => itemByText(cancelRecalc)).toBeTruthy()
    const item = itemByText(cancelRecalc)!
    expect(item.getAttribute('aria-disabled')).not.toBe('true')
    expect(item.hasAttribute('data-pending')).toBe(true)
    const spinner = item.querySelector<HTMLElement>('[data-item-spinner]')!
    expect(spinner.getBoundingClientRect().left).toBeGreaterThan(
      item.getBoundingClientRect().left + item.offsetWidth / 2,
    )
    await humanClick(item)
    await expect.poll(() => recalc.signal.aborted).toBe(true)
    await expect.poll(() => items().length).toBe(0)

    // Кебаб строки: пункт ждущего действия выбирается клавиатурой.
    await userEvent.hover(nameCell('r1'))
    await expect.poll(() => rowKebab()).not.toBeNull()
    await humanClick(rowKebab()!)
    await expect.poll(() => itemByText('Remove')).toBeTruthy()
    await humanClick(itemByText('Remove')!)
    await expect.poll(() => items().length).toBe(0)
    const remove = lastCall('remove')!
    await userEvent.hover(nameCell('r1'))
    await humanClick(rowKebab()!)
    const cancelRemove = tableLabels.cancelAction('Remove')
    await expect.poll(() => itemByText(cancelRemove)).toBeTruthy()
    itemByText(cancelRemove)!.focus()
    await userEvent.keyboard('{Enter}')
    await expect.poll(() => remove.signal.aborted).toBe(true)
    await expect.poll(() => items().length).toBe(0)
  })

  test('CA4: отмена тихая — ни отметки отказа, ни вспышки на цели; серверные срезы возвращаются к прежним без красного света и плашки отказа; объявление «‹имя›: отменено»', async () => {
    await mount(true)

    // Действие строки: отмена пунктом кебаба — цель без вспышки и отметки.
    await userEvent.hover(nameCell('r1'))
    await humanClick(rowKebab()!)
    await expect.poll(() => itemByText('Remove')).toBeTruthy()
    await humanClick(itemByText('Remove')!)
    await expect.poll(() => items().length).toBe(0)
    const remove = lastCall('remove')!
    await userEvent.hover(nameCell('r1'))
    await humanClick(rowKebab()!)
    const cancelRemove = tableLabels.cancelAction('Remove')
    await expect.poll(() => itemByText(cancelRemove)).toBeTruthy()
    await humanClick(itemByText(cancelRemove)!)
    await expect.poll(() => remove.signal.aborted).toBe(true)
    await expect
      .poll(() => liveRegion().textContent)
      .toContain(tableLabels.announceActionCancelled('Remove'))
    await sleep(300)
    expect(document.querySelector('[data-flash]')).toBeNull()
    expect(document.querySelector('[data-failure-indicator]')).toBeNull()

    // Серверная сортировка: срез к прежнему, без красного света и плашки.
    await userEvent.hover(headCell())
    await humanClick(sortButton())
    const sort = lastCall('sort')!
    expect(headCell().getAttribute('aria-sort')).not.toBe('none')
    await expect.poll(() => pendingBanner(), { timeout: 3000 }).not.toBeNull()
    await humanClick(
      document.querySelector<HTMLElement>(
        '[data-testid="pending-action-cancel"]',
      )!,
    )
    await expect.poll(() => sort.signal.aborted).toBe(true)
    await expect.poll(() => headCell().getAttribute('aria-sort')).toBe('none')
    await expect
      .poll(() => liveRegion().textContent)
      .toContain(tableLabels.announceActionCancelled(tableLabels.actionSorting))
    await sleep(300)
    expect(loadBanner()).toBeNull()
    expect(document.querySelector('[data-error-flash="true"]')).toBeNull()
  })

  test("CA13: пункт меню с целью 'table' дольше --tsr-comp-cancel-hint-delay — та же плашка с именем действия и кнопкой «Отменить»; кнопка и Escape в теле отменяют тихо; плашка одна и с серверным действием", async () => {
    await mount()
    const start = async () => {
      await userEvent.click(nameCell('r2'), { button: 'right' })
      await expect.poll(() => itemByText('Recalculate table')).toBeTruthy()
      await humanClick(itemByText('Recalculate table')!)
      await expect.poll(() => items().length).toBe(0)
      return lastCall('table')!
    }

    // Кнопка плашки: не раньше задержки, имя действия, отмена тихая.
    const first = await start()
    expect(pendingBanner()).toBeNull()
    await expect
      .poll(() => pendingBanner()?.textContent ?? '', { timeout: 3000 })
      .toContain(tableLabels.pendingAction('Recalculate table'))
    expect(pendingBanner()!.textContent).toContain(tableLabels.cancel)
    await humanClick(
      document.querySelector<HTMLElement>(
        '[data-testid="pending-action-cancel"]',
      )!,
    )
    await expect.poll(() => first.signal.aborted).toBe(true)
    await expect.poll(() => pendingBanner()).toBeNull()
    await expect
      .poll(() => liveRegion().textContent)
      .toContain(tableLabels.announceActionCancelled('Recalculate table'))
    await sleep(300)
    expect(loadBanner()).toBeNull()
    expect(document.querySelector('[data-refreshing]')).toBeNull()

    // Escape в теле; пункт снова запускается после отмены.
    const second = await start()
    expect(second).not.toBe(first)
    await expect.poll(() => pendingBanner(), { timeout: 3000 }).not.toBeNull()
    await humanClick(nameCell('r3'))
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => second.signal.aborted).toBe(true)
    await expect.poll(() => pendingBanner()).toBeNull()

    // Вместе с серверным действием: заголовок — серверного, отменяет обоих.
    const third = await start()
    await userEvent.hover(headCell())
    await humanClick(sortButton())
    const sort = lastCall('sort')!
    await expect
      .poll(() => pendingBanner()?.textContent ?? '', { timeout: 3000 })
      .toContain(tableLabels.pendingSorting)
    expect(
      document.querySelectorAll('[data-testid="pending-action-banner"]'),
    ).toHaveLength(1)
    await humanClick(
      document.querySelector<HTMLElement>(
        '[data-testid="pending-action-cancel"]',
      )!,
    )
    await expect.poll(() => third.signal.aborted).toBe(true)
    await expect.poll(() => sort.signal.aborted).toBe(true)
  })

  test('CA14: ждущий пункт мини-меню инлайн-кнопки — подпись «Отменить: ‹имя›» и спиннер, кнопка без дуги; выбор мышью и клавиатурой отменяет тихо', async () => {
    await mount()
    const button = () =>
      nameCell('r4')
        .closest<HTMLElement>('.data-grid__body-row')!
        .querySelector<HTMLElement>('[aria-label="Merge"]')!
    const open = async () => {
      await userEvent.hover(nameCell('r4'))
      await humanClick(button())
      await expect.poll(() => items().length).toBeGreaterThan(0)
    }
    const cancelMerge = tableLabels.cancelAction('Merge')

    await open()
    await humanClick(itemByText('Merge')!)
    await expect.poll(() => items().length).toBe(0)
    const mouse = lastCall('merge')!
    expect(pendingArcOf(button())).toBeNull()

    await open()
    await expect.poll(() => itemByText(cancelMerge)).toBeTruthy()
    const item = itemByText(cancelMerge)!
    expect(item.hasAttribute('data-disabled')).toBe(false)
    expect(item.hasAttribute('data-pending')).toBe(true)
    await humanClick(item)
    await expect.poll(() => mouse.signal.aborted).toBe(true)
    await expect.poll(() => items().length).toBe(0)
    await expect
      .poll(() => liveRegion().textContent)
      .toContain(tableLabels.announceActionCancelled('Merge'))
    expect(document.querySelector('[data-flash]')).toBeNull()

    await open()
    await humanClick(itemByText('Merge')!)
    await expect.poll(() => items().length).toBe(0)
    const keyboard = lastCall('merge')!
    expect(keyboard).not.toBe(mouse)
    await open()
    await expect.poll(() => itemByText(cancelMerge)).toBeTruthy()
    itemByText(cancelMerge)!.focus()
    await userEvent.keyboard('{Enter}')
    await expect.poll(() => keyboard.signal.aborted).toBe(true)
  })

  test('CA5: серверное действие дольше --tsr-comp-cancel-hint-delay — плашка Alert под шапкой «Идёт поиск…» с кнопкой «Отменить»; Escape в поле поиска и в теле отменяет; поиск возвращает прежний запрос в поле', async () => {
    await mount()

    // Поиск: плашка не раньше задержки, Escape в поле отменяет и возвращает прежний запрос.
    // Тулбар ленивый (ADR 0061): поле появляется после загрузки модуля.
    await expect.poll(searchInput).not.toBeNull()
    await userEvent.click(searchInput())
    await userEvent.keyboard('Row')
    await expect.poll(() => lastCall('search')).toBeTruthy()
    // Прежний запрос «Row» действует; новый «Row 1» ждёт.
    lastCall('search')!.answer.resolve()
    await expect.poll(() => pendingBanner()).toBeNull()
    await userEvent.keyboard(' 1')
    await expect
      .poll(() => calls.filter(call => call.kind === 'search').length)
      .toBe(2)
    const search = lastCall('search')!
    expect(pendingBanner()).toBeNull()
    await expect
      .poll(() => pendingBanner()?.textContent ?? '', { timeout: 3000 })
      .toContain(tableLabels.pendingSearch)
    const banner = pendingBanner()!
    expect(banner.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      headCell().getBoundingClientRect().bottom - 1,
    )
    expect(banner.textContent).toContain(tableLabels.cancel)
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => search.signal.aborted).toBe(true)
    await expect.poll(() => searchInput().value).toBe('Row')
    await expect.poll(() => pendingBanner()).toBeNull()
    await new Promise(resolve => setTimeout(resolve, 400))
    expect(calls.filter(call => call.kind === 'search')).toHaveLength(2)

    // Сортировка: кнопка «Отменить» плашки.
    await userEvent.hover(headCell())
    await humanClick(sortButton())
    const sort = lastCall('sort')!
    await expect
      .poll(() => pendingBanner()?.textContent ?? '', { timeout: 3000 })
      .toContain(tableLabels.pendingSorting)
    await humanClick(
      document.querySelector<HTMLElement>(
        '[data-testid="pending-action-cancel"]',
      )!,
    )
    await expect.poll(() => sort.signal.aborted).toBe(true)
    await expect.poll(() => pendingBanner()).toBeNull()

    // Escape в теле.
    await humanClick(nextPage())
    const page = lastCall('page')!
    await humanClick(nameCell('r3'))
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => page.signal.aborted).toBe(true)
  })

  test('CA10: «стоп» и плашка — axe с color-contrast, значок не ниже 3:1 в обеих темах, в forced-colors под наведением — заливка Highlight и «стоп» HighlightText, у плашки — системные цвета', async () => {
    await mount()
    await userEvent.hover(headCell())
    await humanClick(sortButton())
    await expect.poll(() => pendingBanner(), { timeout: 3000 }).not.toBeNull()
    await humanClick(exportButton())
    await expect.poll(() => armed(exportButton())).toBe(true)
    await userEvent.hover(exportButton())
    await expect.poll(() => stopShown(exportButton())).toBe(true)

    const contexts = () => [exportButton(), pendingBanner()!]
    await inBothThemes(async () => {
      for (const context of contexts()) {
        const { violations } = await axe.run(context, {
          rules: { 'color-contrast': { enabled: true } },
        })
        expect(violations.map(v => v.id)).toEqual([])
      }
      const stop =
        exportButton().querySelector<HTMLElement>('[data-cancel-icon]')!
      const ratio = contrast(
        toRgba(getComputedStyle(stop).color),
        backgroundOf(exportButton()),
      )
      expect(ratio).toBeGreaterThanOrEqual(3)
    })

    await commands.forcedColors(true)
    try {
      const stop =
        exportButton().querySelector<HTMLElement>('[data-cancel-icon]')!
      expect(toRgba(getComputedStyle(stop).color)).toEqual(
        toRgba('HighlightText'),
      )
      expect(toRgba(getComputedStyle(exportButton()).backgroundColor)).toEqual(
        toRgba('Highlight'),
      )
      const cancel = document.querySelector<HTMLElement>(
        '[data-testid="pending-action-cancel"]',
      )!
      expect(toRgba(getComputedStyle(cancel).color)).toEqual(
        toRgba('ButtonText'),
      )
    } finally {
      await commands.forcedColors(false)
    }
    await userEvent.keyboard('{Escape}')
  })
})
