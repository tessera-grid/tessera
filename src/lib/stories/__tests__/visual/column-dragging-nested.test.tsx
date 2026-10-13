import axe from 'axe-core'
import { commands, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { DEFAULT_LABELS } from '../../../core/localization'
import { firePointer, nextFrame } from '../../rowDragging.dnd'
import { revealCellButtons } from '../helpers'
import { composed } from '../stories'
import { pinViaPopover, withWideViewport } from './column-pinning-helpers'

// Перетаскивание под вложенной шапкой (ADR 0052): ND1–ND5, ND7, ND10, ND12–ND13,
// ND15. ND6, ND8–ND9, ND11 — модульные; ND14 — перф в `interaction`.
// Настоящая мышь Playwright — `realDrag`; разгар перетаскивания (ND4) удерживается
// синтетическими pointer-событиями, как в column-dragging.

const realDrag = (
  commands as unknown as {
    realDrag: (
      from: { x: number; y: number },
      to: { x: number; y: number },
    ) => Promise<void>
  }
).realDrag

const HEAD_CELL = '.data-grid__head-cell'
const HANDLE = '.drag__handler--column'
const BODY_ROW = '.data-grid__body-row'
const OVERLAY = '.data-grid-head__cell--overlay'

type Args = Partial<Parameters<typeof composed.HeaderGroupsDragging>[0]>

const mount = async (args: Args = {}) => {
  const result = await render(
    <composed.HeaderGroupsDragging enableRowDragging={false} {...args} />,
  )
  await expect
    .poll(() => document.querySelectorAll(`${BODY_ROW} [aria-colindex]`).length)
    .toBeGreaterThan(0)
  return result
}

/** Ячейка узла: у сегментов одной группы — незакреплённая, если не сказано иное. */
const head = (id: string, pinned = 'false') =>
  document.querySelector<HTMLElement>(
    `${HEAD_CELL}[data-column-id='${id}'][data-cell-pinned='${pinned}']`,
  ) ??
  document.querySelector<HTMLElement>(`${HEAD_CELL}[data-column-id='${id}']`)!
const handleOf = (id: string) => head(id).querySelector<HTMLElement>(HANDLE)!
const box = (el: Element) => el.getBoundingClientRect()
const center = (el: Element) => {
  const r = box(el)
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

/** Порядок листьев по первой строке тела. */
const leafOrder = () =>
  [
    ...document
      .querySelector(BODY_ROW)!
      .querySelectorAll<HTMLElement>('.data-grid__body-cell'),
  ]
    .filter(cell => cell.getAttribute('data-actions-column-cell') !== 'true')
    .sort((a, b) => box(a).left - box(b).left)
    .map(cell => cell.getAttribute('data-column-id'))

/** Протащить ручку узла настоящей мышью к точке `x` той же высоты. */
const dragTo = async (id: string, x: number) => {
  // Ручка раскрывается плавно (ADR 0076): нажатие посреди раскрытия уходит мимо.
  await revealCellButtons(head(id))
  const from = center(handleOf(id))
  await realDrag(from, { x, y: from.y })
}

/** Переходы `transform` после броска доиграли. */
const settled = () =>
  expect
    .poll(() =>
      [...document.querySelectorAll<HTMLElement>(HEAD_CELL)].every(
        cell => cell.getAnimations().length === 0,
      ),
    )
    .toBe(true)

/** Ячейки группы и её листья идут подряд и охватывают ровно свои листья. */
const expectSpans = (group: string, leaves: string[]) => {
  const order = leafOrder()
  const at = leaves.map(id => order.indexOf(id)).sort((a, b) => a - b)
  expect(at.at(-1)! - at[0], `${group} contiguous`).toBe(leaves.length - 1)
  const first = box(head(order[at[0]]!))
  const last = box(head(order[at.at(-1)!]!))
  const cell = box(head(group))
  expect(Math.round(cell.left)).toBe(Math.round(first.left))
  expect(Math.round(cell.right)).toBe(Math.round(last.right))
}

const translateX = (el: HTMLElement) =>
  new DOMMatrixReadOnly(getComputedStyle(el).transform).m41

const menu = () => document.querySelector<HTMLElement>('[role="menu"]')
const menuItem = (label: string) =>
  [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
    item => item.textContent?.trim() === label,
  )!
const isDisabled = (item: HTMLElement) =>
  item.getAttribute('aria-disabled') === 'true' ||
  item.hasAttribute('data-disabled')
const openMenu = async (id: string) => {
  await userEvent.hover(head(id))
  await userEvent.click(handleOf(id))
  await expect.poll(menu).toBeTruthy()
}

describe('DnD under nested headers', () => {
  test('ND1: a leaf under a group is dragged with the mouse among its group siblings; the group stays whole', async () => {
    await withWideViewport(async () => {
      await mount()
      expect(leafOrder().slice(1, 3)).toEqual(['firstName', 'lastName'])
      await dragTo('lastName', box(head('firstName')).left + 5)
      await expect
        .poll(() => leafOrder().slice(1, 3))
        .toEqual(['lastName', 'firstName'])
      await settled()
      expectSpans('name', ['firstName', 'lastName'])
    })
  })

  test('ND2: a group is dragged with the mouse among its level siblings as one block of leaves', async () => {
    await withWideViewport(async () => {
      await mount()
      await dragTo('info', box(head('name')).left + 5)
      await expect
        .poll(leafOrder)
        .toEqual([
          'country',
          'age',
          'gender',
          'visits',
          'firstName',
          'lastName',
          'total',
        ])
      await settled()
      expectSpans('info', ['age', 'gender', 'visits'])
      expectSpans('more-info', ['age', 'gender'])
    })
  })

  test('ND3: dropping past the parent edge pins the node to that edge; the header structure does not change', async () => {
    await withWideViewport(async () => {
      await mount()
      await dragTo('visits', 2)
      await expect
        .poll(leafOrder)
        .toEqual([
          'country',
          'firstName',
          'lastName',
          'visits',
          'age',
          'gender',
          'total',
        ])
      await settled()
      expectSpans('info', ['visits', 'age', 'gender'])
      expectSpans('name', ['firstName', 'lastName'])
    })
  })

  test('ND4: while dragging, the whole column of headers shifts, the source block hides, the overlay is the node cell at block width; other groups stay', async () => {
    await withWideViewport(async () => {
      await mount()
      const nameWidth = box(head('name')).width
      const { x, y } = center(handleOf('name'))
      firePointer('pointerdown', handleOf('name'), x, y)
      await nextFrame()
      for (const dx of [8, 120, 260, 360]) {
        firePointer('pointermove', document, x + dx, y)
        await nextFrame()
      }
      await expect.poll(() => translateX(head('info'))).toBe(-nameWidth)
      for (const id of ['more-info', 'age', 'gender', 'visits']) {
        expect(translateX(head(id)), id).toBe(-nameWidth)
      }
      for (const id of ['name', 'firstName', 'lastName']) {
        expect(getComputedStyle(head(id)).opacity, id).toBe('0')
      }
      expect(translateX(head('country'))).toBe(0)
      expect(Math.round(box(document.querySelector(OVERLAY)!).width)).toBe(
        Math.round(nameWidth),
      )
      firePointer('pointerup', document, x + 360, y)
      await expect.poll(() => document.querySelector(OVERLAY)).toBeNull()
    })
  })

  test('ND5: Alt+Shift+←/→ and the handle menu move leaves and groups to a sibling of the same parent; at the group edge the item is disabled', async () => {
    await withWideViewport(async () => {
      await mount({ enableKeyboardNavigation: true })
      head('name').focus()
      await userEvent.keyboard('{Alt>}{Shift>}{ArrowRight}{/Shift}{/Alt}')
      await expect.poll(() => leafOrder().indexOf('firstName')).toBe(4)

      await openMenu('firstName')
      expect(isDisabled(menuItem(DEFAULT_LABELS.moveLeft))).toBe(true)
      await userEvent.click(menuItem(DEFAULT_LABELS.moveRight))
      await expect
        .poll(() => leafOrder().slice(4, 6))
        .toEqual(['lastName', 'firstName'])
      await openMenu('firstName')
      expect(isDisabled(menuItem(DEFAULT_LABELS.moveRight))).toBe(true)
      await userEvent.keyboard('{Escape}')
    })
  })

  test('ND7: pinned nodes do not move; with leafPinning a group segment moves only within its zone', async () => {
    await withWideViewport(async () => {
      const pinned = await mount({ enableColumnPinning: true })
      await pinViaPopover(head('name'), 'Pin left')
      await expect
        .poll(() => head('name', 'left').getAttribute('data-cell-pinned'))
        .toBe('left')
      const handle = handleOf('name')
      expect(handle.getAttribute('aria-haspopup')).toBeNull()
      const before = leafOrder()
      await dragTo('name', box(head('total')).right - 5)
      await nextFrame()
      expect(leafOrder()).toEqual(before)
      await pinned.unmount()

      await mount({ enableColumnPinning: true, columnPinningLeafPinning: true })
      await pinViaPopover(head('gender'), 'Pin left')
      await expect.poll(() => leafOrder()[0]).toBe('gender')
      // Незакреплённый сегмент `info` — к левому краю центральной зоны, не дальше.
      await dragTo('info', 2)
      await expect
        .poll(leafOrder)
        .toEqual([
          'gender',
          'age',
          'visits',
          'country',
          'firstName',
          'lastName',
          'total',
        ])
    })
  })

  test('ND10: rowDragging under nested headers — a row is dragged with the mouse and the plugin is not inert', async () => {
    await withWideViewport(async () => {
      await mount({ enableRowDragging: true, enableColumnDragging: false })
      const rowIds = () =>
        [...document.querySelectorAll<HTMLElement>(BODY_ROW)]
          .sort((a, b) => box(a).top - box(b).top)
          .map(row => row.getAttribute('data-row-id'))
      const [first, , third] = rowIds()
      const row = document.querySelector<HTMLElement>(
        `${BODY_ROW}[data-row-id='${first}']`,
      )!
      await userEvent.hover(row)
      const handle = row.querySelector<HTMLElement>(HANDLE)!
      const from = center(handle)
      const target = document.querySelector(
        `${BODY_ROW}[data-row-id='${third}']`,
      )!
      await realDrag(from, { x: from.x, y: box(target).bottom - 4 })
      await expect.poll(() => rowIds().indexOf(first)).toBeGreaterThan(0)
    })
  })

  test('ND12: a group handle is a named menu button with a target of at least 24×24', async () => {
    await mount()
    const handle = handleOf('info')
    expect(handle.getAttribute('aria-label')).toBe(DEFAULT_LABELS.moveColumn)
    expect(handle.getAttribute('aria-haspopup')).toBe('menu')
    // Как TS1: квадрат 24×24 вокруг ручки целиком её, либо до соседних целей
    // не ближе половины квадрата.
    const c = center(handle)
    const samples = [-11, 0, 11].flatMap(dx =>
      [-11, 0, 11].map(dy => ({ x: c.x + dx, y: c.y + dy })),
    )
    const covered = samples.every(p =>
      handle.contains(document.elementFromPoint(p.x, p.y)),
    )
    const spaced = [
      ...head('info').querySelectorAll<HTMLElement>(
        'button, [role="button"], .resize__handler--column',
      ),
    ]
      .filter(other => other !== handle && box(other).width > 1)
      .every(other => {
        const r = box(other)
        const dx = Math.max(r.left - c.x, 0, c.x - r.right)
        const dy = Math.max(r.top - c.y, 0, c.y - r.bottom)
        return Math.hypot(dx, dy) >= 12
      })
    expect(covered || spaced).toBe(true)
  })

  test.each(['light', 'dark'] as const)(
    'ND13: the header with group handles and the dragging state pass axe with color-contrast (%s)',
    async colorMode => {
      const { container } = await mount({ colorMode })
      const options: axe.RunOptions = {
        rules: {
          region: { enabled: false },
          'scrollable-region-focusable': { enabled: false },
        },
      }
      const root = container.querySelector<HTMLElement>('.data-grid-theme')!
      expect(
        (await axe.run(root, options)).violations.map(
          v => `${v.id}: ${v.nodes.map(n => n.target).join(' ')}`,
        ),
      ).toEqual([])

      const { x, y } = center(handleOf('info'))
      firePointer('pointerdown', handleOf('info'), x, y)
      await nextFrame()
      firePointer('pointermove', document, x - 40, y)
      await expect.poll(() => document.querySelector(OVERLAY)).not.toBeNull()
      expect(
        (await axe.run(root, options)).violations.map(
          v => `${v.id}: ${v.nodes.map(n => n.target).join(' ')}`,
        ),
      ).toEqual([])
      firePointer('pointerup', document, x - 40, y)
    },
  )

  test('ND15: the "Header Groups — dragging" story moves a group and keeps row handles', async () => {
    await withWideViewport(async () => {
      await render(<composed.HeaderGroupsDragging />)
      await expect
        .poll(() => document.querySelectorAll(`${BODY_ROW} ${HANDLE}`).length)
        .toBeGreaterThan(0)
      await dragTo('total', box(head('country')).left + 5)
      await expect.poll(() => leafOrder()[0]).toBe('total')
    })
  })
})
