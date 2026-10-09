import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  cellSelection,
  columnFiltering,
  columnSorting,
  columnVisibility,
  contextMenu,
  dataExport,
  headerActionMenu,
  pagination,
  rowSelection,
} from '../../../plugins'
import { revealCellButtons } from '../helpers'
import { composed } from '../stories'

// Контракт единого вида поповеров (ADR 0017, PP1–PP3): кебаб, меню колонок, панель
// экспорта, панель фильтра со списком условий и список размера страницы делят
// поверхность, размеры и состояния пунктов.
// Сравниваются вычисленные стили открытых поповеров, а не значения токенов.

const COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name', enableHiding: false },
  { id: 'note', accessorKey: 'note', header: 'Note', filter: 'text' as const },
  { id: 'vip', accessorKey: 'vip', header: 'VIP', filter: 'boolean' as const },
]
const DATA = [
  { id: '1', name: 'Ann', note: 'a', vip: true },
  { id: '2', name: 'Bob', note: 'b', vip: false },
]

const read = (el: Element, prop: string) =>
  getComputedStyle(el).getPropertyValue(prop).trim()

const resolve = (
  token: string,
  prop = 'color',
  theme = 'data-grid-theme',
): string => {
  const probe = document.createElement('div')
  probe.className = theme
  probe.style.setProperty(prop, `var(${token})`)
  document.body.appendChild(probe)
  const value = getComputedStyle(probe).getPropertyValue(prop).trim()
  probe.remove()
  return value
}

interface Popover {
  name: string
  open: () => Promise<void>
  popup: () => HTMLElement
  items: () => HTMLElement[]
  /** Зазор от якоря до поповера по оси открытия, px. */
  gap: () => number
  /** Закрытие; по умолчанию `Escape`. */
  close?: () => Promise<void>
}

const query = <T extends Element = HTMLElement>(selector: string) => [
  ...document.querySelectorAll<T>(selector),
]

/** Зазор по оси открытия (низ/верх/право) между якорем и поповером. */
const gapFrom = (anchor: DOMRect, popup: HTMLElement): number => {
  const box = (popup.closest('[data-side]') ?? popup).getBoundingClientRect()
  return Math.max(
    box.top - anchor.bottom,
    anchor.top - box.bottom,
    box.left - anchor.right,
    anchor.left - box.right,
  )
}

let pointer = { x: 0, y: 0 }

/** Кнопка фильтра колонки: инлайн или кебаб, если кнопки схлопнуты. */
const filterAnchor = (columnId: string) => {
  const head = query(`.data-grid__head-cell[data-column-id="${columnId}"]`)[0]
  return (
    head.querySelector<HTMLElement>('.column-filter__button') ??
    head.querySelector<HTMLElement>('[aria-label="Column options"]')!
  )
}

const openFilterPanel = async (columnId: string) => {
  // Скрытые кнопки заголовка проявляются по наведению — без него клик уходит мимо.
  await revealCellButtons(
    query(`.data-grid__head-cell[data-column-id="${columnId}"]`)[0],
  )
  const anchor = filterAnchor(columnId)
  await userEvent.click(anchor)
  if (anchor.getAttribute('aria-label') === 'Column options') {
    const item = () =>
      query('[role="menuitem"]').find(el => el.textContent?.trim() === 'Filter')
    await expect.poll(item).toBeTruthy()
    await userEvent.click(item()!)
  }
  await expect.poll(() => query('[data-testid="filter-panel"]').length).toBe(1)
}

// Закрытая панель из DOM уходит: `isOpen` получает `undefined`.
const filterPopup = () =>
  query('[data-testid="filter-panel"]')[0]?.closest<HTMLElement>(
    '[role="dialog"]',
  ) as HTMLElement

const POPOVERS: Popover[] = [
  {
    name: 'action menu',
    open: async () => {
      await revealCellButtons(
        query('[aria-label="Column options"]')[0].closest(
          '.data-grid__head-cell',
        )!,
      )
      await userEvent.click(query('[aria-label="Column options"]')[0])
      await expect
        .poll(() => query('[role="menuitem"]').length)
        .toBeGreaterThan(0)
    },
    popup: () => query('[role="menu"]')[0],
    items: () => query('[role="menuitem"]'),
    gap: () =>
      gapFrom(
        query('[aria-label="Column options"]')[0].getBoundingClientRect(),
        query('[role="menu"]')[0],
      ),
  },
  {
    name: 'context menu',
    open: async () => {
      const cell = query('.data-grid__body-cell[data-column-id="name"]')[0]
      const rect = cell.getBoundingClientRect()
      pointer = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      await userEvent.click(cell, { button: 'right' })
      await expect
        .poll(() => query('[role="menuitem"]').length)
        .toBeGreaterThan(0)
    },
    popup: () => query('[role="menu"]')[0],
    items: () => query('[role="menuitem"]'),
    gap: () =>
      gapFrom(
        new DOMRect(pointer.x, pointer.y, 0, 0),
        query('[role="menu"]')[0],
      ),
  },
  {
    name: 'column visibility menu',
    open: async () => {
      await userEvent.click(
        query('[data-testid="column-visibility-button"]')[0],
      )
      await expect
        .poll(() => query('[data-testid="column-visibility-menu"]').length)
        .toBe(1)
    },
    popup: () => query('[data-testid="column-visibility-menu"]')[0],
    items: () => query('[data-column-id] label'),
    gap: () =>
      gapFrom(
        query(
          '[data-testid="column-visibility-button"]',
        )[0].getBoundingClientRect(),
        query('[data-testid="column-visibility-menu"]')[0],
      ),
  },
  {
    name: 'export panel',
    open: async () => {
      await userEvent.click(query('[data-testid="export-button"]')[0])
      await expect
        .poll(() => query('[data-testid="export-panel"]').length)
        .toBe(1)
    },
    popup: () => query('[data-testid="export-panel"]')[0],
    items: () => query('[data-testid="export-axis-rows"] [role="radio"]'),
    gap: () =>
      gapFrom(
        query('[data-testid="export-button"]')[0].getBoundingClientRect(),
        query('[data-testid="export-panel"]')[0],
      ),
  },
  {
    name: 'filter panel',
    open: () => openFilterPanel('vip'),
    popup: filterPopup,
    items: () => query('[data-testid="filter-panel"] label'),
    gap: () =>
      gapFrom(filterAnchor('vip').getBoundingClientRect(), filterPopup()),
  },
  {
    name: 'filter condition list',
    open: async () => {
      await openFilterPanel('note')
      await userEvent.click(query('[data-testid="filter-operator"]')[0])
      await expect
        .poll(() => query('[role="option"]').length)
        .toBeGreaterThan(0)
    },
    // Список уходит из DOM вместе с закрытой панелью.
    popup: () => query('[role="listbox"]')[0]?.parentElement as HTMLElement,
    items: () => query('[role="option"]'),
    gap: () =>
      gapFrom(
        query('[data-testid="filter-operator"]')[0].getBoundingClientRect(),
        query('[role="listbox"]')[0].parentElement as HTMLElement,
      ),
    // Список закрывается выбором текущего условия, панель — Escape.
    close: async () => {
      await userEvent.click(
        query('[role="option"]').find(
          item => item.getAttribute('aria-selected') === 'true',
        )!,
      )
      await userEvent.keyboard('{Escape}')
    },
  },
  {
    name: 'page size list',
    open: async () => {
      await userEvent.click(query('[data-testid="page-size-select"]')[0])
      await expect
        .poll(() => query('[role="option"]').length)
        .toBeGreaterThan(0)
    },
    popup: () => query('[role="listbox"]')[0].parentElement as HTMLElement,
    items: () => query('[role="option"]'),
    gap: () =>
      gapFrom(
        query('[data-testid="page-size-select"]')[0].getBoundingClientRect(),
        query('[role="listbox"]')[0].parentElement as HTMLElement,
      ),
    // Список выбора закрывается выбором текущего значения.
    close: async () => {
      await userEvent.click(
        query('[role="option"]').find(
          item => item.getAttribute('aria-selected') === 'true',
        )!,
      )
    },
  },
]

const renderAll = async () => {
  await render(
    <composed.AllFeatures
      containerHeight={500}
      height={400}
      dataCount={50}
      columnCount={4}
      columnsOverride={COLUMNS}
      dataOverride={DATA}
      enableToolbar
      enableColumnVisibility
      enableExport
      enableRowSelection
      enablePagination
      enableColumnSorting
      enableHeaderActionMenu
      enableCellSelection
      enableContextMenu
      enableColumnFiltering
    />,
  )
  await expect.poll(() => query('[data-testid="export-button"]').length).toBe(1)
  await expect
    .poll(() => query('[data-testid="page-size-select"]').length)
    .toBe(1)
}

// Истории получают colorMode из тумблера тулбара (декоратор превью), поэтому тёмный
// грид для PP5 собирается напрямую.
const DARK_PLUGINS = [
  columnSorting(),
  headerActionMenu({ mode: 'always' }),
  columnVisibility(),
  dataExport(),
  pagination(),
  rowSelection(),
  cellSelection(),
  contextMenu(),
  columnFiltering(),
]

const DarkGrid = () => {
  const table = useCreateTable({
    columns: COLUMNS,
    data: DATA,
    getRowId: (row: (typeof DATA)[number]) => row.id,
    enableToolbar: true,
    plugins: DARK_PLUGINS as never,
  })
  return (
    <div style={{ height: 400 }}>
      <DataGrid table={table as never} colorMode="dark" />
    </div>
  )
}

const renderDark = async () => {
  await render(<DarkGrid />)
  await expect.poll(() => query('[data-testid="export-button"]').length).toBe(1)
  await expect
    .poll(() => query('[data-testid="page-size-select"]').length)
    .toBe(1)
}

/** Поповер виден (список выбора Base UI остаётся в DOM скрытым). */
const isOpen = (popover: Popover) =>
  (popover.popup()?.getClientRects().length ?? 0) > 0

/** Открывает поповер, снимает метрики и закрывает его. */
const measure = async <T,>(popover: Popover, take: (p: Popover) => T) => {
  await popover.open()
  // Первый кадр открытия Base UI держит `data-starting-style` и инлайновый
  // `transition: none` — меряем поповер уже в покое.
  await expect
    .poll(
      () => {
        const popup = popover.popup()
        return (
          !popup.hasAttribute('data-starting-style') &&
          popup.style.transition !== 'none'
        )
      },
      { message: popover.name },
    )
    .toBe(true)
  const result = take(popover)
  await (popover.close?.() ?? userEvent.keyboard('{Escape}'))
  await expect
    .poll(() => isOpen(popover), { message: popover.name, timeout: 4000 })
    .toBe(false)
  return result
}

const collect = async <T,>(take: (p: Popover) => T): Promise<[string, T][]> => {
  const out: [string, T][] = []
  for (const popover of POPOVERS) {
    // eslint-disable-next-line no-await-in-loop
    out.push([popover.name, await measure(popover, take)])
  }
  return out
}

describe('Popover family contract', () => {
  test('PP1 popover surfaces share ONE background, text color, border, radius, shadow, font and transition', async () => {
    await renderAll()
    const props = [
      'background-color',
      'color',
      'padding-top',
      'border-top-width',
      'border-top-color',
      'border-top-left-radius',
      'box-shadow',
      'font-size',
      'font-family',
      'transition',
    ]
    const surfaces = await collect(p =>
      Object.fromEntries(props.map(prop => [prop, read(p.popup(), prop)])),
    )
    const [, base] = surfaces[0]
    for (const [name, surface] of surfaces) {
      expect(surface, `${name} surface`).toEqual(base)
    }
    expect(base.color).toBe(resolve('--tsr-comp-control-color'))
    expect(base['font-size']).toBe(
      resolve('--tsr-comp-popup-font-size', 'font-size'),
    )
  })

  test('PP2 popover items share ONE height, radius and font size', async () => {
    await renderAll()
    const items = await collect(p => {
      const item = p.items()[0]
      return {
        height: item.offsetHeight,
        radius: read(item, 'border-top-left-radius'),
        fontSize: read(item, 'font-size'),
      }
    })
    const [, base] = items[0]
    for (const [name, item] of items) {
      expect(item, `${name} item`).toEqual(base)
    }
    expect(base.height).toBe(
      parseFloat(resolve('--tsr-comp-popup-item-min-height', 'min-height')),
    )
  })

  test('PP9 popover item highlight transitions its background in the tempo of a table row hover', async () => {
    await renderAll()
    const cell = document.querySelector<HTMLElement>('.data-grid__body-cell')!
    const timingOf = (el: Element) => {
      const style = getComputedStyle(el)
      const properties = style.transitionProperty.split(', ')
      const index = properties.indexOf('background-color')
      return index < 0
        ? undefined
        : {
            duration: style.transitionDuration.split(', ')[index],
            easing: style.transitionTimingFunction.split(', ')[index],
          }
    }
    const row = timingOf(cell)
    expect(row).toBeDefined()
    const items = await collect(p => timingOf(p.items()[0]!))
    for (const [name, timing] of items) {
      expect(timing, ` item`).toEqual(row)
    }
  })

  test('PP4 popovers open at ONE distance from their anchor = the shared side offset', async () => {
    await renderAll()
    const gaps = await collect(p => p.gap())
    for (const [name, gap] of gaps) {
      expect(gap, `${name} gap`).toBeGreaterThanOrEqual(3)
      expect(gap, `${name} gap`).toBeLessThanOrEqual(5)
    }
  })

  test('PP5 popovers rendered in portals follow the grid colour mode (dark grid — dark popovers)', async () => {
    await renderDark()
    const dark = 'data-grid-theme dark'
    const surfaces = await collect(p => ({
      background: read(p.popup(), 'background-color'),
      color: read(p.popup(), 'color'),
      dark: p.popup().closest('.dark') !== null,
    }))
    for (const [name, surface] of surfaces) {
      expect(surface, `${name} in the dark grid`).toEqual({
        background: resolve('--tsr-comp-popup-bg', 'background-color', dark),
        color: resolve('--tsr-comp-popup-color', 'color', dark),
        dark: true,
      })
    }
  })

  test('PP6 popover surfaces have no border: they are set apart by shadow-action only', async () => {
    await renderAll()
    const probe = document.createElement('div')
    probe.className = 'data-grid-theme'
    probe.style.boxShadow = 'var(--tsr-comp-shadow-action)'
    document.body.appendChild(probe)
    const shadow = getComputedStyle(probe).boxShadow
    probe.remove()
    const surfaces = await collect(p => ({
      border: read(p.popup(), 'border-top-width'),
      shadow: read(p.popup(), 'box-shadow'),
    }))
    for (const [name, surface] of surfaces) {
      expect(surface, name).toEqual({ border: '0px', shadow })
    }
  })

  test('PP7 popover items show the pointer cursor; a disabled item shows the default one', async () => {
    await renderAll()
    const cursors = await collect(p => ({
      enabled: read(
        p.items().find(el => !el.hasAttribute('data-disabled'))!,
        'cursor',
      ),
      disabled: (() => {
        const el = p.items().find(item => item.hasAttribute('data-disabled'))
        return el ? read(el, 'cursor') : undefined
      })(),
    }))
    for (const [name, { enabled }] of cursors) {
      expect(enabled, name).toBe('pointer')
    }
    for (const [name, { disabled }] of cursors) {
      if (disabled !== undefined) expect(disabled, name).toBe('default')
    }
    // Недоступные пункты есть у меню колонок и панели экспорта — проверены не вхолостую.
    expect(
      cursors.filter(([, c]) => c.disabled !== undefined).length,
    ).toBeGreaterThan(0)
  })

  test('PP3 a disabled popover item fades by colour = --tsr-comp-control-disabled-color, not by opacity', async () => {
    await renderAll()
    const expected = resolve('--tsr-comp-control-disabled-color')
    // Недоступные пункты есть у меню колонок (`enableHiding: false`) и панели
    // экспорта («Выбранные строки» без выбора).
    for (const popover of POPOVERS.filter(p =>
      ['column visibility menu', 'export panel'].includes(p.name),
    )) {
      // eslint-disable-next-line no-await-in-loop
      await measure(popover, p => {
        const disabled = p.items().find(el => el.hasAttribute('data-disabled'))
        expect(disabled, `${p.name} has a disabled item`).toBeTruthy()
        expect(read(disabled!, 'color'), `${p.name} disabled color`).toBe(
          expected,
        )
        expect(read(disabled!, 'opacity'), `${p.name} opacity`).toBe('1')
      })
    }
  })

  test('PP8 popovers open without a ResizeObserver loop error; a select list is at least as wide as its trigger', async () => {
    const loops: string[] = []
    const onError = (event: ErrorEvent) => {
      if (event.message.includes('ResizeObserver')) loops.push(event.message)
    }
    window.addEventListener('error', onError)
    try {
      await renderAll()
      const triggers: Record<string, string> = {
        'filter condition list': '[data-testid="filter-operator"]',
        'page size list': '[data-testid="page-size-select"]',
      }
      const widths = await collect(p =>
        triggers[p.name]
          ? {
              popup: p.popup().offsetWidth,
              trigger: query(triggers[p.name])[0].offsetWidth,
            }
          : null,
      )
      // Ошибка цикла приходит в конце кадра после открытия.
      await new Promise(r =>
        requestAnimationFrame(() => requestAnimationFrame(r)),
      )
      expect(loops).toEqual([])
      const selects = widths.filter(([, w]) => w !== null)
      expect(selects.length).toBe(2)
      for (const [name, w] of selects) {
        expect(w!.popup, name).toBeGreaterThanOrEqual(w!.trigger)
      }
    } finally {
      window.removeEventListener('error', onError)
    }
  })
})
