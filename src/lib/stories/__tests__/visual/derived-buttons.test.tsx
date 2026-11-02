import type { ReactElement } from 'react'

import { Toolbar } from '@base-ui/react/toolbar'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test, vi } from 'vitest'

import { CellButton } from '@/lib/ui/CellButton/CellButton'
import { RowButton } from '@/lib/ui/RowButton/RowButton'
import { PinButton } from '@/lib/plugins/columnPinning/PinButton'
import { SortButton } from '@/lib/plugins/columnSorting/SortButton'
import { ExpandButton } from '@/lib/plugins/rowExpanding/ExpandButton'
import { GroupButton } from '@/lib/plugins/rowGrouping/GroupButton'
import type { DerivedButtonProps } from '@/lib/ui/IconButton'
import { ToolbarButton } from '@/lib/ui/ToolbarButton'
import { SvgIcon } from '@/lib/ui/icons'
import { UiCanvas } from '../../__mocks__/UiCanvas'
import { pendingArcOf } from '../helpers'

// Единый контракт производных кнопок кита (ADR 0128, DB1–DB2, DB5). DB3–DB4 — модульный
// `derivedButtons`.

type Props = DerivedButtonProps & { revealOnHover?: boolean; on?: boolean }

interface Case {
  name: string
  host?: 'cell' | 'head' | 'row'
  /** Кнопка ячейки, заголовка или строки — с `revealOnHover`. */
  reveals: boolean
  /** Есть своё включённое состояние. */
  stateful: boolean
  render: (props: Props) => ReactElement
}

const icon = <SvgIcon width={16} height={16} />

const CASES: Case[] = [
  {
    name: 'CellButton',
    host: 'cell',
    reveals: true,
    stateful: true,
    render: ({ on = false, ...props }) => (
      <CellButton label="Edit cell" icon={icon} active={on} {...props} />
    ),
  },
  {
    name: 'RowButton',
    host: 'row',
    reveals: true,
    stateful: true,
    render: ({ on = false, ...props }) => (
      <RowButton label="Row options" icon={icon} active={on} {...props} />
    ),
  },
  {
    name: 'ExpandButton',
    host: 'cell',
    reveals: false,
    stateful: true,
    render: ({ on = false, revealOnHover: _r, ...props }) => (
      <ExpandButton expanded={on} {...props} />
    ),
  },
  {
    name: 'GroupButton',
    host: 'head',
    reveals: true,
    stateful: true,
    render: ({ on = false, ...props }) => (
      <GroupButton grouped={on} {...props} />
    ),
  },
  {
    name: 'PinButton',
    host: 'head',
    reveals: true,
    stateful: true,
    render: ({ on = false, ...props }) => <PinButton pinned={on} {...props} />,
  },
  {
    name: 'SortButton',
    host: 'head',
    reveals: true,
    stateful: true,
    render: ({ on = false, ...props }) => (
      <SortButton
        operation={on ? 'asc' : false}
        nextOperation={on ? 'desc' : 'asc'}
        {...props}
      />
    ),
  },
  {
    name: 'ToolbarButton',
    reveals: false,
    stateful: true,
    render: ({ on = false, revealOnHover: _r, ...props }) => (
      <Toolbar.Root>
        <ToolbarButton label="Columns" icon={icon} active={on} {...props} />
      </Toolbar.Root>
    ),
  },
]

const View = ({ item, props }: { item: Case; props: Props }) => (
  <>
    <div data-testid="away" style={{ height: 40 }} />
    <UiCanvas host={item.host} caption="Cell" width={240}>
      {item.render(props)}
    </UiCanvas>
  </>
)

const button = () =>
  document.querySelector<HTMLButtonElement>('[data-testid="kit"]')!
const away = () => document.querySelector<HTMLElement>('[data-testid="away"]')!
const host = () =>
  document.querySelector<HTMLElement>(
    '.data-grid__body-cell, .data-grid__head-cell, .data-grid__body-row',
  )!

/** Видна ли кнопка: обёртка ячейки раскрыта, у чипа строки — цвет значка. */
const shown = (item: Case) => {
  const el = button()
  if (item.host === 'row') {
    return getComputedStyle(el).color !== 'rgba(0, 0, 0, 0)'
  }
  const wrapper = el.closest<HTMLElement>('.cell__button')!
  return (
    getComputedStyle(wrapper).opacity === '1' &&
    wrapper.getBoundingClientRect().width > 0
  )
}

const tooltipText = () =>
  [...document.querySelectorAll('[data-side]')]
    .map(el => el.textContent?.trim())
    .find(Boolean)

describe('Производные кнопки кита (ADR 0128)', () => {
  test('DB1: все семь кнопок принимают disabled, tooltipWhenDisabled, pending, failed, onClick с событием и data-testid; занятая — aria-busy и дуга, нажатия не доходят; failed — дуга встаёт, отметки нет; выключенная с tooltipWhenDisabled — тултип при наведении', async () => {
    for (const item of CASES) {
      const onClick = vi.fn()
      const base: Props = {
        onClick,
        'data-testid': 'kit',
        ...(item.reveals && { revealOnHover: false }),
      }
      const screen = await render(<View item={item} props={base} />)
      await userEvent.click(button())
      expect(onClick, item.name).toHaveBeenCalledTimes(1)
      expect(onClick.mock.calls[0]![0].type, item.name).toBe('click')

      await screen.rerender(
        <View item={item} props={{ ...base, pending: true }} />,
      )
      expect(button().getAttribute('aria-busy'), item.name).toBe('true')
      expect(pendingArcOf(button())?.dataset.phase, item.name).toBe('pending')
      await userEvent.click(button())
      expect(onClick, `${item.name}: занятая`).toHaveBeenCalledTimes(1)

      await screen.rerender(
        <View item={item} props={{ ...base, failed: true }} />,
      )
      expect(pendingArcOf(button())?.dataset.phase, item.name).toBe('stopping')
      expect(
        button().querySelector('[data-failure-indicator]'),
        item.name,
      ).toBeNull()

      await screen.rerender(
        <View
          item={item}
          props={{ ...base, disabled: true, tooltipWhenDisabled: true }}
        />,
      )
      expect(button().getAttribute('aria-disabled'), item.name).toBe('true')
      await userEvent.hover(button())
      await expect
        .poll(tooltipText, { timeout: 2000 })
        .toBe(button().getAttribute('aria-label'))
      await userEvent.click(button(), { force: true })
      expect(onClick, `${item.name}: выключенная`).toHaveBeenCalledTimes(1)
      await userEvent.hover(away())
      await screen.unmount()
    }
  })

  test('DB2: revealOnHover у кнопок ячейки, заголовка и строки — по умолчанию скрыта и видна при наведении на своё место; false — видна всегда; включённая и занятая видна без наведения', async () => {
    for (const item of CASES.filter(entry => entry.reveals)) {
      const base: Props = { 'data-testid': 'kit' }
      const screen = await render(<View item={item} props={base} />)
      await userEvent.hover(away())
      await expect.poll(() => shown(item), { timeout: 2000 }).toBe(false)
      await userEvent.hover(host())
      await expect.poll(() => shown(item), { timeout: 2000 }).toBe(true)
      await userEvent.hover(away())
      await expect.poll(() => shown(item), { timeout: 2000 }).toBe(false)

      const visible = async (props: Props, what: string) => {
        await screen.rerender(
          <View item={item} props={{ ...base, ...props }} />,
        )
        await expect
          .poll(() => shown(item), {
            timeout: 2000,
            message: `${item.name}: ${what}`,
          })
          .toBe(true)
        await screen.rerender(<View item={item} props={base} />)
        await expect.poll(() => shown(item), { timeout: 2000 }).toBe(false)
      }
      await visible({ revealOnHover: false }, 'revealOnHover=false')
      await visible({ pending: true }, 'занятая')
      if (item.stateful) await visible({ on: true }, 'включённая')
      await screen.unmount()
    }
  })

  test('DB5: CellButton и RowButton с active — цвет --tsr-comp-control-active-color и точка включённого действия в правом верхнем углу; без active — цвет покоя --tsr-comp-button-color, точки нет', async () => {
    const settle = () =>
      document
        .getAnimations()
        .filter(a => a.effect?.getTiming().iterations !== Infinity)
        .forEach(a => a.finish())
    const tokenColor = (token: string) => {
      const probe = document.createElement('span')
      probe.style.color = `var(${token})`
      document.querySelector('.data-grid-theme')!.append(probe)
      const color = getComputedStyle(probe).color
      probe.remove()
      return color
    }
    const dot = () =>
      button().querySelector<HTMLElement>('[data-active-indicator]')
    for (const item of CASES.filter(entry =>
      ['CellButton', 'RowButton'].includes(entry.name),
    )) {
      const base: Props = { 'data-testid': 'kit', revealOnHover: false }
      const screen = await render(
        <View item={item} props={{ ...base, on: true }} />,
      )
      await userEvent.hover(away())
      settle()
      expect(getComputedStyle(button()).color, item.name).toBe(
        tokenColor('--tsr-comp-control-active-color'),
      )
      expect(getComputedStyle(dot()!).opacity, `${item.name}: точка`).toBe('1')
      const box = button().getBoundingClientRect()
      const mark = dot()!.getBoundingClientRect()
      expect(mark.left + mark.width / 2, item.name).toBeGreaterThan(
        box.left + box.width / 2,
      )
      expect(mark.top + mark.height / 2, item.name).toBeLessThan(
        box.top + box.height / 2,
      )

      await screen.rerender(<View item={item} props={base} />)
      settle()
      expect(getComputedStyle(button()).color, item.name).toBe(
        tokenColor('--tsr-comp-button-color'),
      )
      expect(
        dot() === null || getComputedStyle(dot()!).opacity === '0',
        `${item.name}: без точки`,
      ).toBe(true)
      await screen.unmount()
    }
  })
})
