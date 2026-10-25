import axe from 'axe-core'
import { useMemo, useState } from 'react'
import { commands, server, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test } from 'vitest'

import '../../../core/themeVariables/theme.css'
import themeCss from '../../../core/themeVariables/theme.css?raw'
import type { ContrastMode } from '../../../core/themeVariables'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  columnPinning,
  infiniteScroll,
  keyboardNavigation,
  rowSelection,
} from '../../../plugins'
import { Segments } from '@/lib/ui/Segments'
import { Switch } from '@/lib/ui/Switch'
import { humanClick, renderGrid, rowState } from '../helpers'
import { composed, treeLinesArgs } from '../stories'
import {
  contrast,
  effectiveBg,
  inBothThemes,
  resolveColor as resolve,
  toRgba,
} from './a11y-helpers'
import { tableLabels } from '../labels'

// Повышенный контраст (ADR 0088, MC1–MC9, MC11): рычаги тонов, надстройка по
// `prefers-contrast: more` (эмуляция Playwright) и пропу `contrast`. Контраст — по
// вычисленным цветам в обеих темах. Перф MC10 — `performance/increased-contrast`.

const cmd = commands as unknown as {
  moreContrast: (active: boolean) => Promise<void>
  forcedColors: (active: boolean) => Promise<void>
}

afterEach(async () => {
  await cmd.moreContrast(false)
  document.documentElement.removeAttribute('data-tsr-contrast')
  document.documentElement.classList.remove('dark')
})

const style = (el: Element, pseudo?: string) => getComputedStyle(el, pseudo)
const frame = () => new Promise(resolve => requestAnimationFrame(resolve))

/** Контраст двух цветов, второй — непрозрачный фон. */
const ratio = (fg: string, bg: number[]) => contrast(toRgba(fg), bg)

interface Item {
  id: string
  a: string
  b: string
  c: string
}

const COLUMNS = [
  { id: 'a', accessorKey: 'a', header: 'A', size: 120 },
  { id: 'b', accessorKey: 'b', header: 'B', size: 140 },
  { id: 'c', accessorKey: 'c', header: 'C', size: 120 },
]

const Grid = ({
  selected = [] as string[],
  contrast: mode,
}: {
  selected?: string[]
  contrast?: ContrastMode
}) => {
  const data = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => ({
        id: `r${i}`,
        a: `A${i}`,
        b: `B${i}`,
        c: `C${i}`,
      })),
    [],
  )
  const table = useCreateTable({
    columns: COLUMNS as never,
    data,
    getRowId: (row: Item) => row.id,
    state: { columnPinning: { start: ['a'], end: [] } },
    plugins: [
      columnPinning(),
      rowSelection({
        rowSelection: Object.fromEntries(selected.map(id => [id, true])),
      }),
      keyboardNavigation(),
    ] as never,
  })
  return (
    <div style={{ width: 520, height: 420 }}>
      <DataGrid table={table as never} contrast={mode} />
    </div>
  )
}

const waitRows = () =>
  expect
    .poll(() => document.querySelectorAll('.data-grid__body-row').length)
    .toBeGreaterThan(0)

const mount = async (selected: string[] = [], mode?: ContrastMode) => {
  const screen = await render(<Grid selected={selected} contrast={mode} />)
  await waitRows()
  return screen
}

const wrapper = () =>
  document.querySelector<HTMLElement>(
    '.data-grid-theme[class*="theme-wrapper"]',
  )!
const rowEl = (id: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${id}"]`,
  )!
const cellEl = (rowId: string, columnId: string) =>
  rowEl(rowId).querySelector<HTMLElement>(`[data-column-id="${columnId}"]`)!
const textOf = (cell: HTMLElement) =>
  cell.querySelector<HTMLElement>('.data-grid__cell-wrapper-title') ?? cell

/** Ждать окончания переходов цвета. */
const settle = async () => {
  await frame()
  document
    .getAnimations()
    .filter(animation => animation.effect?.getTiming().iterations !== Infinity)
    .forEach(animation => animation.finish())
  await frame()
}

/** Цвет линии дерева в ячейке отступа (ADR 0102: линии — рамки элементов в ячейке). */
const treeLineColor = (cell: HTMLElement) =>
  getComputedStyle(cell.querySelector('[aria-hidden] > span')!).borderLeftColor

const treeCell = () =>
  [...document.querySelectorAll<HTMLElement>('[data-tree-depth]')].find(el => {
    const r = el.getBoundingClientRect()
    return r.top > 80 && r.bottom < innerHeight - 10
  })

const skeletonStripe = () =>
  [
    ...document.querySelectorAll<HTMLElement>(
      '.data-grid__body-cell--skeleton [class*="skeleton"]',
    ),
  ].find(el => el.getBoundingClientRect().width > 10)

const Primitives = ({ mode }: { mode?: 'more' }) => {
  const [value, setValue] = useState('b')
  return (
    <div
      className="data-grid-theme"
      data-tsr-contrast={mode}
      style={{ padding: 20, background: 'var(--tsr-sys-surface)' }}
    >
      <Segments
        value={value}
        onValueChange={setValue}
        options={[
          { value: 'a', label: 'Alpha' },
          { value: 'b', label: 'Beta' },
        ]}
      />
      <Switch aria-label="Off" />
      <div data-testid="skeleton-host" />
    </div>
  )
}

const openKebabMenu = async (mode?: ContrastMode) => {
  const screen = await render(<composed.HeaderMenuPlayground contrast={mode} />)
  const kebab = () =>
    document.querySelector<HTMLElement>(
      `.data-grid__head-cell [aria-label^="${tableLabels.headerMenu}"]`,
    )
  // Настоящим нажатием, как пользователь: Enter по фокусу в WebKit иногда терялся.
  // Модуль меню ленивый — первое открытие в WebKit дольше секунды.
  await userEvent.hover(kebab()!.closest('.data-grid__head-cell')!)
  await humanClick(kebab()!)
  await expect
    .poll(() => document.querySelector('[role="menu"]'), { timeout: 4000 })
    .not.toBeNull()
  await userEvent.keyboard('{ArrowDown}')
  await expect
    .poll(() => document.querySelector('[role="menuitem"][data-highlighted]'))
    .not.toBeNull()
  return {
    screen,
    menu: document.querySelector<HTMLElement>('[role="menu"]')!,
    item: document.querySelector<HTMLElement>(
      '[role="menuitem"][data-highlighted]',
    )!,
  }
}

/** Закрыть меню и снять грид: открытое меню не переживает тест. */
const closeMenu = async (screen: { unmount: () => unknown }) => {
  await userEvent.keyboard('{Escape}')
  await expect.poll(() => document.querySelector('[role="menu"]')).toBeNull()
  await screen.unmount()
}

describe('Повышенный контраст (ADR 0088)', () => {
  test('MC1: рычаги меняют наведение, выбор, закреплённые ячейки, линии дерева, скелет и Switch', async () => {
    const changes = async (
      lever: string,
      root: () => HTMLElement,
      read: () => string,
    ) => {
      await settle()
      const before = read()
      root().style.setProperty(lever, '40%')
      await settle()
      const after = read()
      root().style.removeProperty(lever)
      expect(after, lever).not.toBe(before)
    }

    const screen = await mount(['r2'])
    await userEvent.hover(cellEl('r4', 'b'))
    await changes('--tsr-sys-tint-hover', wrapper, () => rowState(rowEl('r4')))
    await changes('--tsr-sys-tint-selected', wrapper, () =>
      rowState(rowEl('r2')),
    )
    await changes(
      '--tsr-sys-tint-pinned',
      wrapper,
      () => style(cellEl('r5', 'a')).backgroundColor,
    )
    await screen.unmount()

    const tree = await render(
      <composed.RowExpandingPlayground {...treeLinesArgs} />,
    )
    await expect.poll(treeCell).toBeTruthy()
    await changes(
      '--tsr-sys-tint-guide',
      () => treeCell()!.closest<HTMLElement>('.data-grid-theme')!,
      () => treeLineColor(treeCell()!),
    )
    await tree.unmount()

    const skeletons = await render(<composed.SkeletonPlayground />)
    await expect.poll(skeletonStripe).toBeTruthy()
    await changes(
      '--tsr-sys-tint-fill',
      () => skeletonStripe()!.closest<HTMLElement>('.data-grid-theme')!,
      () => style(skeletonStripe()!).backgroundColor,
    )
    await skeletons.unmount()

    await render(<Primitives />)
    const off = document.querySelector<HTMLElement>('[role="switch"]')!
    await changes(
      '--tsr-sys-tint-fill',
      () => off.closest<HTMLElement>('.data-grid-theme')!,
      () => style(off).backgroundColor,
    )
  })

  test('MC2: в режиме линии дерева, скелет, выключенный Switch и ползунок прокрутки не ниже 3:1 к фону', async () => {
    const tree = await render(
      <composed.RowExpandingPlayground {...treeLinesArgs} contrast="more" />,
    )
    await expect.poll(treeCell).toBeTruthy()
    await inBothThemes(async () => {
      const cell = treeCell()!
      expect(
        ratio(treeLineColor(cell), effectiveBg(cell)),
        'линия дерева',
      ).toBeGreaterThanOrEqual(3)
      const container = document.querySelector<HTMLElement>(
        '.data-grid__container',
      )!
      expect(
        ratio(
          resolve(container, 'var(--tsr-comp-scrollbar-thumb)'),
          effectiveBg(container),
        ),
        'ползунок прокрутки',
      ).toBeGreaterThanOrEqual(3)
    })
    await tree.unmount()

    const skeletons = await render(
      <composed.SkeletonPlayground contrast="more" />,
    )
    await expect.poll(skeletonStripe).toBeTruthy()
    await inBothThemes(async () => {
      const stripe = skeletonStripe()!
      expect(
        ratio(
          style(stripe).backgroundColor,
          effectiveBg(stripe.parentElement!),
        ),
        'скелет',
      ).toBeGreaterThanOrEqual(3)
    })
    await skeletons.unmount()

    await render(<Primitives mode="more" />)
    const off = document.querySelector<HTMLElement>('[role="switch"]')!
    const thumb = off.firstElementChild as HTMLElement
    await inBothThemes(async () => {
      const bg = effectiveBg(off.parentElement!)
      expect(style(off).outlineStyle).toBe('solid')
      expect(
        ratio(style(off).outlineColor, bg),
        'контур',
      ).toBeGreaterThanOrEqual(3)
      expect(
        ratio(style(thumb).backgroundColor, effectiveBg(off)),
        'ползунок',
      ).toBeGreaterThanOrEqual(3)
    })
  })

  test('MC3: наведение и выбор строки, дорожка Segments и пункт меню отличимы на 3:1, текст на них — 7:1', async () => {
    const screen = await mount(['r2', 'r4'], 'more')
    // Строка r4 выбрана и под указателем; r3 — под указателем без выбора проверяется отдельно.
    const distinct = (state: HTMLElement, rest: HTMLElement) => {
      const bg = effectiveBg(state)
      const fill = contrast(bg, effectiveBg(rest))
      const outline =
        style(state).outlineStyle === 'solid'
          ? ratio(style(state).outlineColor, bg)
          : 0
      return Math.max(fill, outline)
    }
    const textRatio = (cell: HTMLElement) =>
      ratio(style(textOf(cell)).color, effectiveBg(cell))

    await userEvent.hover(cellEl('r3', 'b'))
    await inBothThemes(async () => {
      await settle()
      expect(
        distinct(rowEl('r3'), rowEl('r5')),
        'наведение',
      ).toBeGreaterThanOrEqual(3)
      expect(
        textRatio(cellEl('r3', 'b')),
        'текст при наведении',
      ).toBeGreaterThanOrEqual(7)
      expect(
        distinct(rowEl('r2'), rowEl('r5')),
        'выбор',
      ).toBeGreaterThanOrEqual(3)
      for (const col of ['a', 'b']) {
        expect(
          textRatio(cellEl('r2', col)),
          `выбор/${col}`,
        ).toBeGreaterThanOrEqual(7)
      }
    })
    await userEvent.hover(cellEl('r4', 'a'))
    await inBothThemes(async () => {
      await settle()
      expect(
        distinct(rowEl('r4'), rowEl('r5')),
        'выбор + наведение',
      ).toBeGreaterThanOrEqual(3)
      for (const col of ['a', 'b']) {
        expect(
          textRatio(cellEl('r4', col)),
          `выбор + наведение/${col}`,
        ).toBeGreaterThanOrEqual(7)
      }
    })
    await screen.unmount()

    const primitives = await render(<Primitives mode="more" />)
    const track = document.querySelector<HTMLElement>('[role="radiogroup"]')!
    const label = document.querySelector<HTMLElement>(
      '[role="radio"]:not([data-checked])',
    )!
    await inBothThemes(async () => {
      const outside = effectiveBg(track.parentElement!)
      expect(style(track).outlineStyle).toBe('solid')
      expect(
        Math.max(
          contrast(effectiveBg(track), outside),
          ratio(style(track).outlineColor, outside),
        ),
        'дорожка',
      ).toBeGreaterThanOrEqual(3)
      expect(
        ratio(style(label).color, effectiveBg(label)),
        'подпись на дорожке',
      ).toBeGreaterThanOrEqual(7)
    })
    await primitives.unmount()

    const { screen: menuGrid, item } = await openKebabMenu('more')
    await inBothThemes(async () => {
      await settle()
      const bg = effectiveBg(item)
      const rest = effectiveBg(item.parentElement!)
      expect(
        Math.max(
          contrast(bg, rest),
          style(item).outlineStyle === 'solid'
            ? ratio(style(item).outlineColor, bg)
            : 0,
        ),
        'пункт меню',
      ).toBeGreaterThanOrEqual(3)
      expect(
        ratio(style(item).color, bg),
        'текст пункта',
      ).toBeGreaterThanOrEqual(7)
    })
    await closeMenu(menuGrid)
  })

  test('MC4: в режиме рамка грида, разделители, рамка закрепления и рамка меню не ниже 3:1; роли палитры приложения не меняются', async () => {
    const screen = await mount([], 'more')
    // Запасная рамка: палитры страницы (`global.css` историй) нет.
    document.documentElement.style.setProperty('--border', 'initial')
    await inBothThemes(async () => {
      const root = wrapper()
      expect(
        ratio(style(root).borderTopColor, effectiveBg(root)),
        'рамка грида',
      ).toBeGreaterThanOrEqual(3)
      const pinned = cellEl('r3', 'a')
      expect(style(pinned).borderRightStyle).toBe('solid')
      expect(
        ratio(style(pinned).borderRightColor, effectiveBg(pinned)),
        'рамка закрепления',
      ).toBeGreaterThanOrEqual(3)
    })

    // Палитра shadcn приложения: рамка и текст — её цвета.
    document.documentElement.style.setProperty('--border', 'rgb(200, 0, 0)')
    document.documentElement.style.setProperty('--foreground', 'rgb(0, 0, 90)')
    try {
      await settle()
      expect(style(wrapper()).borderTopColor).toBe('rgb(200, 0, 0)')
      expect(style(textOf(cellEl('r3', 'b'))).color).toBe('rgb(0, 0, 90)')
    } finally {
      document.documentElement.style.removeProperty('--border')
      document.documentElement.style.removeProperty('--foreground')
    }
    await screen.unmount()

    // Разделители ячеек — у раскладки под вложенной шапкой.
    const nested = await renderGrid({
      contrast: 'more',
      columnCount: 6,
      dataCount: 20,
      headerNesting: 'nested',
    })
    await waitRows()
    await inBothThemes(async () => {
      const cell = document.querySelector<HTMLElement>(
        '.data-grid__body-cell[data-layout="grid"]',
      )!
      expect(style(cell).borderRightStyle).toBe('solid')
      expect(
        ratio(style(cell).borderRightColor, effectiveBg(cell)),
        'разделитель',
      ).toBeGreaterThanOrEqual(3)
    })
    await nested.unmount()

    const { screen: menuGrid, menu } = await openKebabMenu('more')
    await inBothThemes(async () => {
      expect(style(menu).outlineStyle).toBe('solid')
      expect(
        ratio(style(menu).outlineColor, effectiveBg(menu)),
        'рамка меню',
      ).toBeGreaterThanOrEqual(3)
    })
    await closeMenu(menuGrid)
  })

  test('MC5: в режиме тексты грида не ниже 7:1 (axe color-contrast-enhanced) в обеих темах', async () => {
    const all = await renderGrid({
      contrast: 'more',
      columnCount: 6,
      dataCount: 30,
      enableRowSelection: true,
      enableColumnPinning: true,
      enableColumnSorting: true,
      enableColumnVisibility: true,
      enableQuickSearch: true,
      enablePagination: true,
      enableHeaderActionMenu: true,
    })
    await waitRows()
    const enhanced = async (root: Element) => {
      const { violations } = await axe.run(root, {
        runOnly: ['color-contrast-enhanced'],
      })
      return violations.flatMap(v =>
        v.nodes.map(n => `${n.target.join(' ')}: ${n.failureSummary}`),
      )
    }
    await inBothThemes(async () => {
      expect(await enhanced(wrapper())).toEqual([])
    })
    await all.unmount()

    // Причина отказа ленты — приглушённый текст грида.
    const Feed = () => {
      const data = useMemo(
        () =>
          Array.from({ length: 6 }, (_, i) => ({
            id: `r${i}`,
            a: `A${i}`,
            b: `B${i}`,
            c: `C${i}`,
          })),
        [],
      )
      const table = useCreateTable({
        columns: COLUMNS as never,
        data,
        getRowId: (row: Item) => row.id,
        plugins: [
          infiniteScroll({
            onLoadMore: () => Promise.reject(new Error('Server error')),
            hasMore: true,
          }),
        ] as never,
      })
      return (
        <div style={{ width: 520, height: 420 }}>
          <DataGrid table={table as never} contrast="more" />
        </div>
      )
    }
    const feed = await render(<Feed />)
    const reason = () =>
      document.querySelector<HTMLElement>(
        '[data-testid="infinite-scroll-error"]',
      )
    await expect.poll(reason).not.toBeNull()
    await inBothThemes(async () => {
      expect(await enhanced(reason()!)).toEqual([])
    })
    await feed.unmount()

    // Пункт меню под клавиатурой.
    const { screen: menuGrid, menu } = await openKebabMenu('more')
    await inBothThemes(async () => {
      await settle()
      expect(await enhanced(menu)).toEqual([])
    })
    await closeMenu(menuGrid)
  })

  test('MC6: правило приложения перебивает надстройку без !important', async () => {
    const sheet = document.createElement('style')
    sheet.textContent = `.app-contrast .data-grid-theme { --tsr-sys-tint-selected: 30%; --tsr-comp-row-selected-outline: none; }`
    document.head.append(sheet)
    try {
      const screen = await render(
        <div className="app-contrast">
          <Grid selected={['r2']} contrast="more" />
        </div>,
      )
      await waitRows()
      await settle()
      const row = rowEl('r2')
      expect(style(row).outlineStyle).toBe('none')
      expect(rowState(row)).toBe(
        resolve(row, 'color-mix(in oklch, var(--tsr-sys-fg) 30%, transparent)'),
      )
      await screen.unmount()
    } finally {
      sheet.remove()
    }
  })

  test('MC7: contrast="more" включает, "standard" выключает при медиа-запросе, "auto" следует системе; атрибут на предке — так же; пути дают одни значения', async () => {
    const probe = () => {
      const row = rowEl('r2')
      return [
        style(wrapper()).borderTopColor,
        style(row).backgroundColor,
        style(row).outlineStyle,
        style(row).outlineColor,
        style(cellEl('r3', 'a')).backgroundColor,
      ].join(' | ')
    }
    const screen = await mount(['r2'])
    const read = async (mode: ContrastMode) => {
      await screen.rerender(<Grid selected={['r2']} contrast={mode} />)
      await settle()
      return probe()
    }

    const standard = await read('auto')
    expect(wrapper().hasAttribute('data-tsr-contrast')).toBe(false)
    const more = await read('more')
    expect(wrapper().getAttribute('data-tsr-contrast')).toBe('more')
    expect(more).not.toBe(standard)

    await cmd.moreContrast(true)
    expect(await read('auto'), 'auto + медиа-запрос').toBe(more)
    expect(await read('standard'), 'standard + медиа-запрос').toBe(standard)

    document.documentElement.setAttribute('data-tsr-contrast', 'standard')
    expect(await read('auto'), 'standard на предке + медиа-запрос').toBe(
      standard,
    )
    expect(await read('more'), 'more на обёртке главнее предка').toBe(more)

    await cmd.moreContrast(false)
    document.documentElement.setAttribute('data-tsr-contrast', 'more')
    expect(await read('auto'), 'more на предке').toBe(more)
    expect(await read('standard'), 'standard на обёртке главнее предка').toBe(
      standard,
    )

    // Тело надстройки одно на оба пути.
    const bodies = [
      ...themeCss.matchAll(
        /data-tsr-contrast='(?:standard|more)'[\s\S]*?\)\s*\{([^}]*)\}/g,
      ),
    ].map(m => m[1]!.replace(/\s+/g, ' ').trim())
    expect(bodies).toHaveLength(2)
    expect(bodies[0]).toBe(bodies[1])
  })

  test('MC8: меню и тултипы в порталах следуют режиму грида', async () => {
    const { screen, menu } = await openKebabMenu('more')
    expect(menu.closest('[data-tsr-contrast="more"]')).not.toBeNull()
    expect(style(menu).outlineStyle).toBe('solid')
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => document.querySelector('[role="menu"]')).toBeNull()

    // Тултип кебаба — тоже в портале.
    const headKebab = document.querySelector<HTMLElement>(
      `.data-grid__head-cell [aria-label^="${tableLabels.headerMenu}"]`,
    )!
    await userEvent.hover(headKebab.closest('.data-grid__head-cell')!)
    await userEvent.hover(headKebab)
    const tooltip = () =>
      [...document.querySelectorAll<HTMLElement>('[data-side]')].find(el =>
        el.textContent?.trim().startsWith(tableLabels.headerMenu),
      )
    await expect.poll(tooltip).toBeTruthy()
    expect(tooltip()!.closest('[data-tsr-contrast="more"]')).not.toBeNull()
    await screen.unmount()

    await cmd.moreContrast(true)
    const { screen: plainGrid, menu: plain } = await openKebabMenu('standard')
    expect(style(plain).outlineStyle).toBe('none')
    await closeMenu(plainGrid)
  })

  test('MC9: вне режима вид прежний; в forced-colors значения ADR 0087 главнее, контуры режима не рисуются', async () => {
    const screen = await mount(['r2'])
    await userEvent.hover(cellEl('r3', 'b'))
    await settle()
    const mix = (space: string, base: string, pct: number) =>
      resolve(
        wrapper(),
        `color-mix(in ${space}, ${base}, var(--tsr-sys-fg) ${pct}%)`,
      )
    const overlay = (pct: number) =>
      resolve(
        wrapper(),
        `color-mix(in oklch, var(--tsr-sys-fg) ${pct}%, transparent)`,
      )
    expect(rowState(rowEl('r3')), 'наведение').toBe(overlay(4))
    expect(style(rowEl('r3')).outlineStyle).toBe('none')
    expect(rowState(rowEl('r2')), 'выбор').toBe(overlay(6))
    expect(style(rowEl('r2')).outlineStyle).toBe('none')
    for (const id of ['r5', 'r6']) {
      const base =
        rowEl(id).getAttribute('data-row-odd') === 'true'
          ? 'var(--tsr-sys-bg)'
          : 'var(--tsr-sys-surface)'
      expect(style(cellEl(id, 'a')).backgroundColor, `закрепление/${id}`).toBe(
        mix('oklch', base, 3),
      )
    }
    expect(style(wrapper()).borderTopColor, 'рамка').toBe('rgb(235, 235, 235)')

    if (server.browser === 'webkit') return
    await cmd.moreContrast(true)
    await cmd.forcedColors(true)
    try {
      await settle()
      const sys = (name: string) => resolve(document.body, name)
      expect(style(rowEl('r2')).backgroundColor).toBe(sys('Highlight'))
      expect(style(rowEl('r2')).outlineStyle).toBe('none')
      // Наведение режима ADR 0087 — рамка на слое строки поверх ячеек (HC4).
      await expect
        .poll(() => style(rowEl('r3'), '::after').borderTopColor)
        .toBe(sys('Highlight'))
    } finally {
      await cmd.forcedColors(false)
    }
    await screen.unmount()
  })
})
