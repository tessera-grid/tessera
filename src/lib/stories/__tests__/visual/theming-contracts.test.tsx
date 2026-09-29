import { type ReactNode } from 'react'

import { Toolbar } from '@base-ui/react/toolbar'

import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { RowButton } from '../../../grid/Actions/RowButton'
import { DragHandler } from '../../../grid/dnd/DragHandler'
import { PinButton } from '../../../plugins/columnPinning/PinButton'
import { SortButton } from '../../../plugins/columnSorting/SortButton'
import { GroupButton } from '../../../plugins/rowGrouping/GroupButton'
import { SelectCheckbox } from '../../../plugins/rowSelection/SelectCheckbox'
import { IconButton } from '../../../ui/IconButton'
import { Switch } from '../../../ui/Switch'
import { ToolbarButton } from '../../../ui/ToolbarButton'
import '../../../core/themeVariables/theme.css'

// Контракт стилевых признаков по СЕМЕЙСТВАМ компонентов. Проверяет,
// что члены одного семейства делят единые признаки: кнопки/иконки (F1/F2) — единый
// disabled-цвет, единую transition и единый радиус; форм-контролы (F3) — единую
// disabled-прозрачность и единую transition. Новый компонент семейства добавляется
// в его список members и обязан пройти весь контракт.

const resolveColor = (token: string): string => {
  const el = document.createElement('div')
  el.className = 'data-grid-theme'
  el.style.backgroundColor = `var(${token})`
  document.body.appendChild(el)
  const value = getComputedStyle(el).backgroundColor
  el.remove()
  return value
}

const read = (el: Element, prop: string) =>
  getComputedStyle(el).getPropertyValue(prop).trim()

async function renderThemed(node: ReactNode) {
  const { container } = await render(
    <div className="data-grid-theme">{node}</div>,
  )
  return container
}

const noop = () => {}

// F1 (icon-контролы) + F2 (action-кнопки): все на базе IconButton, кроме
// DragHandler (кастомный div, но обязан делить disabled-цвет).
type Member = {
  name: string
  sel: string
  node: (disabled: boolean) => ReactNode
}

const BUTTON_FAMILY: Member[] = [
  {
    name: 'IconButton',
    sel: 'button',
    node: d => (
      <IconButton disabled={d}>
        <span>x</span>
      </IconButton>
    ),
  },
  {
    name: 'SortButton',
    sel: '.column-sort__button',
    node: d => (
      <SortButton
        operation={false}
        nextOperation="asc"
        onClick={noop}
        disabled={d}
      />
    ),
  },
  {
    name: 'PinButton',
    sel: '.column-pin__button',
    node: d => <PinButton isPinned={false} onClick={noop} disabled={d} />,
  },
  {
    name: 'GroupButton',
    sel: '.column-group__button',
    node: d => <GroupButton isGrouped={false} onClick={noop} disabled={d} />,
  },
  {
    name: 'RowButton',
    sel: 'button',
    node: d => (
      <RowButton
        title="a"
        icon={<span>i</span>}
        onClick={noop}
        disabled={d}
        isVisible
      />
    ),
  },
]

// F4 (кнопка тулбара, ADR 0035): делит с F1/F2 disabled-цвет и transition, но не
// радиус — она квадратная. Живёт только внутри Toolbar.Root.
const toolbarButton = async (disabled: boolean) =>
  (
    await renderThemed(
      <Toolbar.Root>
        <ToolbarButton label="a" icon={<span>i</span>} disabled={disabled} />
      </Toolbar.Root>,
    )
  ).querySelector<HTMLElement>('button')!

const el = async (m: Member, disabled: boolean) =>
  (await renderThemed(m.node(disabled))).querySelector<HTMLElement>(m.sel)!

describe('Style contract by component family', () => {
  test('TC-1 button family shares ONE disabled color = --tsr-comp-control-disabled-color', async () => {
    const expected = resolveColor('--tsr-comp-control-disabled-color')
    for (const m of BUTTON_FAMILY) {
      // eslint-disable-next-line no-await-in-loop
      const node = await el(m, true)
      expect(read(node, 'color'), `${m.name} disabled color`).toBe(expected)
    }
    // DragHandler — кастомный контрол того же семейства, тот же disabled-цвет.
    const dh = (
      await renderThemed(
        <DragHandler id="c" type="column" disabled onClick={noop} />,
      )
    ).querySelector<HTMLElement>('.drag__handler--column')!
    expect(read(dh, 'color'), 'DragHandler disabled color').toBe(expected)
    expect(
      read(await toolbarButton(true), 'color'),
      'ToolbarButton disabled color',
    ).toBe(expected)
  })

  test('TC-2 button family shares ONE transition', async () => {
    const values: string[] = []
    for (const m of BUTTON_FAMILY) {
      // eslint-disable-next-line no-await-in-loop
      const node = await el(m, false)
      values.push(read(node, 'transition'))
    }
    values.push(read(await toolbarButton(false), 'transition'))
    expect(values.every(v => v && v === values[0])).toBe(true)
  })

  test('TC-3 button family shares ONE radius = --tsr-comp-radius-round (50%)', async () => {
    for (const m of BUTTON_FAMILY) {
      // eslint-disable-next-line no-await-in-loop
      const node = await el(m, false)
      expect(read(node, 'border-top-left-radius'), `${m.name} radius`).toBe(
        '50%',
      )
    }
  })

  test('TC-4 form controls share ONE disabled opacity = --tsr-comp-disabled-opacity', async () => {
    const cb = (
      await renderThemed(
        <SelectCheckbox selected={false} disabled onClick={noop} />,
      )
    ).querySelector<HTMLElement>('[role="checkbox"]')!
    const sw = (
      await renderThemed(<Switch defaultChecked={false} disabled />)
    ).querySelector<HTMLElement>('[role="switch"]')!
    expect(read(cb, 'opacity')).toBe('0.5')
    expect(read(sw, 'opacity')).toBe('0.5')
  })

  test('TC-5 form controls share ONE transition', async () => {
    const cb = (
      await renderThemed(<SelectCheckbox selected={false} onClick={noop} />)
    ).querySelector<HTMLElement>('[role="checkbox"]')!
    const sw = (
      await renderThemed(<Switch defaultChecked={false} />)
    ).querySelector<HTMLElement>('[role="switch"]')!
    const a = read(cb, 'transition')
    expect(a).toBeTruthy()
    expect(read(sw, 'transition')).toBe(a)
  })
})
