import axe from 'axe-core'
import { commands, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test } from 'vitest'

import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  columnFiltering,
  columnPinning,
  columnSorting,
  columnVisibility,
  headerActionMenu,
  rowExpanding,
  rowGrouping,
} from '../../../plugins'
import { PinButton } from '../../../plugins/columnPinning/PinButton'
import { SortButton } from '../../../plugins/columnSorting/SortButton'
import { GroupButton } from '../../../plugins/rowGrouping/GroupButton'
import { Bubble } from '../../../ui/Bubble'
import { IconsProvider } from '../../../ui/icons'
import { humanClick, revealCellButtons } from '../helpers'
import {
  AXE_OPTIONS,
  backgroundOf,
  contrast,
  inBothThemes,
  toRgba,
} from './a11y-helpers'
import { waitForGrid } from './core-helpers'
import { tableLabels } from '../labels'
import { columnFilteringLabels } from '../../../plugins/columnFiltering/labels'
import { columnPinningLabels } from '../../../plugins/columnPinning/labels'
import { columnSortingLabels } from '../../../plugins/columnSorting/labels'
import { columnVisibilityLabels } from '../../../plugins/columnVisibility/labels'
import { rowGroupingLabels } from '../../../plugins/rowGrouping/labels'

// Индикатор активного действия (ADR 0062, AI1–AI8): точка на инлайн-кнопке
// заголовка, номер приоритета сортировки на её месте, точка и имя кебаба со
// свёрнутыми включёнными действиями, счётчик скрытых колонок в тулбаре.

const reducedMotion = (
  commands as unknown as { reducedMotion: (reduce: boolean) => Promise<void> }
).reducedMotion

afterEach(async () => {
  await reducedMotion(false)
  document.documentElement.classList.remove('dark')
})

const COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name' },
  { id: 'city', accessorKey: 'city', header: 'City' },
  { id: 'age', accessorKey: 'age', header: 'Age' },
]
const DATA = Array.from({ length: 8 }, (_, i) => ({
  id: String(i),
  name: `Name ${i % 3}`,
  city: i % 2 ? 'Rome' : 'Paris',
  age: 20 + i,
}))

const Grid = ({
  kebab = false,
  localization,
  icons,
}: {
  kebab?: boolean
  localization?: Record<string, unknown>
  icons?: Record<string, unknown>
}) => {
  const table = useCreateTable({
    columns: COLUMNS as never,
    data: DATA,
    getRowId: (row: (typeof DATA)[number]) => row.id,
    plugins: [
      columnSorting(),
      columnFiltering(),
      columnPinning(),
      columnVisibility(),
      ...(kebab ? [headerActionMenu({ mode: 'always' })] : []),
    ] as never,
  })
  return (
    <div style={{ width: 900, height: 420 }}>
      <DataGrid
        table={table as never}
        localization={localization as never}
        icons={icons as never}
      />
    </div>
  )
}

/** Грид для ключей иконок включённого состояния (AI12–AI14). */
const IconGrid = ({
  plugins,
  data = DATA,
  icons,
}: {
  plugins: unknown[]
  data?: unknown[]
  icons?: Record<string, unknown>
}) => {
  const table = useCreateTable({
    columns: [
      ...COLUMNS.slice(0, 2),
      { ...COLUMNS[2], pinSides: 'start' },
    ] as never,
    data: data as never,
    getRowId: (row: { id: string }) => row.id,
    plugins: plugins as never,
  })
  return (
    <div style={{ width: 900, height: 420 }}>
      <DataGrid table={table as never} icons={icons as never} />
    </div>
  )
}

const Custom = (id: string) => {
  // Как настоящая иконка: принимает размер и класс кнопки.
  const Icon = (props: object) => <svg {...props} data-testid={id} />
  return Icon
}
const customIn = (root: Element | null | undefined, id: string) =>
  !!root?.querySelector(`[data-testid="${id}"]`)

const head = (id: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__head-cell[data-column-id="${id}"]`,
  )!
const button = (id: string, cls: string) =>
  head(id).querySelector<HTMLElement>(`.${cls}`)!
const kebab = (id: string) =>
  head(id).querySelector<HTMLElement>('[aria-haspopup="menu"]')!
const dotOf = (el: Element) =>
  el.querySelector<HTMLElement>('[data-active-indicator]')
const settle = () =>
  document
    .getAnimations()
    .filter(a => a.effect?.getTiming().iterations !== Infinity)
    .forEach(a => a.finish())
const opacity = (el: Element) => {
  settle()
  return getComputedStyle(el).opacity
}
const dotShown = (el: Element) => {
  const dot = dotOf(el)
  return !!dot && opacity(dot) === '1'
}
/** Вычисленный цвет токена темы в контексте грида. */
const tokenColor = (token: string) => {
  const probe = document.createElement('span')
  probe.style.backgroundColor = `var(${token})`
  document.querySelector('.data-grid-theme')!.append(probe)
  const color = getComputedStyle(probe).backgroundColor
  probe.remove()
  return color
}
const tooltipShown = (text: string) => () =>
  [...document.querySelectorAll('[data-side]')].some(
    el => el.textContent?.trim() === text,
  )
const menuItem = (label: string) =>
  [...document.querySelectorAll<HTMLElement>('[role^="menuitem"]')].find(
    el => el.textContent?.trim() === label,
  )!
const blur = () => (document.activeElement as HTMLElement | null)?.blur()

/** Нажать кнопку заголовка мышью — с наведением на заголовок, как человек. */
const pressInHead = async (id: string, target: () => HTMLElement) => {
  await revealCellButtons(head(id))
  await userEvent.hover(target())
  await humanClick(target())
}

const filterName = async (value: string) => {
  await pressInHead('name', () => button('name', 'column-filter__button'))
  const field = () =>
    document.querySelector<HTMLInputElement>('[data-testid="filter-value"]')
  await expect.poll(field).not.toBeNull()
  await userEvent.type(field()!, value)
  await expect
    .poll(() => button('name', 'column-filter__button').ariaLabel)
    .toBe(columnFilteringLabels(tableLabels).filterActive)
  await userEvent.keyboard('{Escape}')
  await expect
    .poll(() => document.querySelector('[data-testid="filter-panel"]'))
    .toBeNull()
}

const hideCity = async () => {
  const columns = () =>
    document.querySelector<HTMLElement>(
      '[data-testid="column-visibility-button"]',
    )!
  await humanClick(columns())
  const checkbox = () =>
    document.querySelector<HTMLElement>(
      '[data-testid="column-visibility-menu"] [data-column-id="city"] [role="checkbox"]',
    )
  await expect.poll(checkbox).not.toBeNull()
  await userEvent.click(checkbox()!)
  await userEvent.keyboard('{Escape}')
  await expect
    .poll(() =>
      document.querySelector('[data-testid="column-visibility-menu"]'),
    )
    .toBeNull()
}

describe('Индикатор активного действия', () => {
  test('AI1: активная инлайн-кнопка заголовка — обычная, с мини-меню и с панелью — показывает точку цвета --tsr-comp-active-indicator в правом верхнем углу; у неактивной точка скрыта; размер кнопки не меняется', async () => {
    await render(<Grid />)
    await waitForGrid()
    const indicator = tokenColor('--tsr-comp-active-indicator')

    const kinds: [string, () => HTMLElement, () => Promise<void>][] = [
      [
        'sort',
        () => button('age', 'column-sort__button'),
        () => pressInHead('age', () => button('age', 'column-sort__button')),
      ],
      [
        'pin (mini-menu)',
        () => button('city', 'column-pin__button'),
        async () => {
          await pressInHead('city', () => button('city', 'column-pin__button'))
          await expect
            .poll(() => menuItem(columnPinningLabels(tableLabels).pinLeft))
            .toBeTruthy()
          await userEvent.click(
            menuItem(columnPinningLabels(tableLabels).pinLeft),
          )
        },
      ],
      [
        'filter (panel)',
        () => button('name', 'column-filter__button'),
        () => filterName('Name 1'),
      ],
    ]

    for (const [kind, target, activate] of kinds) {
      expect(dotShown(target()), kind).toBe(false)
      const before = target().getBoundingClientRect()
      await activate()
      await expect.poll(() => dotShown(target()), { message: kind }).toBe(true)

      const box = target().getBoundingClientRect()
      expect([box.width, box.height], kind).toEqual([
        before.width,
        before.height,
      ])
      const dot = dotOf(target())!
      expect(getComputedStyle(dot).backgroundColor, kind).toBe(indicator)
      const r = dot.getBoundingClientRect()
      expect(r.left + r.width / 2, kind).toBeGreaterThan(
        box.left + box.width / 2,
      )
      expect(r.top + r.height / 2, kind).toBeLessThan(box.top + box.height / 2)
    }
  })

  test('AI2: при мультисортировке номер приоритета стоит вместо точки и окрашен --tsr-comp-active-indicator, цифры — --tsr-comp-active-indicator-fg', async () => {
    await render(<Grid />)
    await waitForGrid()
    const sort = (id: string) => button(id, 'column-sort__button')
    await pressInHead('age', () => sort('age'))
    await revealCellButtons(head('name'))
    await userEvent.keyboard('{Shift>}')
    await userEvent.click(sort('name'))
    await userEvent.keyboard('{/Shift}')

    await expect
      .poll(() => sort('name').querySelector('[data-count]'))
      .not.toBeNull()
    for (const id of ['age', 'name']) {
      expect(
        sort(id).querySelector('[data-active-indicator]:not([data-count])'),
        id,
      ).toBeNull()
      const priority = sort(id).querySelector<HTMLElement>('[data-count]')!
      const style = getComputedStyle(priority)
      expect(style.backgroundColor).toBe(
        tokenColor('--tsr-comp-active-indicator'),
      )
      expect(style.color).toBe(tokenColor('--tsr-comp-active-indicator-fg'))
    }
  })

  test('AI3: кебаб со свёрнутым активным действием показывает точку и виден без наведения; когда свёрнутые действия неактивны — точка скрыта и кебаб прячется', async () => {
    await render(<Grid kebab />)
    await waitForGrid()
    const wrapper = () => kebab('age').closest('.cell__button')!
    expect(opacity(wrapper())).toBe('0')
    expect(dotShown(kebab('age'))).toBe(false)

    await pressInHead('age', () => kebab('age'))
    await expect
      .poll(() => menuItem(columnSortingLabels(tableLabels).sortAscending))
      .toBeTruthy()
    await userEvent.click(
      menuItem(columnSortingLabels(tableLabels).sortAscending),
    )
    blur()
    await userEvent.unhover(head('age'))
    await expect.poll(() => dotShown(kebab('age'))).toBe(true)
    await expect.poll(() => opacity(wrapper())).toBe('1')

    await pressInHead('age', () => kebab('age'))
    await expect
      .poll(() => menuItem(columnSortingLabels(tableLabels).clearSort))
      .toBeTruthy()
    await userEvent.click(menuItem(columnSortingLabels(tableLabels).clearSort))
    blur()
    await userEvent.unhover(head('age'))
    await expect.poll(() => dotShown(kebab('age'))).toBe(false)
    await expect.poll(() => opacity(wrapper())).toBe('0')
  })

  test('AI4: доступное имя кебаба с активными действиями — withActiveCount(подпись, N), переопределяется через localization; тултип — прежняя подпись', async () => {
    const screen = await render(<Grid kebab />)
    await waitForGrid()
    expect(kebab('age').ariaLabel).toBe(tableLabels.headerMenu)
    await pressInHead('age', () => kebab('age'))
    await expect
      .poll(() => menuItem(columnSortingLabels(tableLabels).sortAscending))
      .toBeTruthy()
    await userEvent.click(
      menuItem(columnSortingLabels(tableLabels).sortAscending),
    )
    await expect
      .poll(() => kebab('age').ariaLabel)
      .toBe(tableLabels.withActiveCount(tableLabels.headerMenu, 1))
    blur()
    await userEvent.unhover(head('age'))
    await revealCellButtons(head('age'))
    await userEvent.hover(kebab('age'))
    await expect.poll(tooltipShown(tableLabels.headerMenu)).toBe(true)
    await screen.unmount()

    await render(
      <Grid
        kebab
        localization={{
          withActiveCount: (name: string, count: number) =>
            `${name} (${count} on)`,
        }}
      />,
    )
    await waitForGrid()
    await pressInHead('age', () => kebab('age'))
    await expect
      .poll(() => menuItem(columnSortingLabels(tableLabels).sortAscending))
      .toBeTruthy()
    await userEvent.click(
      menuItem(columnSortingLabels(tableLabels).sortAscending),
    )
    await expect
      .poll(() => kebab('age').ariaLabel)
      .toBe('Column options (1 on)')
  })

  test('AI5: точка контрастирует с фоном шапки ≥ 3:1, цифры пузырька активного тона — ≥ 4,5:1, в обеих темах; шапка и тулбар с индикаторами проходят axe с color-contrast', async () => {
    await render(<Grid />)
    await waitForGrid()
    await pressInHead('age', () => button('age', 'column-sort__button'))
    await filterName('Name 1')
    await hideCity()
    const countBubbles = () =>
      [
        ...document.querySelectorAll<HTMLElement>(
          '[data-testid="filter-summary-button"] [aria-hidden], [data-testid="column-visibility-button"] [aria-hidden]',
        ),
      ].filter(el => el.textContent?.trim())
    await expect.poll(() => countBubbles().length).toBe(2)
    blur()

    const options = {
      ...AXE_OPTIONS,
      rules: { ...AXE_OPTIONS.rules, 'color-contrast': { enabled: true } },
    }
    await inBothThemes(async () => {
      for (const id of ['age', 'name']) {
        const target =
          id === 'age'
            ? button('age', 'column-sort__button')
            : button('name', 'column-filter__button')
        const dot = dotOf(target)!
        const ratio = contrast(
          toRgba(getComputedStyle(dot).backgroundColor),
          backgroundOf(head(id)),
        )
        expect(ratio, id).toBeGreaterThanOrEqual(3)
      }
      for (const bubble of countBubbles()) {
        const style = getComputedStyle(bubble)
        expect(
          contrast(toRgba(style.color), toRgba(style.backgroundColor)),
        ).toBeGreaterThanOrEqual(4.5)
      }
      const root = document.querySelector<HTMLElement>('.data-grid-theme')!
      expect((await axe.run(root, options)).violations).toEqual([])
    })
  })

  test('AI6: --tsr-comp-active-indicator по умолчанию равен --tsr-comp-loader-bar и переопределяется темой — точка и пузырёк тона active следуют за ним; пузырёк тона по умолчанию остаётся в --tsr-comp-accent', async () => {
    await render(<Grid />)
    await waitForGrid()
    expect(tokenColor('--tsr-comp-active-indicator')).toBe(
      tokenColor('--tsr-comp-loader-bar'),
    )
    await pressInHead('age', () => button('age', 'column-sort__button'))
    await filterName('Name 1')
    const summary = () =>
      [
        ...document.querySelectorAll<HTMLElement>(
          '[data-testid="filter-summary-button"] [aria-hidden]',
        ),
      ].find(el => el.textContent?.trim())!
    await expect.poll(summary).toBeTruthy()

    const theme = document.querySelector<HTMLElement>('.data-grid-theme')!
    theme.style.setProperty('--tsr-comp-active-indicator', 'rgb(200, 30, 90)')
    settle()
    expect(
      getComputedStyle(dotOf(button('age', 'column-sort__button'))!)
        .backgroundColor,
    ).toBe('rgb(200, 30, 90)')
    expect(getComputedStyle(summary()).backgroundColor).toBe('rgb(200, 30, 90)')

    const accent = await render(
      <div className="data-grid-theme">
        <Bubble data-testid="accent-bubble">3</Bubble>
      </div>,
    )
    const plain = accent.container.querySelector<HTMLElement>(
      '[data-testid="accent-bubble"]',
    )!
    const probe = document.createElement('span')
    probe.style.backgroundColor = 'var(--tsr-comp-accent)'
    plain.parentElement!.append(probe)
    expect(getComputedStyle(plain).backgroundColor).toBe(
      getComputedStyle(probe).backgroundColor,
    )
  })

  test('AI7: «Колонки» при скрытых колонках показывают их число пузырьком тона active и называются columnsWithHidden(N); без скрытых — columns и без пузырька', async () => {
    await render(<Grid />)
    await waitForGrid()
    const columns = () =>
      document.querySelector<HTMLElement>(
        '[data-testid="column-visibility-button"]',
      )!
    const count = () =>
      [...columns().querySelectorAll<HTMLElement>('[aria-hidden]')].find(el =>
        el.textContent?.trim(),
      )
    expect(columns().ariaLabel).toBe(
      columnVisibilityLabels(tableLabels).columns,
    )
    expect(count()).toBeUndefined()

    await hideCity()
    await expect
      .poll(() => columns().ariaLabel)
      .toBe(columnVisibilityLabels(tableLabels).columnsWithHidden(1))
    expect(count()!.textContent).toBe('1')
    expect(getComputedStyle(count()!).backgroundColor).toBe(
      tokenColor('--tsr-comp-active-indicator'),
    )

    await hideCity()
    await expect
      .poll(() => columns().ariaLabel)
      .toBe(columnVisibilityLabels(tableLabels).columns)
    expect(count()).toBeUndefined()
  })

  test('AI8: точка проявляется и гаснет переходом на токенах движения; при prefers-reduced-motion: reduce переход нулевой', async () => {
    await render(<Grid />)
    await waitForGrid()
    const dot = () => dotOf(button('age', 'column-sort__button'))!
    const duration = getComputedStyle(
      document.querySelector('.data-grid-theme')!,
    )
      .getPropertyValue('--tsr-comp-motion-duration')
      .trim()
    const style = getComputedStyle(dot())
    expect(style.transitionProperty).toBe('opacity, transform')
    expect(style.transitionDuration.split(', ')).toEqual([
      `${parseFloat(duration) / 1000}s`,
      `${parseFloat(duration) / 1000}s`,
    ])

    // Переход запускается и при появлении, и при исчезновении: сортировка по
    // кругу — по возрастанию, по убыванию, сброс.
    const runs: string[] = []
    dot().addEventListener('transitionrun', event =>
      runs.push(event.propertyName),
    )
    const sort = () => button('age', 'column-sort__button')
    await pressInHead('age', sort)
    await expect.poll(() => runs.length).toBeGreaterThan(0)
    await expect.poll(() => dotShown(sort())).toBe(true)
    runs.length = 0
    await humanClick(sort())
    await humanClick(sort())
    await expect.poll(() => runs.length).toBeGreaterThan(0)
    await expect.poll(() => dotShown(sort())).toBe(false)

    await reducedMotion(true)
    expect(
      getComputedStyle(dot())
        .transitionDuration.split(', ')
        .every(value => value === '0s'),
    ).toBe(true)
  })

  test('AI11: по умолчанию значок кнопки фильтра одинаков в обычном и активном состоянии; значок из icons.filterActive приложения показывается только у активного фильтра', async () => {
    const filterIcon = () =>
      button('name', 'column-filter__button').querySelector('svg')!.outerHTML
    const screen = await render(<Grid />)
    await waitForGrid()
    const plain = filterIcon()
    await filterName('Name 1')
    expect(filterIcon()).toBe(plain)
    await screen.unmount()

    const Custom = () => <svg data-testid="custom-filter-active" />
    await render(<Grid icons={{ filterActive: Custom }} />)
    await waitForGrid()
    const custom = () =>
      button('name', 'column-filter__button').querySelector(
        '[data-testid="custom-filter-active"]',
      )
    expect(custom()).toBeNull()
    await filterName('Name 1')
    expect(custom()).not.toBeNull()
  })

  test('AI12: кнопка закрепления по умолчанию одинакова у закреплённой и незакреплённой колонки; значок icons.pinned приложения — только у закреплённой, на обычной кнопке и на кнопке с мини-меню; пункты меню остаются на pin', async () => {
    const pin = (id: string) => button(id, 'column-pin__button')
    const pinFromMenu = async (id: string) => {
      await pressInHead(id, () => pin(id))
      await expect
        .poll(() => menuItem(columnPinningLabels(tableLabels).pinLeft))
        .toBeTruthy()
      await userEvent.click(menuItem(columnPinningLabels(tableLabels).pinLeft))
      await expect
        .poll(() => head(id).getAttribute('data-cell-pinned'))
        .toBe('left')
    }

    const screen = await render(<IconGrid plugins={[columnPinning()]} />)
    await waitForGrid()
    const plain = pin('city').querySelector('svg')!.outerHTML
    await pinFromMenu('city')
    expect(pin('city').querySelector('svg')!.outerHTML).toBe(plain)
    await screen.unmount()

    await render(
      <IconGrid
        plugins={[columnPinning()]}
        icons={{ pinned: Custom('custom-pinned') }}
      />,
    )
    await waitForGrid()
    // С мини-меню (обе стороны).
    expect(customIn(pin('city'), 'custom-pinned')).toBe(false)
    await pinFromMenu('city')
    expect(customIn(pin('city'), 'custom-pinned')).toBe(true)
    await pressInHead('city', () => pin('city'))
    await expect
      .poll(() => menuItem(columnPinningLabels(tableLabels).pinLeft))
      .toBeTruthy()
    const items = [...document.querySelectorAll('[role^="menuitem"]')]
    expect(items.some(item => customIn(item, 'custom-pinned'))).toBe(false)
    await userEvent.keyboard('{Escape}')
    // Обычная кнопка (одна сторона).
    expect(customIn(pin('age'), 'custom-pinned')).toBe(false)
    await pressInHead('age', () => pin('age'))
    await expect
      .poll(() => head('age').getAttribute('data-cell-pinned'))
      .toBe('left')
    expect(customIn(pin('age'), 'custom-pinned')).toBe(true)
  })

  test('AI13: icons.grouped по умолчанию совпадает с group; значок приложения — только у сгруппированной колонки; строка кебаба остаётся на group', async () => {
    const group = () => button('city', 'column-group__button')
    const screen = await render(<IconGrid plugins={[rowGrouping()]} />)
    await waitForGrid()
    const plain = group().querySelector('svg')!.outerHTML
    await pressInHead('city', group)
    await expect
      .poll(() => group().ariaLabel)
      .toBe(rowGroupingLabels(tableLabels).ungroup)
    expect(group().querySelector('svg')!.outerHTML).toBe(plain)
    await screen.unmount()

    const icons = { grouped: Custom('custom-grouped') }
    const inline = await render(
      <IconGrid plugins={[rowGrouping()]} icons={icons} />,
    )
    await waitForGrid()
    expect(customIn(group(), 'custom-grouped')).toBe(false)
    await pressInHead('city', group)
    await expect.poll(() => customIn(group(), 'custom-grouped')).toBe(true)
    await inline.unmount()

    await render(
      <IconGrid
        plugins={[rowGrouping(), headerActionMenu({ mode: 'always' })]}
        icons={icons}
      />,
    )
    await waitForGrid()
    await pressInHead('city', () => kebab('city'))
    await expect
      .poll(() => menuItem(rowGroupingLabels(tableLabels).group))
      .toBeTruthy()
    await userEvent.click(menuItem(rowGroupingLabels(tableLabels).group))
    await pressInHead('city', () => kebab('city'))
    await expect
      .poll(() => menuItem(rowGroupingLabels(tableLabels).ungroup))
      .toBeTruthy()
    expect(
      customIn(
        menuItem(rowGroupingLabels(tableLabels).ungroup),
        'custom-grouped',
      ),
    ).toBe(false)
    await userEvent.keyboard('{Escape}')
  })

  test('AI14: icons.expanded по умолчанию совпадает с expand и шеврон раскрытой строки повёрнут; заданный приложением expanded показывается у раскрытой строки без поворота', async () => {
    const tree = [
      { ...DATA[0], subRows: [{ ...DATA[1], id: 'child' }] },
      DATA[2],
    ]
    const toggle = () =>
      document.querySelector<HTMLElement>('.row-expand-button')!
    const icon = () => toggle().querySelector('svg')!

    const screen = await render(
      <IconGrid plugins={[rowExpanding()]} data={tree} />,
    )
    await waitForGrid()
    const plain = icon().innerHTML
    await humanClick(toggle())
    await expect.poll(() => toggle().ariaExpanded).toBe('true')
    expect(icon().innerHTML).toBe(plain)
    settle()
    expect(getComputedStyle(icon()).transform).not.toBe('none')
    await screen.unmount()

    await render(
      <IconGrid
        plugins={[rowExpanding()]}
        data={tree}
        icons={{ expanded: Custom('custom-expanded') }}
      />,
    )
    await waitForGrid()
    expect(customIn(toggle(), 'custom-expanded')).toBe(false)
    await humanClick(toggle())
    await expect.poll(() => customIn(toggle(), 'custom-expanded')).toBe(true)
    settle()
    expect(getComputedStyle(icon()).transform).toBe('none')
  })

  test('AI15: публичные SortButton, PinButton, GroupButton во включённом состоянии показывают точку цвета --tsr-comp-active-indicator, в выключенном скрывают; у SortButton с номером приоритета точки нет', async () => {
    const noop = () => {}
    const Primitives = ({ on }: { on: boolean }) => (
      <div className="data-grid-theme">
        <SortButton
          operation={on ? 'asc' : false}
          nextOperation="desc"
          onClick={noop}
        />
        <PinButton pinned={on} onClick={noop} />
        <GroupButton grouped={on} onClick={noop} />
      </div>
    )
    const buttons = () =>
      ['column-sort__button', 'column-pin__button', 'column-group__button'].map(
        cls => document.querySelector<HTMLElement>(`.${cls}`)!,
      )
    const screen = await render(<Primitives on={false} />)
    for (const el of buttons()) {
      expect(dotOf(el), el.className).not.toBeNull()
      expect(dotShown(el), el.className).toBe(false)
    }
    await screen.rerender(<Primitives on />)
    const indicator = tokenColor('--tsr-comp-active-indicator')
    for (const el of buttons()) {
      expect(dotShown(el), el.className).toBe(true)
      expect(getComputedStyle(dotOf(el)!).backgroundColor).toBe(indicator)
    }
    await screen.unmount()

    await render(
      <div className="data-grid-theme">
        <SortButton
          operation="asc"
          nextOperation="desc"
          sortIndex={0}
          sortCount={2}
          onClick={noop}
        />
      </div>,
    )
    const sort = document.querySelector<HTMLElement>('.column-sort__button')!
    expect(
      sort.querySelector('[data-active-indicator]:not([data-count])'),
    ).toBeNull()
    expect(document.querySelector('[data-count="1"]')).not.toBeNull()
  })

  test('AI16: PinButton и GroupButton во включённом состоянии берут значок из icons.pinned / icons.grouped, в выключенном — из pin / group', async () => {
    const noop = () => {}
    const Primitives = ({ on }: { on: boolean }) => (
      <IconsProvider
        icons={{
          pinned: Custom('custom-pinned'),
          grouped: Custom('custom-grouped'),
        }}
      >
        <div className="data-grid-theme">
          <PinButton pinned={on} onClick={noop} />
          <GroupButton grouped={on} onClick={noop} />
        </div>
      </IconsProvider>
    )
    const pin = () => document.querySelector('.column-pin__button')
    const group = () => document.querySelector('.column-group__button')
    const screen = await render(<Primitives on={false} />)
    expect(customIn(pin(), 'custom-pinned')).toBe(false)
    expect(customIn(group(), 'custom-grouped')).toBe(false)
    expect(pin()!.querySelector('svg')).not.toBeNull()
    await screen.rerender(<Primitives on />)
    expect(customIn(pin(), 'custom-pinned')).toBe(true)
    expect(customIn(group(), 'custom-grouped')).toBe(true)
  })
})
