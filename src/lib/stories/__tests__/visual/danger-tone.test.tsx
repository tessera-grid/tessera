import axe from 'axe-core'
import { commands, server, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test } from 'vitest'
import type { CSSProperties, ReactNode } from 'react'

import '../../../ui/theme/theme.css'
import { definePlugin } from '../../../core/definePlugin'
import type { Draft } from '../../../core/drafts/drafts'
import type {
  ContextMenuAction,
  MenuAction,
  RowAction,
} from '../../../core/headerActions'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  cellEditing,
  columnSorting,
  columnVisibility,
  contextMenu,
  failureLog,
  rowActionMenu,
  rowActions,
  unsavedChanges,
} from '../../../plugins'
import { cellEditingLabels } from '../../../plugins/cellEditing/labels'
import { columnVisibilityLabels } from '../../../plugins/columnVisibility/labels'
import { failureLogLabels } from '../../../plugins/failureLog/labels'
import { unsavedChangesLabels } from '../../../plugins/unsavedChanges/labels'
import { Button } from '@/lib/ui/Button'
import { IconButton } from '@/lib/ui/IconButton'
import { ItemButton } from '@/lib/ui/Popup/ItemButton'
import { SvgIcon } from '@/lib/ui/icons'
import {
  failureShownOn,
  humanClick,
  pendingArcOf,
  pointTo,
  revealCellButtons,
} from '../helpers'
import { tableLabels } from '../labels'
import {
  AXE_OPTIONS,
  contrast,
  effectiveBg,
  inBothThemes,
  toRgba,
} from './a11y-helpers'
import { waitForGrid } from './core-helpers'
import { openColumnsMenu } from '../viewSettings'

// Тон опасного действия (ADR 0206, DX1–DX8, DX10): кнопки кита, пункты меню по дескриптору,
// встроенные опасные действия, контраст, высокая контрастность, токены, axe. DX9 и DX11 —
// модульные (`dangerTone`).

const fx = commands as unknown as {
  forcedColors: (active: boolean) => Promise<void>
}

afterEach(async () => {
  if (server.browser !== 'webkit') await fx.forcedColors(false)
  document.documentElement.classList.remove('dark')
})

const style = (el: Element) => getComputedStyle(el)

/** Значение токена в контексте элемента, разрешённое через свойство `prop`. */
const token = (host: Element, name: string, prop = 'color') => {
  const probe = document.createElement('span')
  probe.style.setProperty(prop, `var(${name})`)
  probe.style.position = 'absolute'
  host.appendChild(probe)
  const value = getComputedStyle(probe).getPropertyValue(prop)
  probe.remove()
  return value
}
const dangerText = (el: Element) =>
  token(el.parentElement!, '--tsr-comp-danger-text-color')
const dangerBorder = (el: Element) =>
  token(el.parentElement!, '--tsr-comp-danger-border-color')
const dangerHover = (el: Element) =>
  token(el.parentElement!, '--tsr-comp-danger-hover-bg', 'background-color')

/** Цвет текста и значка — красный тона `danger`. */
const isRed = (el: Element) => style(el).color === dangerText(el)

const sys = (name: string) => {
  const probe = document.createElement('span')
  probe.style.color = name
  document.body.append(probe)
  const value = getComputedStyle(probe).color
  probe.remove()
  return value
}

const frame = () =>
  new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
/** Переходы цвета закончились — читаем конечные значения. */
const settle = async () => {
  await frame()
  await Promise.all(
    document
      .getAnimations()
      .filter(a => a.effect?.getTiming().iterations !== Infinity)
      .map(a => a.finished.catch(() => undefined)),
  )
}
const away = () => userEvent.hover(document.body, { position: { x: 1, y: 1 } })

// --- Кнопки кита ----------------------------------------------------------------------

const Theme = ({
  children,
  contrast: mode,
  style: own,
}: {
  children: ReactNode
  contrast?: 'more'
  style?: CSSProperties
}) => (
  <div
    className="data-grid-theme"
    data-tsr-contrast={mode}
    style={{
      padding: 24,
      display: 'flex',
      gap: 12,
      flexWrap: 'wrap',
      background: 'var(--tsr-sys-surface)',
      ...own,
    }}
  >
    {children}
  </div>
)

const Glyph = () => <SvgIcon width={14} height={14} />

const Kit = (props: { contrast?: 'more'; style?: CSSProperties }) => (
  <Theme {...props}>
    <Button tone="danger" data-testid="outline">
      Discard all
    </Button>
    <Button tone="danger" variant="ghost" data-testid="ghost">
      Discard
    </Button>
    <Button data-testid="plain-outline">Apply all</Button>
    <Button variant="ghost" data-testid="plain-ghost">
      Apply
    </Button>
    <IconButton tone="danger" aria-label="Delete" data-testid="icon">
      <Glyph />
    </IconButton>
    <IconButton aria-label="Edit" data-testid="plain-icon">
      <Glyph />
    </IconButton>
    <ItemButton tone="danger" label="Discard change" data-testid="item">
      <Glyph />
    </ItemButton>
    <ItemButton label="Apply change" data-testid="plain-item">
      <Glyph />
    </ItemButton>
  </Theme>
)

const byId = (id: string) =>
  document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!

describe('Кнопки кита в тоне danger (ADR 0206)', () => {
  test('DX1: Button tone="danger" — у outline подпись --tsr-comp-danger-text-color и рамка --tsr-comp-danger-border-color, у ghost — подпись; наведение — заливка --tsr-comp-danger-hover-bg; кольцо фокуса прежнее; без тона вид прежний', async () => {
    const screen = await render(<Kit />)
    const outline = byId('outline')
    const ghost = byId('ghost')
    const plainOutline = byId('plain-outline')
    const plainGhost = byId('plain-ghost')
    await settle()

    expect(style(outline).color).toBe(dangerText(outline))
    expect(style(outline).borderTopColor).toBe(dangerBorder(outline))
    expect(style(ghost).color).toBe(dangerText(ghost))
    expect(style(ghost).borderTopColor).toBe(style(plainGhost).borderTopColor)
    // Без тона — прежний вид: не красный, рамка кнопки.
    expect(isRed(plainOutline)).toBe(false)
    expect(isRed(plainGhost)).toBe(false)
    expect(style(plainOutline).borderTopColor).not.toBe(
      dangerBorder(plainOutline),
    )

    for (const button of [outline, ghost]) {
      await pointTo(button)
      await expect
        .poll(() => style(button).backgroundColor)
        .toBe(dangerHover(button))
    }
    await pointTo(plainOutline)
    await settle()
    expect(style(plainOutline).backgroundColor).not.toBe(
      dangerHover(plainOutline),
    )
    await away()

    // Кольцо фокуса с клавиатуры — как у кнопки без тона.
    const ring = (el: HTMLElement) => {
      const s = style(el)
      return [s.boxShadow, s.outlineStyle, s.outlineWidth]
    }
    ghost.focus()
    await userEvent.tab()
    expect(document.activeElement).toBe(plainOutline)
    await settle()
    const plainRing = ring(plainOutline)
    await userEvent.tab({ shift: true })
    await userEvent.tab({ shift: true })
    expect(document.activeElement).toBe(outline)
    await settle()
    expect(plainRing[0]).not.toBe('none')
    expect(ring(outline)).toEqual(plainRing)
    await screen.unmount()
  })

  test('DX2: IconButton и ItemButton с tone="danger" — значок --tsr-comp-danger-text-color и в покое; при наведении и фокусе с клавиатуры — на подложке --tsr-comp-danger-hover-bg', async () => {
    const screen = await render(<Kit />)
    await settle()
    for (const [id, plain] of [
      ['icon', 'plain-icon'],
      ['item', 'plain-item'],
    ] as const) {
      const button = byId(id)
      expect(style(button).color, id).toBe(dangerText(button))
      expect(isRed(byId(plain)), plain).toBe(false)

      await pointTo(button)
      await expect
        .poll(() => style(button).backgroundColor, { message: id })
        .toBe(dangerHover(button))
      await away()
      await expect
        .poll(() => style(button).backgroundColor)
        .not.toBe(dangerHover(button))

      // Фокус с клавиатуры: с соседней кнопки без тона — назад.
      byId(plain).focus()
      await userEvent.tab({ shift: true })
      expect(document.activeElement, id).toBe(button)
      await expect
        .poll(() => style(button).backgroundColor, { message: id })
        .toBe(dangerHover(button))
      expect(style(button).color).toBe(dangerText(button))
    }
    await screen.unmount()
  })
})

// --- Дескрипторы в меню ---------------------------------------------------------------

const DATA = Array.from({ length: 12 }, (_, i) => ({
  id: `r${i}`,
  name: `Name ${i}`,
  city: `City ${i}`,
  status: 'draft',
}))

const icon = (letter: string) => () => <span aria-hidden>{letter}</span>

const leaf = (
  id: string,
  label: string,
  extra: Partial<MenuAction> = {},
): MenuAction => ({
  id,
  icon: icon(label[0]!),
  label: () => label,
  onSelect: () => {},
  ...extra,
})

/** Свои действия приложения: опасное «Delete», раздел с опасным пунктом, выключенное и заблокированное. */
const probe = definePlugin()({
  id: 'dangerProbe',
  slotActions: [
    { ...leaf('edit', 'Edit'), slot: 'actionRowSlot', order: 0 },
    {
      ...leaf('delete', 'Delete', { tone: 'danger' }),
      slot: 'actionRowSlot',
      order: 1,
    },
    {
      ...leaf('more', 'More'),
      slot: 'actionRowSlot',
      order: 2,
      submenu: () => ({
        title: 'More',
        items: [
          leaf('archive', 'Archive'),
          leaf('purge', 'Purge', { tone: 'danger' }),
          leaf('wipe', 'Wipe', { tone: 'danger', disabled: () => true }),
          leaf('shred', 'Shred', {
            tone: 'danger',
            disabled: () => ({ kind: 'forbidden', reason: 'No rights' }),
          }),
          leaf('erase', 'Erase', { disabled: () => true }),
        ],
      }),
    },
  ] satisfies RowAction[],
  contextMenuActions: [
    leaf('copy', 'Copy'),
    leaf('remove', 'Remove', {
      tone: ctx => (ctx.row.id === 'r1' ? 'danger' : undefined),
    }),
  ] as ContextMenuAction[],
})

const MenuGrid = ({
  menu = true,
  contrast: mode,
}: {
  menu?: boolean
  contrast?: 'more'
}) => {
  const table = useCreateTable({
    columns: [
      { id: 'name', accessorKey: 'name', header: 'Name', size: 240 },
    ] as never,
    data: DATA,
    getRowId: (row: (typeof DATA)[number]) => row.id,
    plugins: [
      probe(),
      rowActions(),
      ...(menu ? [rowActionMenu({ mode: 'always' })] : []),
      contextMenu(),
    ] as never,
  })
  return (
    <div style={{ width: 640, height: 420 }}>
      <DataGrid table={table as never} contrast={mode} />
    </div>
  )
}

const rowEl = (id: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${id}"]`,
  )!
const cellEl = (id: string, column = 'name') =>
  rowEl(id).querySelector<HTMLElement>(
    `.data-grid__body-cell[data-column-id="${column}"]`,
  )!
const items = () => [
  ...document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
]
const item = (label: string) =>
  items().find(
    el => el.querySelector('[data-popup-item-label]')?.textContent === label,
  )
const itemIcon = (el: HTMLElement) =>
  el.querySelector<HTMLElement>('[data-popup-item-icon]')!
const closeMenus = async () => {
  for (let i = 0; i < 4 && items().length > 0; i += 1) {
    await userEvent.keyboard('{Escape}')
    await settle()
  }
  await expect.poll(() => items().length).toBe(0)
}
const openRowMenu = async (id = 'r1') => {
  await pointTo(cellEl(id))
  const kebab = () =>
    rowEl(id).querySelector<HTMLElement>(
      `[aria-label^="${tableLabels.rowMenu}"]`,
    )
  await expect.poll(kebab).not.toBeNull()
  await humanClick(kebab()!)
  await expect.poll(() => items().length).toBeGreaterThan(0)
  await settle()
}
const openContextMenu = async (id = 'r1') => {
  await userEvent.click(cellEl(id), { button: 'right' })
  await expect.poll(() => item('Copy')).toBeTruthy()
  await settle()
}

/**
 * Подсветить пункт меню указателем. WebKit: указатель Playwright не подсвечивает пункт меню
 * Base UI — подсветка фокусом, вид подсвеченного пункта тот же.
 */
const highlightItem = async (el: HTMLElement) => {
  await pointTo(el)
  if (server.browser === 'webkit' && !el.hasAttribute('data-highlighted'))
    el.focus()
}

/** Пункт в тоне `danger`: текст и значок красные в покое, подсветка — бледно-красная. */
const expectDangerItem = async (label: string) => {
  const el = item(label)!
  expect(el, label).toBeTruthy()
  expect(style(el).color, label).toBe(dangerText(el))
  expect(style(itemIcon(el)).color, `${label}: значок`).toBe(dangerText(el))
  await highlightItem(el)
  await expect
    .poll(() => el.hasAttribute('data-highlighted'), { message: label })
    .toBe(true)
  await expect
    .poll(() => style(el).backgroundColor, { message: label })
    .toBe(dangerHover(el))
}
const expectPlainItem = (label: string) => {
  const el = item(label)!
  expect(el, label).toBeTruthy()
  expect(isRed(el), label).toBe(false)
}

describe('Дескрипторы действий в тоне danger (ADR 0206)', () => {
  test('DX3: дескриптор с tone: "danger" — пункт кебаба, мини-меню, контекстного меню и раздела меню: текст и значок --tsr-comp-danger-text-color в покое, подсветка --tsr-comp-danger-hover-bg; тон функцией контекста; кнопка слота — по DX2', async () => {
    let screen = await render(<MenuGrid />)
    await waitForGrid()

    // Кебаб строки и раздел меню.
    await openRowMenu()
    expectPlainItem('Edit')
    await expectDangerItem('Delete')
    await humanClick(item('More')!)
    await expect.poll(() => item('Purge')).toBeTruthy()
    await settle()
    expectPlainItem('Archive')
    await expectDangerItem('Purge')
    await closeMenus()

    // Контекстное меню: тон по контексту — у r1 опасно, у r2 нет.
    await openContextMenu('r1')
    expectPlainItem('Copy')
    await expectDangerItem('Remove')
    await closeMenus()
    await openContextMenu('r2')
    expectPlainItem('Remove')
    await closeMenus()
    await screen.unmount()

    // Инлайн: кнопка слота и мини-меню раздела.
    screen = await render(<MenuGrid menu={false} />)
    await waitForGrid()
    await revealCellButtons(cellEl('r1'))
    const del = rowEl('r1').querySelector<HTMLElement>(
      'button[aria-label="Delete"]',
    )!
    const edit = rowEl('r1').querySelector<HTMLElement>(
      'button[aria-label="Edit"]',
    )!
    await expect.poll(() => style(del).color).toBe(dangerText(del))
    expect(isRed(edit)).toBe(false)
    await pointTo(del)
    await expect.poll(() => style(del).backgroundColor).toBe(dangerHover(del))
    await humanClick(
      rowEl('r1').querySelector<HTMLElement>('button[aria-label="More"]')!,
    )
    await expect.poll(() => item('Purge')).toBeTruthy()
    await settle()
    expectPlainItem('Archive')
    await expectDangerItem('Purge')
    await closeMenus()
    await screen.unmount()
  })

  test('DX4: состояния главнее тона — выключенная кнопка и пункт цветом выключенных без красного; ожидание, отказ и блокировка с причиной — прежним видом', async () => {
    const pair = (props: Record<string, unknown>, key: string) => (
      <>
        <Button tone="danger" data-testid={`${key}-danger`} {...props}>
          Discard
        </Button>
        <Button data-testid={`${key}-plain`} {...props}>
          Discard
        </Button>
        <IconButton
          tone="danger"
          aria-label="Delete"
          data-testid={`${key}-icon-danger`}
          {...props}
        >
          <Glyph />
        </IconButton>
        <IconButton
          aria-label="Delete"
          data-testid={`${key}-icon-plain`}
          {...props}
        >
          <Glyph />
        </IconButton>
      </>
    )
    const screen = await render(
      <Theme>
        {pair({ disabled: true }, 'disabled')}
        {pair({ pending: true }, 'pending')}
        {pair({ failed: true }, 'failed')}
      </Theme>,
    )
    await settle()
    const look = (el: HTMLElement) => {
      const s = style(el)
      return [s.color, s.borderTopColor, s.backgroundColor]
    }
    // Выключенная и занятая — цветом своего состояния, без красного.
    for (const state of ['disabled', 'pending']) {
      for (const kind of ['', 'icon-']) {
        const danger = byId(`${state}-${kind}danger`)
        const plain = byId(`${state}-${kind}plain`)
        expect(look(danger), `${state} ${kind}`).toEqual(look(plain))
        expect(isRed(danger), `${state} ${kind}`).toBe(false)
      }
    }
    // Отказ — прежним видом: дуга и её цвет те же, что без тона (ADR 0136).
    const arcLook = (el: HTMLElement) => {
      const arc = pendingArcOf(el)
      return [
        !!arc,
        failureShownOn(el),
        arc ? style(arc).color : null,
        arc ? style(arc).opacity : null,
      ]
    }
    for (const kind of ['', 'icon-']) {
      const danger = byId(`failed-${kind}danger`)
      const plain = byId(`failed-${kind}plain`)
      expect(arcLook(danger), `failed ${kind}`).toEqual(arcLook(plain))
    }
    expect(style(byId('disabled-danger')).color).toBe(
      token(
        byId('disabled-danger').parentElement!,
        '--tsr-comp-control-disabled-color',
      ),
    )
    await screen.unmount()

    // Пункт меню: выключенный и заблокированный с причиной — как выключенный без тона.
    const grid = await render(<MenuGrid />)
    await waitForGrid()
    await openRowMenu()
    await humanClick(item('More')!)
    await expect.poll(() => item('Wipe')).toBeTruthy()
    await settle()
    const plainDisabled = style(item('Erase')!).color
    expect(style(item('Wipe')!).color).toBe(plainDisabled)
    expect(style(item('Shred')!).color).toBe(plainDisabled)
    expect(isRed(item('Wipe')!)).toBe(false)
    expect(isRed(item('Shred')!)).toBe(false)
    await closeMenus()
    await grid.unmount()
  })
})

// --- Встроенные опасные действия ------------------------------------------------------

const NEW_ROW = '5b0d6c1e-3f2a-4c8e-9a71-2d4e6f8a0b13'
const DRAFTS: Draft[] = [
  {
    kind: 'cellValue',
    target: { cell: ['r1', 'name'] },
    value: { value: 'Changed', text: 'Changed' },
  },
  {
    kind: 'rowInsert',
    target: { row: NEW_ROW },
    value: { values: { name: 'New row', city: 'Oslo' }, index: 3, after: 'r2' },
  },
  { kind: 'rowDelete', target: { row: 'r5' }, value: null },
]

let api: {
  trackCellAction: (
    target: unknown,
    promise: Promise<unknown>,
  ) => Promise<unknown>
}

const BuiltInGrid = () => {
  const table = useCreateTable({
    columns: [
      { id: 'name', accessorKey: 'name', header: 'Name', size: 200 },
      { id: 'city', accessorKey: 'city', header: 'City', size: 160 },
      {
        id: 'status',
        accessorKey: 'status',
        header: 'Status',
        size: 160,
        dataType: 'select',
        options: [
          { value: 'draft', label: 'Draft' },
          { value: 'done', label: 'Done' },
        ],
      },
    ] as never,
    data: DATA,
    getRowId: (row: (typeof DATA)[number]) => row.id,
    initialDrafts: DRAFTS,
    state: { columnVisibility: { city: false } },
    plugins: [
      cellEditing({
        saveMode: 'manual',
        canEditCell: () => true,
        onCommitEdits: () => {},
      } as never),
      columnSorting({ sorting: [{ id: 'city', desc: false }] }),
      columnVisibility(),
      rowActions(),
      contextMenu(),
      unsavedChanges(),
      failureLog(),
    ] as never,
  })
  api = table as never
  return (
    <div style={{ width: 760, height: 520 }}>
      <DataGrid table={table as never} height={480} />
    </div>
  )
}

const popover = () =>
  document.querySelector<HTMLElement>('[data-testid="cell-issue-popover"]')
const buttonIn = (root: HTMLElement | null, text: string) =>
  [...(root?.querySelectorAll<HTMLElement>('button') ?? [])].find(
    el => el.textContent?.trim() === text,
  )
const testId = (id: string) =>
  document.querySelector<HTMLElement>(`[data-testid="${id}"]`)

describe('Встроенные опасные действия (ADR 0206)', () => {
  test('DX5: встроенные опасные действия в тоне danger — «Discard» и «Discard all» пульта, «Discard change» поповера отметки и контекстного меню, «Roll back», «Remove row»; «Reset», «Clear value», ластик, «Close» и «Clear all» журнала, «Restore row» — без тона', async () => {
    const screen = await render(<BuiltInGrid />)
    await waitForGrid()
    await expect.poll(() => rowEl(NEW_ROW)).not.toBeNull()
    void api
      .trackCellAction(
        { cell: ['r2', 'name'] },
        Promise.reject(new Error('No')),
      )
      .catch(() => {})
    const failureMark = () =>
      cellEl('r2').querySelector<HTMLElement>('button[data-cell-issue]')
    await expect.poll(failureMark).not.toBeNull()
    const edit = cellEditingLabels(tableLabels)
    const pult = unsavedChangesLabels(tableLabels)

    // Пульт: «Discard» записи и «Discard all» красные, «Apply» и «Apply all» — нет.
    await humanClick(testId('unsaved-changes-button')!)
    await expect.poll(() => testId('unsaved-changes')).not.toBeNull()
    await settle()
    const panel = testId('unsaved-changes')!
    const discards = [
      ...panel.querySelectorAll<HTMLElement>('[data-action="discard"]'),
    ]
    expect(discards.length).toBeGreaterThan(0)
    for (const button of discards) {
      expect(button.getAttribute('aria-label')).toBe(pult.draftDiscard)
      expect(isRed(button)).toBe(true)
    }
    const discardAll = panel.querySelector<HTMLElement>(
      '[data-action="discard-all"]',
    )!
    expect(discardAll.textContent).toContain(pult.draftDiscardAll)
    expect(isRed(discardAll)).toBe(true)
    for (const button of panel.querySelectorAll<HTMLElement>(
      '[data-action="apply"], [data-action="apply-all"]',
    ))
      expect(isRed(button)).toBe(false)
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => testId('unsaved-changes')).toBeNull()

    // Поповер несохранённого значения: «Roll back».
    await humanClick(
      cellEl('r1').querySelector<HTMLElement>('[data-cell-draft]')!,
    )
    await expect.poll(popover).not.toBeNull()
    await settle()
    expect(isRed(buttonIn(popover(), edit.cellDraftRollback)!)).toBe(true)
    await userEvent.keyboard('{Escape}')
    await expect.poll(popover).toBeNull()

    // Поповер отказа: «Discard change».
    await humanClick(failureMark()!)
    await expect.poll(popover).not.toBeNull()
    await settle()
    expect(isRed(buttonIn(popover(), tableLabels.failureDiscard)!)).toBe(true)
    await userEvent.keyboard('{Escape}')
    await expect.poll(popover).toBeNull()

    // Контекстное меню: «Roll back», «Discard change», «Remove row» — красные, «Restore row» — нет.
    const contextItem = async (id: string, label: string) => {
      await userEvent.click(cellEl(id), { button: 'right' })
      await expect.poll(() => item(label)).toBeTruthy()
      await settle()
      return item(label)!
    }
    expect(isRed(await contextItem('r1', edit.cellDraftRollback))).toBe(true)
    await closeMenus()
    expect(isRed(await contextItem('r2', tableLabels.failureDiscard))).toBe(
      true,
    )
    await closeMenus()
    expect(isRed(await contextItem(NEW_ROW, edit.rowInsertDiscard))).toBe(true)
    await closeMenus()
    expect(isRed(await contextItem('r5', edit.rowDeleteDiscard))).toBe(false)
    await closeMenus()

    // Кнопка строки: «Remove row» у новой — красная, «Restore row» у удалённой — нет.
    const rowButton = (id: string) =>
      rowEl(id).querySelector<HTMLElement>(
        '[data-action-id="cellEditing:rowDraftDiscard"]',
      )!
    await expect.poll(() => rowButton(NEW_ROW)).not.toBeNull()
    await expect.poll(() => isRed(rowButton(NEW_ROW))).toBe(true)
    expect(isRed(rowButton('r5'))).toBe(false)

    // Журнал отказов: «Close» и «Clear all» — без тона.
    await humanClick(testId('failure-log-button')!)
    await expect.poll(() => testId('failure-log')).not.toBeNull()
    await settle()
    const log = testId('failure-log')!
    const close = log.querySelector<HTMLElement>('[data-action="close"]')!
    expect(close.getAttribute('aria-label')).toBe(
      failureLogLabels(tableLabels).failureClose,
    )
    expect(isRed(close)).toBe(false)
    expect(
      isRed(document.querySelector<HTMLElement>('[data-action="clear-all"]')!),
    ).toBe(false)
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => testId('failure-log')).toBeNull()

    // «Колонки»: «Reset» и ластик скрытой колонки с сортировкой — без тона.
    await openColumnsMenu({ click: humanClick })
    const eraser = () => testId('column-visibility-clear-transforms')
    await expect.poll(eraser).not.toBeNull()
    await settle()
    expect(isRed(eraser()!)).toBe(false)
    const reset = buttonIn(
      eraser()!.closest<HTMLElement>('[role="dialog"], [data-side]'),
      columnVisibilityLabels(tableLabels).resetColumns,
    )!
    expect(reset).toBeTruthy()
    expect(isRed(reset)).toBe(false)
    await userEvent.keyboard('{Escape}')
    await expect.poll(eraser).toBeNull()

    // Редактор вариантов: «Clear value» — без тона.
    await revealCellButtons(cellEl('r3', 'status'))
    await humanClick(
      cellEl('r3', 'status').querySelector<HTMLElement>(
        '.cell__button button',
      )!,
    )
    const clear = () => testId('edit-clear-value')
    await expect.poll(clear).not.toBeNull()
    await settle()
    expect(clear()!.textContent).toBe(edit.editClear)
    expect(isRed(clear()!)).toBe(false)
    await userEvent.keyboard('{Escape}')
    await screen.unmount()
  })
})

// --- Контраст, высокая контрастность, токены, axe -------------------------------------

describe('Контраст и темы тона danger (ADR 0206)', () => {
  test('DX6: в обеих темах и в режиме повышенного контраста красный текст — не ниже 4,5:1, рамка и значок — не ниже 3:1 к своему фону, в том числе на заливке наведения; пункт меню — на подсветке', async () => {
    for (const mode of [undefined, 'more'] as const) {
      const screen = await render(<Kit contrast={mode} />)
      await inBothThemes(async () => {
        await settle()
        const at = `${mode ?? 'standard'} ${document.documentElement.classList.contains('dark') ? 'dark' : 'light'}`
        const outline = byId('outline')
        const text = (el: HTMLElement) =>
          contrast(toRgba(style(el).color), effectiveBg(el))
        expect(text(outline), `${at}: текст outline`).toBeGreaterThanOrEqual(
          4.5,
        )
        expect(
          text(byId('ghost')),
          `${at}: текст ghost`,
        ).toBeGreaterThanOrEqual(4.5)
        expect(
          contrast(
            toRgba(style(outline).borderTopColor),
            effectiveBg(outline.parentElement!),
          ),
          `${at}: рамка`,
        ).toBeGreaterThanOrEqual(3)
        expect(text(byId('icon')), `${at}: значок`).toBeGreaterThanOrEqual(3)
        for (const id of ['outline', 'icon', 'item']) {
          const el = byId(id)
          await pointTo(el)
          await expect
            .poll(() => style(el).backgroundColor)
            .toBe(dangerHover(el))
          await settle()
          expect(
            text(el),
            `${at}: ${id} на заливке наведения`,
          ).toBeGreaterThanOrEqual(id === 'outline' ? 4.5 : 3)
        }
        await away()
      })
      await screen.unmount()

      const grid = await render(<MenuGrid contrast={mode} />)
      await waitForGrid()
      await inBothThemes(async () => {
        await openRowMenu()
        const del = item('Delete')!
        await highlightItem(del)
        await expect.poll(() => del.hasAttribute('data-highlighted')).toBe(true)
        await settle()
        expect(
          contrast(toRgba(style(del).color), effectiveBg(del)),
          `${mode ?? 'standard'}: пункт на подсветке`,
        ).toBeGreaterThanOrEqual(4.5)
        await closeMenus()
      })
      await grid.unmount()
    }
  })

  test('DX7: forced-colors — кнопка и пункт в тоне danger системными цветами, как без тона', async ({
    skip,
  }) => {
    skip(
      server.browser === 'webkit',
      'WebKit не подменяет цвета в forced-colors',
    )
    await fx.forcedColors(true)
    const screen = await render(<Kit />)
    await settle()
    expect(style(byId('outline')).color).toBe(sys('ButtonText'))
    expect(style(byId('outline')).borderTopColor).toBe(
      style(byId('plain-outline')).borderTopColor,
    )
    expect(style(byId('ghost')).color).toBe(style(byId('plain-ghost')).color)
    expect(style(byId('icon')).color).toBe(style(byId('plain-icon')).color)
    expect(style(byId('item')).color).toBe(style(byId('plain-item')).color)
    // Наведение — как у кнопки без тона.
    const hovered = async (id: string) => {
      await pointTo(byId(id))
      await settle()
      return [style(byId(id)).color, style(byId(id)).backgroundColor]
    }
    expect(await hovered('icon')).toEqual(await hovered('plain-icon'))
    expect(await hovered('outline')).toEqual(await hovered('plain-outline'))
    await away()
    await screen.unmount()

    const grid = await render(<MenuGrid />)
    await waitForGrid()
    await openRowMenu()
    expect(style(item('Delete')!).color).toBe(style(item('Edit')!).color)
    // Подсвеченный пункт — Highlight и HighlightText, как без тона.
    const highlighted = async (label: string) => {
      await pointTo(item(label)!)
      await expect
        .poll(() => item(label)!.hasAttribute('data-highlighted'))
        .toBe(true)
      await settle()
      const el = item(label)!
      return [
        style(el).color,
        style(el).backgroundColor,
        style(itemIcon(el)).color,
      ]
    }
    const plain = await highlighted('Edit')
    expect(plain[1]).toBe(sys('Highlight'))
    expect(await highlighted('Delete')).toEqual(plain)
    await closeMenus()
    await grid.unmount()
  })

  test('DX8: токены --tsr-comp-danger-text-color, --tsr-comp-danger-border-color и --tsr-comp-danger-hover-bg выводятся из --tsr-sys-danger и переопределяются приложением на обёртке', async () => {
    let screen = await render(<Kit />)
    const before = style(byId('outline')).color
    await screen.unmount()

    // Из --tsr-sys-danger: смена тона опасности меняет рамку и подпись.
    screen = await render(
      <Kit style={{ '--tsr-sys-danger': 'rgb(0, 128, 0)' } as CSSProperties} />,
    )
    await settle()
    expect(style(byId('outline')).borderTopColor).toBe('rgb(0, 128, 0)')
    expect(style(byId('outline')).color).not.toBe(before)
    await screen.unmount()

    // Переопределение на обёртке.
    screen = await render(
      <Kit
        style={
          {
            '--tsr-comp-danger-text-color': 'rgb(0, 0, 255)',
            '--tsr-comp-danger-border-color': 'rgb(255, 0, 255)',
            '--tsr-comp-danger-hover-bg': 'rgb(255, 255, 0)',
          } as CSSProperties
        }
      />,
    )
    await settle()
    expect(style(byId('outline')).color).toBe('rgb(0, 0, 255)')
    expect(style(byId('outline')).borderTopColor).toBe('rgb(255, 0, 255)')
    expect(style(byId('icon')).color).toBe('rgb(0, 0, 255)')
    expect(style(byId('item')).color).toBe('rgb(0, 0, 255)')
    await pointTo(byId('icon'))
    await expect
      .poll(() => style(byId('icon')).backgroundColor)
      .toBe('rgb(255, 255, 0)')
    await screen.unmount()
  })

  test('DX10: axe с color-contrast для кнопок и пунктов в тоне danger в покое, при наведении и фокусе, в светлой и тёмной теме', async () => {
    const options = {
      ...AXE_OPTIONS,
      rules: { ...AXE_OPTIONS.rules, 'color-contrast': { enabled: true } },
    }
    const check = async (root: Element, at: string) => {
      const { violations } = await axe.run(root, options)
      expect(
        violations.map(
          v => `${v.id}: ${v.nodes.map(n => n.target).join(', ')}`,
        ),
        at,
      ).toEqual([])
    }
    const screen = await render(<Kit />)
    await inBothThemes(async () => {
      await settle()
      const root = byId('outline').parentElement!
      await check(root, 'покой')
      await pointTo(byId('outline'))
      await settle()
      await check(root, 'наведение')
      byId('plain-outline').focus()
      await userEvent.tab()
      await settle()
      await check(root, 'фокус')
      await away()
    })
    await screen.unmount()

    const grid = await render(<MenuGrid />)
    await waitForGrid()
    await inBothThemes(async () => {
      await openRowMenu()
      const menu = document.querySelector<HTMLElement>('[role="menu"]')!
      await check(menu, 'меню')
      await pointTo(item('Delete')!)
      await settle()
      await check(menu, 'подсветка')
      await closeMenus()
    })
    await grid.unmount()
  })
})
