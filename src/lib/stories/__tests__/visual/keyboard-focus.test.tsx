import { useState } from 'react'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { composeStories } from '@storybook/react-vite'
import { composed } from '../stories'
import * as cellsErrors from '../../DataGrid.Cells.Errors.stories'
import { tableLabels } from '../labels'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  columnFiltering,
  columnSorting,
  pagination,
  rowDragging,
  rowExpanding,
  unsavedChanges,
} from '../../../plugins'
import { paginationLabels } from '../../../plugins/pagination/labels'
import { unsavedChangesLabels } from '../../../plugins/unsavedChanges/labels'
import { overflowColumns, overflowData } from '../../__mocks__/overflowColumns'
import { waitForGrid } from './core-helpers'
import { contrast, effectiveBg, inBothThemes, toRgba } from './a11y-helpers'

// Фокус с клавиатуры (ADR 0232, KX5–KX9): видим, не перекрыт, не теряется, подсказки по фокусу.

const FOCUSABLE = [
  'button',
  'input',
  'select',
  'textarea',
  'a[href]',
  '[role="button"]',
  '[role="checkbox"]',
  '[role="switch"]',
  '[role="separator"][tabindex]',
  '[role="radio"]',
  '[role="combobox"]',
  '[role="gridcell"]',
  '[role="columnheader"]',
  '[role="rowheader"]',
].join(',')

const visible = (el: HTMLElement) => {
  const box = el.getBoundingClientRect()
  return (
    box.width > 0 &&
    box.height > 0 &&
    getComputedStyle(el).visibility !== 'hidden' &&
    !el.closest('[aria-hidden="true"], [inert]') &&
    !el.hasAttribute('disabled')
  )
}

/** Кольцо фокуса: контур, рамка псевдоэлемента или тень-кольцо элемента; цвет и толщина. */
const ringOf = (el: HTMLElement) => {
  const style = getComputedStyle(el)
  if (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 1)
    return { color: style.outlineColor, width: parseFloat(style.outlineWidth) }
  for (const pseudo of ['::after', '::before']) {
    const part = getComputedStyle(el, pseudo)
    if (
      part.content !== 'none' &&
      part.borderTopStyle !== 'none' &&
      parseFloat(part.borderTopWidth) >= 1
    )
      return {
        color: part.borderTopColor,
        width: parseFloat(part.borderTopWidth),
      }
  }
  const shadow = style.boxShadow
  if (shadow && shadow !== 'none') {
    // `rgb(...) 0px 0px 0px 2px` — тень без размытия с разбросом.
    for (const part of shadow.split(/,(?![^(]*\))/)) {
      const color = /rgba?\([^)]*\)|oklch\([^)]*\)|#[0-9a-f]+/i.exec(part)?.[0]
      const sizes = part
        .replace(color ?? '', '')
        .trim()
        .split(/\s+/)
        .map(parseFloat)
      const [, , blur = 0, spread = 0] = sizes
      if (color && spread >= 1 && blur === 0) return { color, width: spread }
    }
  }
  return null
}

/** Пункт списка поповера: индикатор фокуса — подсветка пункта (шаблон меню WAI-ARIA). */
const LIST_ITEM = '[role^="menuitem"], [role="option"], [data-popup-nav-item]'

const frame = () => new Promise(resolve => requestAnimationFrame(resolve))
const settleAnimations = () =>
  document
    .getAnimations()
    .filter(a => a.effect?.getTiming().iterations !== Infinity)
    .forEach(a => a.finish())

/** Контролы на экране без индикатора фокуса или с кольцом ниже 3:1 к фону. */
const ringProblems = async (scope: ParentNode) => {
  const problems: string[] = []
  const controls = [...scope.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    visible,
  )
  for (const target of controls) {
    if (!target.isConnected) continue
    if (target.matches(LIST_ITEM)) {
      // Замер без фокуса на пункте: первый пункт получает фокус при открытии.
      target
        .closest<HTMLElement>('[role="dialog"], [role="menu"]')
        ?.focus({ preventScroll: true })
      await frame()
      settleAnimations()
      const before = effectiveBg(target)
      target.focus({ preventScroll: true })
      await frame()
      settleAnimations()
      if (document.activeElement !== target) continue
      const after = effectiveBg(target)
      if (contrast(before, after) < 1.05 && !ringOf(target))
        problems.push(
          `${target.textContent?.trim().slice(0, 30)}: пункт без подсветки`,
        )
      continue
    }
    target.focus({ preventScroll: true })
    await frame()
    await frame()
    // Ленивая заглушка сменяется кнопкой с тем же фокусом (ADR 0061, LZ25).
    const el = (
      target.isConnected ? target : document.activeElement
    ) as HTMLElement
    if (el === document.body || document.activeElement !== el) continue
    settleAnimations()
    const ring = ringOf(el)
    const name = `${el.tagName.toLowerCase()}[${el.getAttribute('role') ?? ''}] ${
      el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 30)
    } (${el.className.toString().slice(0, 40)})`
    if (!ring) {
      problems.push(`${name}: нет кольца`)
      continue
    }
    const ratio = contrast(
      toRgba(ring.color),
      effectiveBg(el.parentElement ?? el),
    )
    if (ratio < 3) problems.push(`${name}: ${ratio.toFixed(2)}:1`)
  }
  return problems
}

describe('Фокус с клавиатуры (ADR 0232)', () => {
  test('KX5: фокус с клавиатуры виден у каждого контрола грида, панелей и поповеров: кольцо из токена, не ниже 3:1 к фону; у пунктов списков поповеров — подсветка пункта, как в шаблоне меню WAI-ARIA', async () => {
    const screen = await render(
      <composed.DataGridPlayground
        enableKeyboardNavigation={false}
        enableColumnSorting
        enableColumnFiltering
        enableColumnPinning
        enableColumnSizing
        enableColumnDragging
        enableColumnVisibility
        enableRowSelection
        enableRowDragging
        enableRowActions
        enableCellEditing
        enableQuickSearch
        enableDataExport
        enablePagination
        enableHeaderActionMenu
        enableFooter
        columnCount={5}
        dataCount={12}
        containerHeight="560"
        height="520"
      />,
    )
    await waitForGrid()
    // Клавиатурный ввод: `:focus-visible` у фокуса от скрипта.
    await userEvent.keyboard('{Tab}')
    const all: string[] = []
    await inBothThemes(async () => {
      all.push(...(await ringProblems(screen.container)))
    })
    await screen.unmount()

    // Навигация по ячейкам: ячейки и заголовки — свои кольца.
    const nav = await render(
      <composed.DataGridPlayground
        enableKeyboardNavigation
        enableColumnSorting
        enableRowSelection
        enableCellEditing
        enableFooter
        columnCount={5}
        dataCount={12}
        containerHeight="560"
        height="520"
      />,
    )
    await waitForGrid()
    await userEvent.keyboard('{Tab}')
    await inBothThemes(async () => {
      all.push(...(await ringProblems(nav.container)))
    })
    await nav.unmount()

    // Поповеры: меню колонки, «Настройки вида», панели фильтра и выгрузки.
    const pop = await render(
      <composed.DataGridPlayground
        enableColumnSorting
        enableColumnFiltering
        enableColumnPinning
        enableColumnVisibility
        enableDataExport
        enableHeaderActionMenu
        headerActionMenuMode="always"
        columnCount={5}
        dataCount={12}
        containerHeight="560"
        height="520"
      />,
    )
    await waitForGrid()
    const openers: [string, () => HTMLElement | null][] = [
      [
        'kebab',
        () =>
          document.querySelector('.data-grid__head-cell [data-action-menu]'),
      ],
      [
        'view',
        () => document.querySelector('[data-testid="view-settings-button"]'),
      ],
      ['export', () => document.querySelector('[data-testid="export-button"]')],
    ]
    for (const [name, opener] of openers) {
      await expect.poll(opener, { message: name }).not.toBeNull()
      opener()!.focus()
      await userEvent.keyboard('{Enter}')
      const popup = () =>
        [
          ...document.querySelectorAll<HTMLElement>(
            '[role="menu"], [role="dialog"]',
          ),
        ].pop()
      await expect.poll(popup, { message: name }).toBeTruthy()
      await new Promise(resolve => setTimeout(resolve, 300))
      await inBothThemes(async () => {
        all.push(
          ...(await ringProblems(popup()!)).map(line => name + ': ' + line),
        )
      })
      await userEvent.keyboard('{Escape}')
      await expect.poll(popup, { message: name }).toBeFalsy()
    }
    expect([...new Set(all)]).toEqual([])
  })
})

describe('Фокус не перекрыт (ADR 0232)', () => {
  const scroller = () =>
    document.querySelector<HTMLElement>('.data-grid__container')!
  const rowAt = (index: number) =>
    document.querySelector<HTMLElement>(
      `.data-grid__body-row[data-index='${index}']`,
    )!
  const cellIn = (row: HTMLElement, column: string) =>
    row.querySelector<HTMLElement>(`[data-column-id='${column}']`)!
  const active = () => document.activeElement as HTMLElement
  const box = (el: Element | null) => el!.getBoundingClientRect()
  const settle = async () => {
    for (let i = 0; i < 4; i++) await frame()
  }
  /** Фокус на ячейке с клавиатурным признаком: шаг стрелкой и обратно. */
  const focusCell = async (cell: () => HTMLElement) => {
    cell().focus({ preventScroll: true })
    await userEvent.keyboard('{ArrowRight}{ArrowLeft}')
    await settle()
  }
  const TOLERANCE = 0.5

  test('KX6: активную ячейку не перекрывают липкая шапка, футер, закреплённые колонки и липкие строки: после перехода она видна целиком', async () => {
    const screen = await render(
      <composed.DataGridPlayground
        enableKeyboardNavigation
        enableFooter
        enableColumnPinning
        initialColumnPinning={{ start: ['country'], end: [] }}
        columnCount={8}
        dataCount={60}
        containerHeight="460"
        height="420"
        containerWidth={560}
      />,
    )
    await waitForGrid()
    const head = () => box(document.querySelector('.data-grid__head'))
    const footer = () => box(document.querySelector('.data-grid__footer'))

    // Шапка: строка выше активной наполовину под шапкой.
    scroller().scrollTop = 400
    await settle()
    const visibleRows = () =>
      [...document.querySelectorAll<HTMLElement>('.data-grid__body-row')]
        .map(row => Number(row.dataset.index))
        .sort((a, b) => a - b)
    const under = visibleRows().find(
      index => box(rowAt(index)).bottom > head().bottom,
    )!
    const below = under + 1
    await focusCell(() => cellIn(rowAt(below), 'firstName'))
    const half = box(rowAt(under)).height / 2
    scroller().scrollTop += box(rowAt(under)).top - (head().bottom - half)
    await settle()
    expect(box(rowAt(under)).top).toBeLessThan(head().bottom - 1)
    await userEvent.keyboard('{ArrowUp}')
    await settle()
    expect(
      active().closest('.data-grid__body-row')?.getAttribute('data-index'),
    ).toBe(String(under))
    expect(box(active()).top).toBeGreaterThanOrEqual(head().bottom - TOLERANCE)

    // Футер: строка ниже активной наполовину под футером.
    const lastShown = () =>
      visibleRows()
        .filter(index => box(rowAt(index)).top < footer().top)
        .pop()!
    const target = lastShown()
    await focusCell(() => cellIn(rowAt(target - 1), 'firstName'))
    const halfDown = box(rowAt(target)).height / 2
    scroller().scrollTop +=
      box(rowAt(target)).bottom - (footer().top + halfDown)
    await settle()
    expect(box(rowAt(target)).bottom).toBeGreaterThan(footer().top + 1)
    await userEvent.keyboard('{ArrowDown}')
    await settle()
    expect(
      active().closest('.data-grid__body-row')?.getAttribute('data-index'),
    ).toBe(String(target))
    expect(box(active()).bottom).toBeLessThanOrEqual(footer().top + TOLERANCE)

    // Закреплённая слева колонка: колонка правее неё наполовину под ней.
    const row = () => active().closest<HTMLElement>('.data-grid__body-row')!
    await focusCell(() => cellIn(row(), 'lastName'))
    const pinned = () => box(cellIn(row(), 'country'))
    const first = () => cellIn(row(), 'firstName')
    scroller().scrollLeft +=
      box(first()).left - (pinned().right - box(first()).width / 2)
    await settle()
    expect(box(first()).left).toBeLessThan(pinned().right - 1)
    await userEvent.keyboard('{ArrowLeft}')
    await settle()
    expect(active().getAttribute('data-column-id')).toBe('firstName')
    expect(box(active()).left).toBeGreaterThanOrEqual(
      pinned().right - TOLERANCE,
    )
    await screen.unmount()

    // Липкие строки групп: строка под стопкой.
    await render(
      <composed.DataGridPlayground
        enableKeyboardNavigation
        enableRowGrouping
        rowGroupingStickyRows
        initialGrouping={['gender']}
        enableRowExpanding
        initialExpanded
        columnCount={6}
        dataCount={60}
        containerHeight="460"
        height="420"
      />,
    )
    await waitForGrid()
    scroller().scrollTop = 600
    await settle()
    const stuck = () => [
      ...document.querySelectorAll<HTMLElement>(
        '[data-sticky-rows] [data-row-id]',
      ),
    ]
    await expect.poll(() => stuck().length).toBeGreaterThan(0)
    const stackBottom = () =>
      Math.max(head().bottom, ...stuck().map(r => box(r).bottom))
    const dataRows = () =>
      [
        ...document.querySelectorAll<HTMLElement>(
          '.data-grid__body-row[data-row-id]',
        ),
      ]
        .filter(
          r =>
            !r.closest('[data-sticky-rows]') &&
            !r.querySelector('[data-group-value]') &&
            box(r).bottom > stackBottom(),
        )
        .sort((x, y) => box(x).top - box(y).top)
    const hiddenId = dataRows()[0]!.dataset.rowId!
    const nextId = dataRows()[1]!.dataset.rowId!
    const byId = (id: string) =>
      [
        ...document.querySelectorAll<HTMLElement>(
          `.data-grid__body-row[data-row-id='${id}']`,
        ),
      ].find(r => !r.closest('[data-sticky-rows]'))!
    await focusCell(() => cellIn(byId(nextId), 'firstName'))
    scroller().scrollTop +=
      box(byId(hiddenId)).top - (stackBottom() - box(byId(hiddenId)).height / 2)
    await settle()
    expect(box(byId(hiddenId)).top).toBeLessThan(stackBottom() - 1)
    await userEvent.keyboard('{ArrowUp}')
    await settle()
    expect(
      active().closest('.data-grid__body-row')?.getAttribute('data-row-id'),
    ).toBe(hiddenId)
    expect(box(active()).top).toBeGreaterThanOrEqual(stackBottom() - TOLERANCE)
  })
})

describe('Нет ловушки фокуса (ADR 0232)', () => {
  const POPUP =
    '[role="menu"], [role="dialog"], [role="listbox"], [role="alertdialog"]'
  /** Открытые поповеры: закрывающийся доигрывает выход и не в счёт. */
  const popups = () =>
    [...document.querySelectorAll<HTMLElement>(POPUP)].filter(
      popup =>
        !popup.hasAttribute('data-ending-style') &&
        !popup.closest('[data-ending-style]') &&
        popup.getBoundingClientRect().height > 0,
    )
  const testId = (id: string) => () =>
    document.querySelector<HTMLElement>(`[data-testid="${id}"]`)
  const pause = (ms = 250) => new Promise(resolve => setTimeout(resolve, ms))
  /** Источник поповера: тот же узел или его замена с тем же признаком. */
  const sameTrigger = (get: () => HTMLElement | null) =>
    document.activeElement === get()

  test('KX7: из каждого поповера, панели и редактора `Escape` закрывает их и возвращает фокус на кнопку-источник; `Tab` выводит фокус дальше', async () => {
    const mountGrid = (nav: boolean) =>
      render(
        <composed.DataGridPlayground
          enableKeyboardNavigation={nav}
          enableColumnSorting
          enableColumnFiltering
          enableColumnPinning
          enableColumnVisibility
          enableColumnSizing
          enableDataExport
          enablePagination
          enableHeaderActionMenu
          headerActionMenuMode="always"
          enableRowActions
          enableRowActionMenu
          rowActionMenuMode="always"
          enableCellEditing
          enableCellSelection
          enableContextMenu
          enableEditHistory
          enableFailureLog
          enableUnsavedChanges
          columnCount={5}
          dataCount={30}
          containerHeight="560"
          height="520"
        />,
      )
    // Без навигации по ячейкам кнопки шапки, строк и панелей — в обходе Tab.
    const plain = await mountGrid(false)
    await waitForGrid()
    await userEvent.keyboard('{Tab}')
    const problems: string[] = []

    /** Открыть клавишами `open` на источнике, закрыть Escape, затем открыть и уйти Tab. */
    const check = async (
      name: string,
      trigger: () => HTMLElement | null,
      open: string,
    ) => {
      await expect.poll(trigger, { message: name }).not.toBeNull()
      trigger()!.focus()
      await userEvent.keyboard(open)
      await expect
        .poll(() => popups().length, { message: `${name}: открытие` })
        .toBeGreaterThan(0)
      await pause()
      await userEvent.keyboard('{Escape}')
      await pause()
      if (popups().length > 0) problems.push(`${name}: Escape не закрыл`)
      else if (!sameTrigger(trigger))
        problems.push(
          `${name}: фокус после Escape — ${document.activeElement?.outerHTML.slice(0, 80)}`,
        )
      // Tab: фокус не заперт — после серии Tab он вне поповера.
      trigger()!.focus()
      await userEvent.keyboard(open)
      await expect.poll(() => popups().length).toBeGreaterThan(0)
      await pause()
      for (let i = 0; i < 30; i++) {
        const inside = popups().some(popup =>
          popup.contains(document.activeElement),
        )
        if (!inside) break
        await userEvent.keyboard('{Tab}')
      }
      if (popups().some(popup => popup.contains(document.activeElement)))
        problems.push(`${name}: Tab не выводит фокус`)
      // Уборка: немодальный поповер, из которого ушёл фокус, закрывает Escape изнутри.
      for (let i = 0; i < 4 && popups().length > 0; i++) {
        const popup = popups().pop()!
        popup.querySelector<HTMLElement>('button, [tabindex], input')?.focus()
        await userEvent.keyboard('{Escape}')
        await pause()
      }
    }

    await check(
      'меню колонки',
      () => document.querySelector('.data-grid__head-cell [data-action-menu]'),
      '{Enter}',
    )
    await check('настройки вида', testId('view-settings-button'), '{Enter}')
    await check('выгрузка', testId('export-button'), '{Enter}')
    await check('размер страницы', testId('page-size-select'), '{Enter}')
    await check('журнал отказов', testId('failure-log-button'), '{Enter}')
    await check('пульт', testId('unsaved-changes-button'), '{Enter}')
    await check('история правок', testId('edit-history-button'), '{Enter}')

    // Меню строки.
    await check(
      'меню строки',
      () =>
        document.querySelector<HTMLElement>(
          ".data-grid__body-row[data-index='2'] [data-action-menu]",
        ),
      '{Enter}',
    )
    await plain.unmount()

    // Контекстное меню и редактор ячейки — с навигацией; источник — ячейка.
    await mountGrid(true)
    await waitForGrid()
    const cell = () =>
      document.querySelector<HTMLElement>(
        ".data-grid__body-row[data-index='2'] [data-column-id='age']",
      )
    cell()!.focus()
    await userEvent.keyboard('{ArrowRight}{ArrowLeft}')
    const activeCell = () => document.activeElement as HTMLElement
    const at = activeCell()
    await check('контекстное меню', () => at, '{Shift>}{F10}{/Shift}')
    // Редактор: Escape закрывает поле и возвращает фокус ячейке.
    at.focus()
    await userEvent.keyboard('{Enter}')
    await expect.poll(() => at.querySelector('input')).not.toBeNull()
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => at.querySelector('input')).toBeNull()
    if (document.activeElement !== at)
      problems.push('редактор: фокус после Escape не на ячейке')
    expect(problems).toEqual([])
  })
})

describe('Фокус не теряется (ADR 0232)', () => {
  interface Item {
    id: string
    name: string
    amount: number
    subRows?: Item[]
  }
  const ITEMS: Item[] = Array.from({ length: 30 }, (_, index) => ({
    id: `r${index}`,
    name: `Name ${index}`,
    amount: index,
  }))
  const TREE: Item[] = ITEMS.slice(0, 6).map(item => ({
    ...item,
    subRows: [0, 1].map(child => ({
      ...item,
      id: `${item.id}-${child}`,
      name: `${item.name}.${child}`,
    })),
  }))
  const COLUMNS = [
    { id: 'name', accessorKey: 'name', header: 'Name', size: 180 },
    { id: 'amount', accessorKey: 'amount', header: 'Amount', size: 140 },
  ]

  type Api = {
    table: unknown
    setData: (update: (data: Item[]) => Item[]) => void
  }
  let api: Api

  const Grid = ({
    data: initial = ITEMS,
    plugins,
    options,
  }: {
    data?: Item[]
    plugins: unknown[]
    options?: Record<string, unknown>
  }) => {
    const [data, setData] = useState(initial)
    const table = useCreateTable({
      columns: COLUMNS as never,
      data,
      getRowId: (row: Item) => row.id,
      getSubRows: (row: Item) => row.subRows,
      enableKeyboardNavigation: true,
      enableStatusBar: true,
      plugins: plugins as never,
      ...options,
    })
    api = { table, setData }
    return (
      <div style={{ height: 520 }}>
        <DataGrid table={table as never} height={480} />
      </div>
    )
  }

  const settle = async () => {
    for (let i = 0; i < 4; i++) await frame()
  }
  const lost = () =>
    document.activeElement === document.body || !document.activeElement
  const cellOf = (rowId: string, column = 'name') =>
    document.querySelector<HTMLElement>(
      `.data-grid__body-row[data-row-id='${rowId}'] [data-column-id='${column}']`,
    )
  const focusCell = async (rowId: string) => {
    await expect.poll(() => cellOf(rowId)).not.toBeNull()
    cellOf(rowId)!.focus()
    await userEvent.keyboard('{ArrowRight}{ArrowLeft}')
    await settle()
    expect(
      document.activeElement
        ?.closest('[data-row-id]')
        ?.getAttribute('data-row-id'),
    ).toBe(rowId)
  }

  test('KX8: после закрытия, удаления и вставки строки, переноса, отказа, смены страницы и сворачивания группы с фокусом внутри фокус не на `body`', async () => {
    const problems: string[] = []
    const expectKept = async (what: string) => {
      await settle()
      await new Promise(resolve => setTimeout(resolve, 200))
      if (lost()) problems.push(what)
    }

    // Удаление строки с фокусом и вставка строки перед ней.
    let screen = await render(<Grid plugins={[]} />)
    await waitForGrid()
    await focusCell('r3')
    api.setData(data => data.filter(row => row.id !== 'r3'))
    await expectKept('удаление строки')
    await focusCell('r5')
    api.setData(data => [
      ...data.slice(0, 4),
      { id: 'new', name: 'New', amount: 0 },
      ...data.slice(4),
    ])
    await expectKept('вставка строки')
    await screen.unmount()

    // Перенос строки клавишами.
    screen = await render(<Grid plugins={[rowDragging()]} />)
    await waitForGrid()
    await focusCell('r2')
    await userEvent.keyboard('{Alt>}{Shift>}{ArrowDown}{/Shift}{/Alt}')
    await expectKept('перенос строки')
    await screen.unmount()

    // Отказ сервера: сортировка с клавиатуры, сервер отказал.
    screen = await render(
      <Grid
        plugins={[
          columnSorting({
            onToggleColumnSort: () => Promise.reject(new Error('Refused')),
          }),
        ]}
        options={{ dataMode: { sorting: 'server' } }}
      />,
    )
    await waitForGrid()
    await focusCell('r1')
    await userEvent.keyboard('{Control>}{ArrowUp}{/Control}')
    await settle()
    await userEvent.keyboard('{Enter}')
    await new Promise(resolve => setTimeout(resolve, 400))
    await expectKept('отказ сервера')
    await screen.unmount()

    // Смена страницы: «Следующая» на последней странице выключается.
    screen = await render(
      <Grid
        plugins={[pagination({ initialPageSize: 10, pageNumbers: false })]}
      />,
    )
    await waitForGrid()
    const next = () =>
      document.querySelector<HTMLElement>(
        `[aria-label="${paginationLabels(tableLabels).nextPage}"]`,
      )!
    next().focus()
    for (let page = 0; page < 3; page++) {
      await userEvent.keyboard('{Enter}')
      await settle()
    }
    await expectKept('смена страницы до последней')
    // Закрытие поповера выбором варианта: размер страницы.
    document
      .querySelector<HTMLElement>('[data-testid="page-size-select"]')!
      .focus()
    await userEvent.keyboard('{Enter}')
    await expect
      .poll(() => document.querySelector('[role="listbox"]'))
      .not.toBeNull()
    await userEvent.keyboard('{ArrowDown}{Enter}')
    await expect
      .poll(() =>
        [...document.querySelectorAll('[role="listbox"]')].some(
          list =>
            list.getBoundingClientRect().height > 0 &&
            !list.closest('[data-ending-style]'),
        ),
      )
      .toBe(false)
    await expectKept('закрытие поповера выбором')
    await screen.unmount()

    // Сворачивание ветки, в которой фокус.
    await render(
      <Grid data={TREE} plugins={[rowExpanding({ initialExpanded: true })]} />,
    )
    await waitForGrid()
    await focusCell('r1-1')
    ;(
      api.table as { toggleAllRowsExpanded: (value: boolean) => void }
    ).toggleAllRowsExpanded(false)
    await expectKept('сворачивание группы с фокусом внутри')

    expect(problems).toEqual([])
  })
})

const ErrorsStories = composeStories(cellsErrors)

describe('Подсказки по фокусу (ADR 0232)', () => {
  const tips = () =>
    [...document.querySelectorAll('[data-tooltip-popup]')]
      .filter(
        tip =>
          !tip.closest('[data-ending-style]') &&
          tip.getBoundingClientRect().height > 0,
      )
      .map(tip => tip.textContent?.trim() ?? '')
  const pause = (ms = 400) => new Promise(resolve => setTimeout(resolve, ms))

  test('KX9: подписи значков, цветные точки, ошибка ячейки, обрезанный текст, итоги и счётчики показывает фокус с клавиатуры; `Escape` скрывает подсказку, фокус остаётся', async () => {
    const problems: string[] = []
    /** Подсказка `text` видна при фокусе на `target`; Escape её скрывает, фокус на месте. */
    const check = async (
      name: string,
      target: () => HTMLElement,
      text: string,
      keep: () => boolean = () => document.activeElement === target(),
    ) => {
      await expect
        .poll(tips, { timeout: 3000, message: name })
        .toContainEqual(expect.stringContaining(text))
        .catch(() => problems.push(`${name}: подсказки нет`))
      if (!tips().some(tip => tip.includes(text))) return
      await userEvent.keyboard('{Escape}')
      await pause()
      if (tips().some(tip => tip.includes(text)))
        problems.push(`${name}: Escape не скрыл`)
      if (!keep()) problems.push(`${name}: фокус ушёл`)
    }

    // Подпись значка и счётчик тулбара — без навигации по ячейкам.
    let screen = await render(
      <composed.DataGridPlayground
        enableColumnSorting
        enableFailureLog
        columnCount={4}
        dataCount={8}
        containerHeight="460"
        height="420"
      />,
    )
    await waitForGrid()
    await userEvent.keyboard('{Tab}')
    const sort = () =>
      document.querySelector<HTMLElement>(
        '.data-grid__head-cell .column-sort__button',
      )!
    sort().focus()
    await check('значок', sort, sort().getAttribute('aria-label')!)
    const log = () =>
      document.querySelector<HTMLElement>('[data-testid="failure-log-button"]')!
    log().focus()
    await check('счётчик', log, log().getAttribute('aria-label')!)
    await screen.unmount()

    // Обрезанный текст тела и итога футера — с навигацией.
    screen = await render(
      <composed.DataGridPlayground
        columnsOverride={overflowColumns}
        dataOverride={overflowData}
        enableFooter
        enableKeyboardNavigation
        containerHeight="560"
        height="460"
      />,
    )
    await waitForGrid()
    const longName = 'Bartholomew Montgomery-Fitzgerald'
    const cell = () =>
      [...document.querySelectorAll<HTMLElement>('[role="gridcell"]')].find(
        el => el.textContent?.includes(longName),
      )!
    cell().focus()
    await userEvent.keyboard('{ArrowRight}{ArrowLeft}')
    await check(
      'обрезанный текст',
      () => document.activeElement as HTMLElement,
      longName,
      () => document.activeElement?.textContent?.includes(longName) ?? false,
    )
    await userEvent.keyboard('{Control>}{ArrowDown}{/Control}{ArrowRight}')
    const footerText = 'Companies registered in total'
    await check(
      'итог футера',
      () => document.activeElement as HTMLElement,
      footerText,
      () => document.activeElement?.textContent?.includes(footerText) ?? false,
    )
    await screen.unmount()

    // Отметка ошибки ячейки: кнопка в ячейке, режим действия.
    screen = await render(
      <ErrorsStories.CellErrorsPlayground enableKeyboardNavigation />,
    )
    await waitForGrid()
    const issue = () =>
      document.querySelector<HTMLElement>('[data-cell-issue]')!
    await expect
      .poll(() => document.querySelector('[data-cell-issue]'))
      .not.toBeNull()
    const issueCell = () => issue().closest<HTMLElement>('[role="gridcell"]')!
    issueCell().focus()
    // Колонка ошибки — последняя: шаг влево и обратно.
    await userEvent.keyboard('{ArrowLeft}{ArrowRight}')
    expect(document.activeElement).toBe(issueCell())
    await userEvent.keyboard('{Control>}{Enter}{/Control}')
    for (let i = 0; i < 4 && document.activeElement !== issue(); i++)
      await userEvent.keyboard('{Tab}')
    const reason = issue().querySelector('[data-visually-hidden]')!.textContent!
    await check('ошибка ячейки', issue, reason, () =>
      issueCell().contains(document.activeElement),
    )
    await screen.unmount()

    // Цветная точка записи пульта: два неприменённых условия фильтра.
    const DraftGrid = () => {
      const table = useCreateTable({
        columns: [
          { id: 'name', accessorKey: 'name', header: 'Name' },
          { id: 'city', accessorKey: 'city', header: 'City' },
        ] as never,
        data: [{ id: '1', name: 'Ann', city: 'Rome' }],
        getRowId: (row: { id: string }) => row.id,
        enableToolbar: true,
        dataMode: { filtering: 'server' },
        initialDrafts: [
          {
            kind: 'columnFilter',
            target: { column: 'name' },
            value: { operator: 'contains', value: 'A' },
          },
          {
            kind: 'columnFilter',
            target: { column: 'city' },
            value: { operator: 'contains', value: 'R' },
          },
        ],
        plugins: [
          columnFiltering({ onFilterChange: () => Promise.resolve() }),
          unsavedChanges(),
        ] as never,
      })
      return (
        <div style={{ height: 400 }}>
          <DataGrid table={table as never} height={360} />
        </div>
      )
    }
    await render(<DraftGrid />)
    await waitForGrid()
    const button = () =>
      document.querySelector<HTMLElement>(
        '[data-testid="unsaved-changes-button"]',
      )!
    await expect
      .poll(() =>
        document.querySelector('[data-testid="unsaved-changes-button"]'),
      )
      .not.toBeNull()
    button().focus()
    await userEvent.keyboard('{Enter}')
    const entry = () =>
      document.querySelector<HTMLElement>(
        '[data-popup-entry] [data-popup-entry-label]',
      )
    await expect.poll(entry, { timeout: 5000 }).not.toBeNull()
    for (let i = 0; i < 6 && document.activeElement !== entry(); i++)
      await userEvent.keyboard('{Tab}')
    const hint = unsavedChangesLabels(tableLabels).markHint
    await check('цветная точка', () => entry()!, hint)

    expect(problems).toEqual([])
  })
})
