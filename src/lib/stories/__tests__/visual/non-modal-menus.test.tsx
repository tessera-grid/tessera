import { commands, page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test } from 'vitest'

import { definePlugin } from '../../../core/definePlugin'
import type { HeaderAction, RowAction } from '../../../core/headerActions'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  contextMenu,
  dataExport,
  headerActionMenu,
  rowActionMenu,
  rowActions,
  rowSelection,
} from '../../../plugins'
import { humanClick } from '../helpers'
import { composed, rowAsyncArgs } from '../stories'
import { rowsTopDown, waitForGrid } from './core-helpers'
import { columnHandle, handleCell, renderHandleGrid } from './lazy-helpers'
import { tableLabels } from '../labels'

// Немодальные меню грида (ADR 0085, MM1–MM7): без подложки и блокировки прокрутки,
// нажатие мимо закрывает меню и доходит до цели, прокрутка грида пользователем
// закрывает меню. MM3 — последним: ошибка Firefox видна после предыдущего теста файла.

const pointer = commands as unknown as {
  realWheel: (
    at: { x: number; y: number },
    deltaY: number,
    ticks: number,
    intervalMs: number,
  ) => Promise<void>
}

const icon = (text: string) => () => <span>{text}</span>
const leaf = (id: string, label: string) => ({
  id,
  icon: icon(label[0]!),
  label: () => label,
  onSelect: () => {},
})

const probe = definePlugin()({
  id: 'nonModalProbe',
  slotActions: [
    { ...leaf('archive', 'Archive'), slot: 'actionRowSlot', order: 0 },
    { ...leaf('copy', 'Copy'), slot: 'actionRowSlot', order: 1 },
    {
      ...leaf('freeze', 'Freeze'),
      slot: 'rightHeaderSlot',
      order: 20,
      submenu: () => ({
        title: 'Freeze',
        items: [leaf('start', 'At start'), leaf('end', 'At end')],
      }),
    } as HeaderAction,
  ] as (RowAction | HeaderAction)[],
  contextMenuActions: [leaf('inspect', 'Inspect')],
})

const DATA = Array.from({ length: 60 }, (_, i) => ({
  id: `r${i}`,
  name: `Name ${i}`,
  city: `City ${i % 7}`,
}))

// Колонки — вне рендера: новая ссылка пересоздаёт модель и ячейки.
const COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name' },
  { id: 'city', accessorKey: 'city', header: 'City' },
]

const Grid = ({ menus, keyboard }: { menus: boolean; keyboard: boolean }) => {
  const table = useCreateTable({
    enableKeyboardNavigation: keyboard,
    columns: COLUMNS as never,
    data: DATA,
    getRowId: (row: (typeof DATA)[number]) => row.id,
    plugins: [
      probe(),
      rowActions(),
      ...(menus
        ? [
            rowActionMenu({ mode: 'always' }),
            headerActionMenu({ mode: 'always' }),
          ]
        : []),
      contextMenu(),
      rowSelection(),
    ] as never,
  })
  return (
    <div style={{ width: 400, height: 420 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const mount = async ({ menus = true, keyboard = false } = {}) => {
  const screen = await render(<Grid menus={menus} keyboard={keyboard} />)
  await waitForGrid()
  return screen
}

// Панель выгрузки и панель действия заголовка — для MM7.
const donePanel: HeaderAction = {
  ...leaf('done', 'Done'),
  slot: 'rightHeaderSlot',
  order: 0,
  className: () => 'done__button',
  panel: (_, { close }) => (
    <button type="button" data-testid="done-panel-close" onClick={close}>
      Done
    </button>
  ),
}
const popoverProbe = definePlugin()({
  id: 'popoverProbe',
  slotActions: [
    { ...leaf('archive', 'Archive'), slot: 'actionRowSlot', order: 0 },
    donePanel,
  ] as (RowAction | HeaderAction)[],
})
const POPOVER_PLUGINS = [
  popoverProbe(),
  rowActions(),
  rowActionMenu({ mode: 'always' }),
  dataExport({ onExport: () => new Promise<void>(() => {}) }),
]

const PopoverGrid = () => {
  const table = useCreateTable({
    columns: COLUMNS as never,
    data: DATA,
    getRowId: (row: (typeof DATA)[number]) => row.id,
    enableToolbar: true,
    dataMode: { export: 'server' },
    plugins: POPOVER_PLUGINS as never,
  })
  return (
    <div style={{ width: 900, height: 700 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const viewport = { width: innerWidth, height: innerHeight }

const menu = () => document.querySelector<HTMLElement>('[role="menu"]')
const backdrop = () =>
  document.querySelector('[role="presentation"][data-base-ui-inert]')
const scroller = () =>
  document.querySelector<HTMLElement>('.data-grid__container')!
const row = (id: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${id}"]`,
  )!
const cell = (id: string, column = 'name') =>
  row(id).querySelector<HTMLElement>(`[data-column-id="${column}"]`)!
const rowKebab = (id: string) =>
  row(id).querySelector<HTMLElement>(`[aria-label^="${tableLabels.rowMenu}"]`)
const headCell = (id: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__head-cell[data-column-id="${id}"]`,
  )!

const openRowMenu = async (id: string) => {
  await userEvent.hover(cell(id))
  await expect.poll(() => rowKebab(id)).not.toBeNull()
  await humanClick(rowKebab(id)!)
  await expect.poll(menu).not.toBeNull()
}
const menuClosed = () => expect.poll(menu).toBeNull()
const pageScrollLocked = () =>
  [document.documentElement, document.body].some(
    el => getComputedStyle(el).overflow === 'hidden',
  )

let slowClose: HTMLStyleElement | undefined
afterEach(() => {
  slowClose?.remove()
  slowClose = undefined
})

describe('Немодальные меню', () => {
  test('MM1: кебабы заголовка и строки, инлайн-меню, контекстное меню и меню ручек — без подложки и без блокировки прокрутки страницы', async () => {
    const expectNonModal = async () => {
      await expect.poll(menu).not.toBeNull()
      expect(backdrop()).toBeNull()
      expect(pageScrollLocked()).toBe(false)
      await userEvent.keyboard('{Escape}')
      await menuClosed()
    }

    const screen = await mount()
    await openRowMenu('r1')
    await expectNonModal()

    await userEvent.hover(headCell('city'))
    await humanClick(
      headCell('city').querySelector<HTMLElement>(
        `[aria-label^="${tableLabels.headerMenu}"]`,
      )!,
    )
    await expectNonModal()

    await userEvent.click(cell('r2'), { button: 'right' })
    await expectNonModal()

    await screen.unmount()

    const handles = await renderHandleGrid()
    await userEvent.hover(handleCell())
    await humanClick(columnHandle())
    await expectNonModal()
    await handles.unmount()

    await mount({ menus: false })
    await userEvent.hover(headCell('city'))
    await humanClick(
      headCell('city').querySelector<HTMLElement>('[aria-label="Freeze"]')!,
    )
    await expectNonModal()
  })

  test.each([false, true])(
    'MM2: keyboardNavigation %s — нажатие мимо меню закрывает его и доходит до цели: флажок выбирает строку, ячейка становится активной',
    async keyboard => {
      await mount({ keyboard })

      await openRowMenu('r1')
      const checkbox = () =>
        row('r3').querySelector<HTMLElement>('[role="checkbox"]')!
      await humanClick(checkbox())
      await menuClosed()
      await expect
        .poll(() => checkbox().getAttribute('aria-checked'))
        .toBe('true')

      if (keyboard) {
        await openRowMenu('r1')
        await humanClick(cell('r5'))
        await menuClosed()
        await expect.poll(() => document.activeElement).toBe(cell('r5'))
        expect(cell('r5').getAttribute('tabindex')).toBe('0')
      }
    },
  )

  test('MM4: прокрутка грида колесом закрывает меню; прокрутка, которую делает сам грид, — нет', async () => {
    await mount()
    await openRowMenu('r1')
    // Прокрутка без жеста пользователя (как к активной ячейке) меню не закрывает.
    scroller().scrollTop = 30
    await expect.poll(() => scroller().scrollTop).toBeGreaterThan(0)
    await new Promise(resolve => setTimeout(resolve, 150))
    expect(menu()).not.toBeNull()

    const box = scroller().getBoundingClientRect()
    await pointer.realWheel(
      { x: box.left + 60, y: box.top + box.height / 2 },
      40,
      1,
      30,
    )
    // Строка с кебабом остаётся на виду: закрывает жест, а не уход кнопки.
    expect(rowKebab('r1')!.getBoundingClientRect().bottom).toBeGreaterThan(
      box.top,
    )
    await menuClosed()
  })

  test('MM5: нажатие на другой триггер при открытом меню открывает его одним нажатием; повторное нажатие на свой — закрывает', async () => {
    await mount()
    await openRowMenu('r1')
    // Строка ниже меню: кебаб соседней строки оно закрывает.
    await userEvent.hover(cell('r6'))
    await expect.poll(() => rowKebab('r6')).not.toBeNull()
    await humanClick(rowKebab('r6')!)
    await expect
      .poll(() => rowKebab('r6')?.getAttribute('aria-expanded'))
      .toBe('true')
    expect(rowKebab('r1')?.getAttribute('aria-expanded')).not.toBe('true')
    // Первое меню доигрывает закрытие.
    await expect
      .poll(() => document.querySelectorAll('[role="menu"]').length)
      .toBe(1)

    await humanClick(rowKebab('r6')!)
    await menuClosed()

    await userEvent.click(cell('r3'), { button: 'right' })
    await expect.poll(menu).not.toBeNull()
    const first = menu()!.getBoundingClientRect().top
    await userEvent.click(cell('r6'), { button: 'right' })
    await expect
      .poll(() => menu()?.getBoundingClientRect().top ?? first)
      .toBeGreaterThan(first)
    // Первое меню доигрывает закрытие.
    await expect
      .poll(() => document.querySelectorAll('[role="menu"]').length)
      .toBe(1)
    await userEvent.keyboard('{Escape}')
    await menuClosed()
  })

  test('MM6: меню, закрытое выбором пункта, не возвращает фокус на свой триггер, если до конца закрытия нажат другой триггер: второе меню остаётся открытым с фокусом — кебабы строки и заголовка, инлайн-меню', async () => {
    // Закрытие длиннее нажатия: нажатие на другой триггер всегда приходится на него.
    slowClose = document.createElement('style')
    slowClose.textContent = `.data-grid-theme[role="menu"] { --tsr-comp-tooltip-transition: opacity 1s linear, transform 1s linear; }`
    document.head.append(slowClose)
    const menus = () => [...document.querySelectorAll('[role="menu"]')]
    const pick = async (label: string) => {
      const item = [
        ...document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
      ].find(
        each =>
          (
            each.querySelector('[data-popup-item-label]') ?? each
          ).textContent?.trim() === label,
      )!
      await humanClick(item)
    }
    const pressRowKebab = async () => {
      await userEvent.hover(cell('r6'))
      await expect.poll(() => rowKebab('r6')).not.toBeNull()
      await humanClick(rowKebab('r6')!)
    }
    // Прежнее меню ещё закрывается; когда оно уходит, второе открыто и держит фокус.
    const secondKeepsFocus = async () => {
      expect(menus().length).toBe(2)
      await expect.poll(() => menus().length, { timeout: 3000 }).toBe(1)
      await new Promise(resolve => setTimeout(resolve, 100))
      expect(menus().length).toBe(1)
      expect(menu()!.hasAttribute('data-ending-style')).toBe(false)
      expect(menu()!.contains(document.activeElement)).toBe(true)
      await userEvent.keyboard('{Escape}')
      await menuClosed()
    }

    const screen = await mount()
    await openRowMenu('r1')
    await pick('Archive')
    await pressRowKebab()
    await secondKeepsFocus()

    await userEvent.hover(headCell('city'))
    await humanClick(
      headCell('city').querySelector<HTMLElement>(
        `[aria-label^="${tableLabels.headerMenu}"]`,
      )!,
    )
    await expect.poll(menu).not.toBeNull()
    await pick('Freeze')
    await pick('At start')
    await pressRowKebab()
    await secondKeepsFocus()
    await screen.unmount()

    await mount({ menus: false })
    await userEvent.hover(headCell('city'))
    await humanClick(
      headCell('city').querySelector<HTMLElement>('[aria-label="Freeze"]')!,
    )
    await expect.poll(menu).not.toBeNull()
    await pick('At start')
    await userEvent.click(cell('r6'), { button: 'right' })
    await secondKeepsFocus()
  })

  const byTestId = (id: string) =>
    document.querySelector<HTMLElement>(`[data-testid="${id}"]`)
  /** Поповер, его кнопка и своя кнопка поповера, которая его закрывает. */
  const POPOVERS = {
    export: {
      open: () => byTestId('export-button'),
      popup: () => byTestId('export-panel'),
      close: () => humanClick(byTestId('export-run')!),
    },
    panel: {
      open: () => headCell('name').querySelector<HTMLElement>('.done__button'),
      popup: () => document.querySelector('[data-action-panel="done"]'),
      close: () => humanClick(byTestId('done-panel-close')!),
    },
  }

  test.each(['export', 'panel'] as const)(
    'MM7: %s — поповер, закрытый своей кнопкой, не возвращает фокус на кнопку, открывшую его, если до конца закрытия нажат кебаб: меню кебаба держит фокус',
    async name => {
      const { open, popup, close } = POPOVERS[name]
      await page.viewport(1280, 900)
      await render(<PopoverGrid />)
      await waitForGrid()
      await userEvent.hover(headCell('name'))
      // Кнопки тулбара и заголовка — из ленивых чанков: ждём настоящий триггер.
      await expect
        .poll(() => open()?.id.startsWith('base-ui') ?? false)
        .toBe(true)
      await humanClick(open()!)
      await expect.poll(() => popup()?.hasAttribute('data-open')).toBe(true)
      // Закрытие длиннее нажатия: нажатие на кебаб всегда приходится на него. Только
      // после проявления: из прозрачного поповера закрыться нечему, он уходит сразу.
      await expect.poll(() => getComputedStyle(popup()!).opacity).toBe('1')
      // Закрытие длиннее нажатия: нажатие на кебаб всегда приходится на него.
      slowClose = document.createElement('style')
      slowClose.textContent = `.data-grid-theme:is([data-testid="export-panel"], [data-action-panel]) { --tsr-comp-tooltip-transition: opacity 3s linear, transform 3s linear; }`
      document.head.append(slowClose)
      await close()

      await userEvent.hover(cell('r12'))
      await expect.poll(() => rowKebab('r12')).not.toBeNull()
      await humanClick(rowKebab('r12')!)
      await expect.poll(menu).not.toBeNull()
      expect(popup()).not.toBeNull()
      await expect.poll(popup, { timeout: 6000 }).toBeNull()
      await new Promise(resolve => setTimeout(resolve, 100))
      expect(menu()!.hasAttribute('data-ending-style')).toBe(false)
      expect(menu()!.contains(document.activeElement)).toBe(true)
      await page.viewport(viewport.width, viewport.height)
    },
  )

  test('MM3: меню, открытое нажатием на кебаб закреплённой справа колонки, остаётся открытым после отпускания кнопки', async () => {
    await render(<composed.RowActionsPlayground {...rowAsyncArgs} />)
    await waitForGrid()
    const first = rowsTopDown()[0]!
    const kebab = () =>
      first.querySelector<HTMLElement>(`[aria-label^="${tableLabels.rowMenu}"]`)
    await userEvent.hover(first)
    await expect.poll(kebab).not.toBeNull()
    expect(
      kebab()!.closest('[data-cell-pinned]')?.getAttribute('data-cell-pinned'),
    ).toBe('right')
    await humanClick(kebab()!)
    await expect.poll(menu).not.toBeNull()
    await new Promise(resolve => setTimeout(resolve, 300))
    expect(menu()).not.toBeNull()
    await userEvent.keyboard('{Escape}')
    await menuClosed()
  })
})
