import axe from 'axe-core'
import { Toolbar } from '@base-ui/react/toolbar'
import { commands, server, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test } from 'vitest'

import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { CellButton } from '../../../grid/Actions/CellButton'
import { RowButton } from '../../../grid/Actions/RowButton'
import { columnFiltering, columnVisibility } from '../../../plugins'
import { PinButton } from '../../../plugins/columnPinning/PinButton'
import { SortButton } from '../../../plugins/columnSorting/SortButton'
import { ExpandButton } from '../../../plugins/rowExpanding/ExpandButton'
import { GroupButton } from '../../../plugins/rowGrouping/GroupButton'
import { IconButton, type IconButtonProps } from '../../../ui/IconButton'
import { ToolbarButton } from '../../../ui/ToolbarButton'
import { IconsProvider, SvgIcon } from '../../../ui/icons'
import { UiCanvas } from '../../__mocks__/UiCanvas'
import { humanClick } from '../helpers'
import { AXE_OPTIONS, contrast, inBothThemes, toRgba } from './a11y-helpers'
import { waitForGrid } from './core-helpers'

// Включённое состояние кнопок (ADR 0129, AV1–AV3, AV5–AV7, AV10): бабл в базе
// `IconButton` — точка, число `count`, свой значок; ожидание и отказ главнее бабла.
// AV4, AV8–AV9 — модульный `activeState.dom`, AV11 — перф в `scroll`.

const fc = commands as unknown as {
  forcedColors: (active: boolean) => Promise<void>
  reducedMotion: (reduce: boolean) => Promise<void>
}

afterEach(() => document.documentElement.classList.remove('dark'))

const settle = () =>
  document
    .getAnimations()
    .filter(a => a.effect?.getTiming().iterations !== Infinity)
    .forEach(a => a.finish())

const kit = () =>
  document.querySelector<HTMLButtonElement>('[data-testid="kit"]')!
const bubbleOf = (el: Element) =>
  el.querySelector<HTMLElement>('[data-active-indicator]')
const shown = (el: Element) => {
  settle()
  const bubble = bubbleOf(el)
  return !!bubble && getComputedStyle(bubble).opacity === '1'
}
const tokenColor = (token: string) => {
  const probe = document.createElement('span')
  probe.style.backgroundColor = `var(${token})`
  document.querySelector('.data-grid-theme')!.append(probe)
  const color = getComputedStyle(probe).backgroundColor
  probe.remove()
  return color
}
const box = (el: Element) => el.getBoundingClientRect()

const Kit = (props: Partial<IconButtonProps>) => (
  <UiCanvas>
    <IconButton label="Filter" data-testid="kit" errorFlash={0} {...props}>
      <SvgIcon width={16} height={16} data-testid="base-icon" />
    </IconButton>
  </UiCanvas>
)

describe('Включённое состояние кнопок (ADR 0129)', () => {
  test('AV1: IconButton с active — цвет --tsr-comp-control-active-color и бабл-точка --tsr-comp-active-indicator в правом верхнем углу; размер кнопки не меняется, точка появляется и исчезает через токены движения; пока кнопка ждёт ответа или вспыхивает отказом, бабла нет, после успеха он возвращается', async () => {
    const screen = await render(<Kit active={false} />)
    const rest = box(kit())
    expect(bubbleOf(kit())).not.toBeNull()
    expect(shown(kit())).toBe(false)

    await screen.rerender(<Kit active />)
    expect(shown(kit())).toBe(true)
    expect(getComputedStyle(kit()).color).toBe(
      tokenColor('--tsr-comp-control-active-color'),
    )
    const dot = bubbleOf(kit())!
    expect(getComputedStyle(dot).backgroundColor).toBe(
      tokenColor('--tsr-comp-active-indicator'),
    )
    const now = box(kit())
    expect([now.width, now.height]).toEqual([rest.width, rest.height])
    const mark = box(dot)
    expect(mark.right).toBeLessThanOrEqual(now.right)
    expect(mark.top).toBeGreaterThanOrEqual(now.top)
    expect(mark.left + mark.width / 2).toBeGreaterThan(now.left + now.width / 2)
    expect(mark.top + mark.height / 2).toBeLessThan(now.top + now.height / 2)

    const duration = getComputedStyle(
      document.querySelector('.data-grid-theme')!,
    )
      .getPropertyValue('--tsr-comp-motion-duration')
      .trim()
    const motion = getComputedStyle(dot)
    expect(motion.transitionProperty).toBe('opacity, transform')
    expect(motion.transitionDuration.split(', ')).toEqual([
      `${parseFloat(duration) / 1000}s`,
      `${parseFloat(duration) / 1000}s`,
    ])

    await screen.rerender(<Kit active pending />)
    expect(shown(kit()), 'ожидание').toBe(false)
    await screen.rerender(<Kit active pending={false} />)
    await expect
      .poll(() => shown(kit()), { timeout: 3000, message: 'успех' })
      .toBe(true)
    await screen.rerender(<Kit active errorFlash={1} />)
    expect(kit().getAttribute('data-error-flash')).toBe('on')
    expect(shown(kit()), 'вспышка отказа').toBe(false)
    await screen.unmount()
  })

  test('AV2: у включённой кнопки с count > 0 бабл показывает число и растёт под него; стоит на углу кнопки, как номер приоритета мультисортировки, размер кнопки и раскладка не меняются; числа больше 99 — «99+»; без active числа нет', async () => {
    const screen = await render(<Kit active count={3} />)
    const bubble = () => bubbleOf(kit())!
    expect(shown(kit())).toBe(true)
    expect(bubble().textContent).toBe('3')
    expect(box(bubble()).height).toBeGreaterThan(6)
    const button = box(kit())
    expect([button.width, button.height]).toEqual([32, 32])
    expect(box(bubble()).right).toBeGreaterThan(button.right)
    expect(box(bubble()).top).toBeLessThan(button.top)
    const offset = (el: Element) => [
      box(bubbleOf(el)!).right - box(el).right,
      box(el).top - box(bubbleOf(el)!).top,
    ]
    const kitOffset = offset(kit())

    // Так же стоит номер приоритета мультисортировки.
    await screen.unmount()
    const sort = await render(
      <UiCanvas host="head">
        <SortButton
          operation="asc"
          nextOperation="desc"
          sortIndex={0}
          sortCount={2}
          data-testid="kit"
        />
      </UiCanvas>,
    )
    settle()
    expect(bubble().textContent).toBe('1')
    const [dx, dy] = offset(kit())
    expect(dx).toBeCloseTo(kitOffset[0]!, 0)
    expect(dy).toBeCloseTo(kitOffset[1]!, 0)
    await sort.unmount()

    const again = await render(<Kit active count={150} />)
    expect(bubble().textContent).toBe('99+')
    await again.rerender(<Kit active={false} count={3} />)
    expect(shown(kit()), 'без active').toBe(false)
    await again.unmount()
  })

  test('AV3: activeIcon заменяет значок у включённой кнопки, бабл остаётся; indicator={false} убирает бабл, цвет значка остаётся', async () => {
    const custom = <SvgIcon width={16} height={16} data-testid="active-icon" />
    const icons = () => ({
      base: kit().querySelector('[data-testid="base-icon"]'),
      custom: kit().querySelector('[data-testid="active-icon"]'),
    })
    const screen = await render(<Kit active={false} activeIcon={custom} />)
    expect(icons().base).not.toBeNull()
    expect(icons().custom).toBeNull()

    await screen.rerender(<Kit active activeIcon={custom} />)
    expect(icons().base).toBeNull()
    expect(icons().custom).not.toBeNull()
    expect(shown(kit())).toBe(true)

    await screen.rerender(<Kit active indicator={false} />)
    expect(shown(kit())).toBe(false)
    expect(getComputedStyle(kit()).color).toBe(
      tokenColor('--tsr-comp-control-active-color'),
    )
    await screen.unmount()
  })

  test('AV5: производные кнопки рисуют знак через базу — ToolbarButton, CellButton и RowButton принимают active, count, activeIcon и indicator; PinButton, GroupButton и SortButton выводят их из своего состояния и значков icons; «Колонки» и «Фильтры» показывают счётчик через count', async () => {
    const icon = <SvgIcon width={16} height={16} />
    const pinnedIcon = () => <svg data-testid="pinned-icon" />
    const groupedIcon = () => <svg data-testid="grouped-icon" />
    const primitives = await render(
      <IconsProvider icons={{ pinned: pinnedIcon, grouped: groupedIcon }}>
        <UiCanvas>
          <Toolbar.Root>
            <ToolbarButton
              label="Columns, 2 hidden"
              icon={icon}
              active
              count={2}
              data-testid="toolbar"
            />
          </Toolbar.Root>
          <CellButton
            label="Note, set"
            icon={icon}
            active
            activeIcon={<svg data-testid="cell-active-icon" />}
            revealOnHover={false}
            data-testid="cell"
          />
          <RowButton
            label="Flags, 4"
            icon={icon}
            active
            count={4}
            revealOnHover={false}
            data-testid="row"
          />
          <RowButton
            label="Flags, set"
            icon={icon}
            active
            indicator={false}
            revealOnHover={false}
            data-testid="row-plain"
          />
          <PinButton pinned revealOnHover={false} data-testid="pin" />
          <GroupButton grouped revealOnHover={false} data-testid="group" />
          <SortButton
            operation="asc"
            nextOperation="desc"
            sortIndex={1}
            sortCount={2}
            revealOnHover={false}
            data-testid="sort"
          />
        </UiCanvas>
      </IconsProvider>,
    )
    const byId = (id: string) =>
      document.querySelector<HTMLButtonElement>(`[data-testid="${id}"]`)!
    for (const id of ['toolbar', 'cell', 'row', 'pin', 'group', 'sort']) {
      expect(shown(byId(id)), id).toBe(true)
    }
    expect(shown(byId('row-plain'))).toBe(false)
    expect(bubbleOf(byId('toolbar'))!.textContent).toBe('2')
    expect(bubbleOf(byId('row'))!.textContent).toBe('4')
    expect(bubbleOf(byId('sort'))!.textContent).toBe('2')
    expect(
      byId('cell').querySelector('[data-testid="cell-active-icon"]'),
    ).not.toBeNull()
    expect(
      byId('pin').querySelector('[data-testid="pinned-icon"]'),
    ).not.toBeNull()
    expect(
      byId('group').querySelector('[data-testid="grouped-icon"]'),
    ).not.toBeNull()

    await primitives.unmount()

    // Настоящий тулбар: счётчики — бабл базы на углу кнопки.
    const Grid = () => {
      const table = useCreateTable({
        columns: [
          { id: 'name', accessorKey: 'name', header: 'Name', filter: 'text' },
          { id: 'city', accessorKey: 'city', header: 'City', filter: 'text' },
        ] as never,
        data: [
          { id: '1', name: 'Alice', city: 'Rome' },
          { id: '2', name: 'Bob', city: 'Paris' },
        ],
        getRowId: (row: { id: string }) => row.id,
        plugins: [
          columnVisibility(),
          columnFiltering({
            initialColumnFilters: [
              { id: 'name', value: { operator: 'contains', value: 'a' } },
              { id: 'city', value: { operator: 'contains', value: 'r' } },
            ] as never,
          }),
        ] as never,
      })
      return (
        <div style={{ width: 600, height: 300 }}>
          <DataGrid table={table as never} />
        </div>
      )
    }
    await render(<Grid />)
    await waitForGrid()
    const filters = () => byId('filter-summary-button')
    const columns = () => byId('column-visibility-button')
    // Тулбар — ленивый модуль (ADR 0046, PB6).
    await expect
      .poll(() => filters() && bubbleOf(filters())?.dataset.count)
      .toBe('2')
    expect(bubbleOf(filters())!.getAttribute('data-count')).toBe('2')
    expect(shown(filters())).toBe(true)
    expect(box(bubbleOf(filters())!).right).toBeGreaterThan(
      box(filters()).right,
    )

    await humanClick(columns())
    const checkbox = () =>
      document.querySelector<HTMLElement>(
        '[data-testid="column-visibility-menu"] [data-column-id="city"] [role="checkbox"]',
      )
    await expect.poll(checkbox).not.toBeNull()
    await userEvent.click(checkbox()!)
    await userEvent.keyboard('{Escape}')
    await expect
      .poll(() => bubbleOf(columns())?.getAttribute('data-count'))
      .toBe('1')
    expect(shown(columns())).toBe(true)
  })

  test('AV6: ExpandButton не принимает active, count, activeIcon и indicator; раскрытую строку показывают поворот шеврона и aria-expanded, бабла нет', async () => {
    // @ts-expect-error — у раскрытия нет включённого состояния (ADR 0129, §1).
    void (<ExpandButton expanded active count={1} indicator />)
    const screen = await render(
      <UiCanvas host="cell">
        <ExpandButton expanded={false} data-testid="kit" />
      </UiCanvas>,
    )
    const chevron = () => kit().querySelector('svg')!
    const before = getComputedStyle(chevron()).transform
    await screen.rerender(
      <UiCanvas host="cell">
        <ExpandButton expanded data-testid="kit" />
      </UiCanvas>,
    )
    settle()
    expect(kit().getAttribute('aria-expanded')).toBe('true')
    expect(getComputedStyle(chevron()).transform).not.toBe(before)
    expect(bubbleOf(kit())).toBeNull()
    expect(kit().querySelector('[data-active-indicator]')).toBeNull()
    await screen.unmount()
  })

  test('AV7: пока на кнопке отметка отказа, на месте бабла (точки или числа) — красная точка отказа, цвет значка остаётся включённым; отметку сняли — бабл вернулся', async () => {
    const failure = () =>
      kit().querySelector<HTMLElement>('[data-failure-indicator]')!
    for (const count of [undefined, 3]) {
      const screen = await render(
        <Kit active count={count} failure="Failed: offline" />,
      )
      settle()
      expect(shown(kit()), `count=${count}`).toBe(false)
      expect(getComputedStyle(failure()).opacity).toBe('1')
      expect(getComputedStyle(kit()).color).toBe(
        tokenColor('--tsr-comp-control-active-color'),
      )
      await screen.rerender(<Kit active count={count} />)
      expect(shown(kit()), `count=${count}: снята`).toBe(true)
      await screen.unmount()
    }
  })

  test('AV10: бабл-точка, число и свой значок: forced-colors и axe с color-contrast в обеих темах', async () => {
    const Buttons = () => (
      <UiCanvas>
        <IconButton label="Filter, set" active data-testid="dot">
          <SvgIcon width={16} height={16} />
        </IconButton>
        <IconButton label="Filters, 3" active count={3} data-testid="count">
          <SvgIcon width={16} height={16} />
        </IconButton>
        <IconButton
          label="Locked"
          active
          activeIcon={<SvgIcon width={16} height={16} />}
          data-testid="icon"
        >
          <SvgIcon width={16} height={16} />
        </IconButton>
      </UiCanvas>
    )
    await render(<Buttons />)
    const byId = (id: string) =>
      document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!
    const canvas = () =>
      document.querySelector<HTMLElement>('.data-grid-theme')!
    const options = {
      ...AXE_OPTIONS,
      rules: { ...AXE_OPTIONS.rules, 'color-contrast': { enabled: true } },
    }
    const check = async (mode: string) => {
      settle()
      const background = toRgba(getComputedStyle(byId('dot')).backgroundColor)
      const surface = background[3]
        ? background
        : toRgba(getComputedStyle(canvas()).backgroundColor)
      for (const id of ['dot', 'icon']) {
        const dot = bubbleOf(byId(id))!
        expect(
          contrast(toRgba(getComputedStyle(dot).backgroundColor), surface),
          `${mode}: ${id}`,
        ).toBeGreaterThanOrEqual(3)
      }
      const number = getComputedStyle(bubbleOf(byId('count'))!)
      expect(
        contrast(toRgba(number.color), toRgba(number.backgroundColor)),
        `${mode}: число`,
      ).toBeGreaterThanOrEqual(4.5)
      expect((await axe.run(canvas(), options)).violations, mode).toEqual([])
    }
    await inBothThemes(() =>
      check(
        document.documentElement.classList.contains('dark') ? 'dark' : 'light',
      ),
    )
    if (server.browser !== 'webkit') {
      await fc.forcedColors(true)
      try {
        await check('forced-colors')
      } finally {
        await fc.forcedColors(false)
      }
    }
  })
})
