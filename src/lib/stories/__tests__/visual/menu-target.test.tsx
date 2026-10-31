import axe from 'axe-core'
import { commands, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test } from 'vitest'

import { definePlugin } from '../../../core/definePlugin'
import type {
  ContextMenuAction,
  HeaderAction,
  MenuAction,
  RowAction,
} from '../../../core/headerActions'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  cellSelection,
  contextMenu,
  headerActionMenu,
  rowActionMenu,
  rowActions,
  rowExpanding,
} from '../../../plugins'
import { failureShownOn, humanClick } from '../helpers'
import { tableLabels } from '../labels'
import { waitForGrid } from './core-helpers'
import { PENDING_WAVE_ANIMATION } from '../../../grid/useSkeletonWave'
import {
  AXE_OPTIONS,
  backgroundOf,
  contrast,
  inBothThemes,
  toRgba,
} from './a11y-helpers'
import { snapshot } from './tree-lines-helpers'

declare module 'vitest/browser' {
  interface BrowserCommands {
    reducedMotion: (reduce: boolean) => Promise<void>
    forcedColors: (active: boolean) => Promise<void>
  }
}

// Итог пункта меню на цели (ADR 0152; TG2–TG7): отказ вспыхивает на ячейке, выделении
// или цели действия, ожидание — `aria-busy` и волна на цели. Модульные TG1, TG8, TG12 —
// в `menuTarget.dom`, подсветка диапазона TG9 — в `highlight`, вид TG10 — в
// `outcome-flash`, перф TG11 — в `performance/scroll`. Промисы действий — в руках теста.

interface Deferred {
  promise: Promise<void>
  resolve: () => void
  reject: (error: unknown) => void
}

const deferred = (): Deferred => {
  let resolve!: () => void
  let reject!: (error: unknown) => void
  const promise = new Promise<void>((ok, fail) => {
    resolve = ok
    reject = fail
  })
  promise.catch(() => {})
  return { promise, resolve, reject }
}

interface Item {
  id: string
  name: string
  city: string
  subRows?: Item[]
}

const makeItem = (i: number): Item => ({
  id: `r${i}`,
  name: `Name ${i}`,
  city: `City ${i}`,
})
const DATA = Array.from({ length: 300 }, (_, i) => makeItem(i))
const TREE = DATA.map((row, i) =>
  i === 0 ? { ...row, subRows: [{ ...makeItem(1000), id: 'r0a' }] } : row,
)

/** Ячейка с плотным блоком вместо текста: пиксели содержимого видны на снимке. */
const block = () => (
  <span
    data-ink
    style={{
      display: 'inline-block',
      width: 12,
      height: 12,
      background: 'var(--tsr-sys-fg)',
    }}
  />
)

const COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name', size: 160 },
  { id: 'city', accessorKey: 'city', header: 'City', size: 160 },
  { id: 'ink', header: 'Ink', size: 160, cell: block },
]

/** Свежие действия на каждый тест: последний промис каждого действия — у теста. */
const makeProbe = () => {
  const runs = new Map<string, Deferred>()
  const running = (id: string) => () => {
    const done = deferred()
    runs.set(id, done)
    return done.promise
  }
  const icon = (letter: string) => () => <span aria-hidden>{letter}</span>
  const context = (
    id: string,
    label: string,
    target?: ContextMenuAction['target'],
  ): ContextMenuAction => ({
    id,
    icon: icon(label[0]!),
    label: () => label,
    onSelect: running(id),
    target,
  })
  const rowTarget: MenuAction['target'] = ctx => ({
    row: (ctx as { row: { id: string } }).row.id,
  })
  const row = (
    id: string,
    order: number,
    label: string,
    target?: RowAction['target'],
  ): RowAction => ({
    id,
    slot: 'actionRowSlot',
    order,
    icon: icon(label[0]!),
    label: () => label,
    onSelect: running(id),
    target,
  })
  const header: HeaderAction = {
    id: 'freeze',
    slot: 'rightHeaderSlot',
    order: 10,
    icon: icon('F'),
    label: () => 'Freeze',
    onSelect: running('freeze'),
    target: ctx => ({
      column: (ctx as { header: { column: { id: string } } }).header.column.id,
    }),
  }
  const plugin = definePlugin()({
    id: 'targetProbe',
    slotActions: [
      row('remove', 0, 'Remove'),
      row('archive', 1, 'Archive', rowTarget),
      header,
    ],
    contextMenuActions: [
      context('recalculate', 'Recalculate'),
      context('wholeRow', 'Whole row', rowTarget),
      context('wholeColumn', 'Whole column', ctx => ({
        column: (ctx as { column: { id: string } }).column.id,
      })),
      context('rowAndColumn', 'Row and column', ctx => {
        const { row: r, column } = ctx as {
          row: { id: string }
          column: { id: string }
        }
        return [{ row: r.id }, { column: column.id }]
      }),
      context('nowhere', 'Nowhere', () => false),
    ],
  })
  return { plugin, run: (id: string) => runs.get(id)! }
}

type Probe = ReturnType<typeof makeProbe>

interface GridProps {
  probe: Probe
  menu?: boolean
  keyboard?: boolean
  tree?: boolean
}

const Grid = ({
  probe,
  menu = true,
  keyboard = false,
  tree = false,
}: GridProps) => {
  const table = useCreateTable({
    enableKeyboardNavigation: keyboard,
    columns: COLUMNS as never,
    data: tree ? TREE : DATA,
    getRowId: (row: Item) => row.id,
    getSubRows: (row: Item) => row.subRows,
    plugins: [
      probe.plugin(),
      rowActions(),
      ...(menu
        ? [
            rowActionMenu({ mode: 'always' }),
            headerActionMenu({ mode: 'always' }),
          ]
        : []),
      contextMenu(),
      cellSelection(),
      ...(tree ? [rowExpanding()] : []),
    ] as never,
  })
  return (
    <div style={{ width: 640, height: 420 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const styles: HTMLStyleElement[] = []
/** Вспышка держится весь тест: проверка не застаёт угасание. */
const holdLong = () => {
  const style = document.createElement('style')
  style.textContent = '.data-grid-theme { --tsr-comp-flash-duration: 60s; }'
  document.head.append(style)
  styles.push(style)
}

const themeStyle = (css: string) => {
  const style = document.createElement('style')
  style.textContent = `.data-grid-theme { ${css} }`
  document.head.append(style)
  styles.push(style)
}

afterEach(async () => {
  styles.splice(0).forEach(style => style.remove())
  document.documentElement.classList.remove('dark')
  await commands.reducedMotion(false)
  await commands.forcedColors(false)
})

const renderGrid = async (props: Partial<GridProps> = {}) => {
  const probe = props.probe ?? makeProbe()
  const screen = await render(<Grid {...props} probe={probe} />)
  await waitForGrid()
  return { probe, screen }
}

const rowEl = (id: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${id}"]`,
  )
const cellEl = (rowId: string, columnId = 'name') =>
  rowEl(rowId)?.querySelector<HTMLElement>(`[data-column-id="${columnId}"]`) ??
  null
const headCell = (columnId = 'name') =>
  document.querySelector<HTMLElement>(
    `.data-grid__head-cell[data-column-id="${columnId}"]`,
  )!
const items = () => [
  ...document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
]
const item = (label: string) =>
  items().find(
    el => el.querySelector('[class*="itemLabel"]')?.textContent === label,
  )
const failedIcon = (el: Element | undefined) =>
  el?.querySelector('[data-action-failed]') ?? null
const liveRegion = () =>
  document.querySelector<HTMLElement>('[role="status"][aria-live="polite"]')!
const scroller = () =>
  document.querySelector<HTMLElement>('.data-grid__container')!
const frame = () => new Promise(resolve => requestAnimationFrame(resolve))
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const flashOf = (el: Element | null) => el?.getAttribute('data-flash') ?? null
const busy = (el: Element | null) => el?.getAttribute('aria-busy') === 'true'

/** Выбор диапазона — подготовка состояния, не предмет проверки. */
const selectCell = (cell: HTMLElement, shiftKey = false) => {
  const init = { bubbles: true, cancelable: true, button: 0, shiftKey }
  cell.dispatchEvent(new MouseEvent('mousedown', init))
  document.dispatchEvent(new MouseEvent('mouseup', init))
}

const openContext = async (rowId: string, columnId = 'name') => {
  await userEvent.click(cellEl(rowId, columnId)!, { button: 'right' })
  await expect.poll(() => items().length, { timeout: 4000 }).toBeGreaterThan(0)
}
const chooseInContext = async (
  label: string,
  rowId = 'r1',
  columnId = 'name',
) => {
  await openContext(rowId, columnId)
  await humanClick(item(label)!)
  await expect.poll(() => items().length).toBe(0)
}
const closeMenu = async () => {
  await userEvent.keyboard('{Escape}')
  await expect.poll(() => items().length).toBe(0)
}
const rowKebab = (id: string) =>
  rowEl(id)?.querySelector<HTMLElement>(
    `[aria-label^="${tableLabels.rowMenu}"]`,
  ) ?? null
/** Отметка отказа на кебабе строки (ADR 0078, §5). */
const kebabFailed = (id: string) =>
  rowKebab(id)?.querySelector<HTMLElement>('[data-error-indicator]')?.dataset
    .shown === 'true'
const headKebab = () =>
  headCell().querySelector<HTMLElement>(
    `[aria-label^="${tableLabels.headerMenu}"]`,
  )!

/** Ячейки строк `rows` колонок `columns`: залиты ли вспышкой `reverted`. */
const flashed = (rows: string[], columns = ['name', 'city']) =>
  rows.flatMap(rowId =>
    columns.map(columnId => flashOf(cellEl(rowId, columnId)) === 'reverted'),
  )

describe('Отказ пункта контекстного меню на цели', () => {
  test('TG2: отказ пункта контекстного меню без target — reverted на ячейке, где открыли меню, в кадре отказа; значок отказа в пункте и объявление остаются', async () => {
    const { probe } = await renderGrid()
    await chooseInContext('Recalculate')
    expect(flashOf(cellEl('r1'))).toBeNull()

    probe.run('recalculate').reject(new Error('Server is busy'))
    await frame()
    expect(flashOf(cellEl('r1'))).toBe('reverted')
    expect(flashOf(cellEl('r1', 'city'))).toBeNull()
    expect(flashOf(cellEl('r2'))).toBeNull()
    expect(flashOf(rowEl('r1'))).toBeNull()

    await expect
      .poll(() => liveRegion().textContent)
      .toContain(
        tableLabels.announceActionFailed('Recalculate', 'Server is busy'),
      )
    await openContext('r1')
    expect(failedIcon(item('Recalculate'))).not.toBeNull()
    await closeMenu()
  })

  test('TG3: меню на выделении из нескольких ячеек — reverted на всём выделении, по диапазону на прямоугольник; ячейки, ушедшие из окна виртуализации и вернувшиеся до истечения, залиты', async () => {
    holdLong()
    const { probe } = await renderGrid()
    selectCell(cellEl('r1')!)
    selectCell(cellEl('r3', 'city')!, true)
    await expect
      .poll(() => cellEl('r3', 'city')?.getAttribute('data-cell-selected'))
      .toBe('true')

    await chooseInContext('Recalculate', 'r2', 'city')
    probe.run('recalculate').reject(new Error('locked'))
    await frame()
    expect(flashed(['r1', 'r2', 'r3'])).toEqual(Array(6).fill(true))
    expect(flashed(['r0', 'r4'])).toEqual(Array(4).fill(false))

    // Два прямоугольника выделения — две записи; r1 уходит из окна и возвращается.
    selectCell(cellEl('r5')!)
    selectCell(cellEl('r6')!, true)
    const extra = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      button: 0,
      ctrlKey: true,
      metaKey: true,
    })
    cellEl('r8', 'city')!.dispatchEvent(extra)
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    await expect
      .poll(() => cellEl('r8', 'city')?.getAttribute('data-cell-selected'))
      .toBe('true')
    await chooseInContext('Recalculate', 'r5')
    probe.run('recalculate').reject(new Error('locked'))
    await frame()
    expect(flashed(['r5', 'r6'], ['name'])).toEqual([true, true])
    expect(flashOf(cellEl('r8', 'city'))).toBe('reverted')
    expect(flashOf(cellEl('r7'))).toBeNull()

    scroller().scrollTop = 6000
    await expect.poll(() => rowEl('r1')).toBeNull()
    scroller().scrollTop = 0
    await expect.poll(() => rowEl('r1')).not.toBeNull()
    expect(flashed(['r1', 'r2', 'r3'])).toEqual(Array(6).fill(true))
  })

  test('TG4: target со строкой, колонкой или массивом целей — вспыхивает эта цель; target: false — ни вспышки, ни ожидания на цели', async () => {
    holdLong()
    const { probe } = await renderGrid()

    await chooseInContext('Whole row', 'r1')
    probe.run('wholeRow').reject(new Error('no'))
    await expect.poll(() => flashOf(rowEl('r1'))).toBe('reverted')
    expect(flashOf(cellEl('r1'))).toBeNull()
    expect(flashOf(rowEl('r2'))).toBeNull()

    await chooseInContext('Whole column', 'r4', 'city')
    probe.run('wholeColumn').reject(new Error('no'))
    await expect
      .poll(() => cellEl('r6', 'city')?.getAttribute('data-column-flash'))
      .toBe('reverted')
    expect(headCell('city').getAttribute('data-column-flash')).toBe('reverted')
    expect(cellEl('r6', 'name')?.hasAttribute('data-column-flash')).toBe(false)

    await chooseInContext('Row and column', 'r10', 'name')
    probe.run('rowAndColumn').reject(new Error('no'))
    await expect.poll(() => flashOf(rowEl('r10'))).toBe('reverted')
    expect(headCell('name').getAttribute('data-column-flash')).toBe('reverted')

    await chooseInContext('Nowhere', 'r12')
    await frame()
    expect(busy(cellEl('r12'))).toBe(false)
    expect(
      document.querySelectorAll('[aria-busy="true"][role$="cell"]'),
    ).toHaveLength(0)
    probe.run('nowhere').reject(new Error('no'))
    await frame()
    expect(flashOf(cellEl('r12'))).toBeNull()
    expect(flashOf(rowEl('r12'))).toBeNull()
  })
})

describe('Отказ кебаба и инлайн-кнопки на цели', () => {
  test('TG5: кебаб строки, кебаб заголовка и инлайн-кнопка с target — reverted на цели в кадре, где гаснет дуга; без target — ожидание и отказ только на кнопке', async () => {
    holdLong()
    const { probe, screen } = await renderGrid()
    const fromRowMenu = async (label: string, id = 'r1') => {
      await userEvent.hover(cellEl(id)!)
      await expect.poll(() => rowKebab(id)).not.toBeNull()
      await humanClick(rowKebab(id)!)
      await expect
        .poll(() => items().length, { timeout: 4000 })
        .toBeGreaterThan(0)
      await humanClick(item(label)!)
      await expect.poll(() => items().length).toBe(0)
    }

    // Без target: отметка на кебабе, на строке вспышки нет.
    await fromRowMenu('Remove')
    expect(busy(cellEl('r1'))).toBe(false)
    probe.run('remove').reject(new Error('locked'))
    await expect.poll(() => kebabFailed('r1')).toBe(true)
    await sleep(100)
    expect(flashOf(rowEl('r1'))).toBeNull()
    expect(flashOf(cellEl('r1'))).toBeNull()

    // С target строки: вспышка в том же кадре, где кебаб получил отказ.
    await fromRowMenu('Archive', 'r2')
    probe.run('archive').reject(new Error('locked'))
    await frame()
    expect(rowKebab('r2')!.getAttribute('aria-busy')).not.toBe('true')
    expect(flashOf(rowEl('r2'))).toBe('reverted')

    // Кебаб заголовка с target колонки.
    await userEvent.hover(headCell())
    await humanClick(headKebab())
    await expect
      .poll(() => items().length, { timeout: 4000 })
      .toBeGreaterThan(0)
    await humanClick(item('Freeze')!)
    await expect.poll(() => items().length).toBe(0)
    probe.run('freeze').reject(new Error('locked'))
    await frame()
    expect(headCell().getAttribute('data-column-flash')).toBe('reverted')
    await screen.unmount()

    // Инлайн-кнопка с target строки и без него.
    const inline = await renderGrid({ menu: false })
    const button = (id: string, label: string) =>
      rowEl(id)!.querySelector<HTMLElement>(`[aria-label="${label}"]`)!
    await userEvent.hover(cellEl('r3')!)
    await humanClick(button('r3', 'Archive'))
    inline.probe.run('archive').reject(new Error('locked'))
    await frame()
    expect(flashOf(rowEl('r3'))).toBe('reverted')
    await userEvent.hover(cellEl('r4')!)
    await humanClick(button('r4', 'Remove'))
    inline.probe.run('remove').reject(new Error('locked'))
    await expect.poll(() => failureShownOn(button('r4', 'Remove'))).toBe(true)
    expect(flashOf(rowEl('r4'))).toBeNull()
  })
})

describe('Ожидание и успех на цели', () => {
  test('TG6: пока промис ждёт, ячейки цели в окне несут aria-busy="true", курсор над ними обычный; итог снимает признак; в ролях table, grid и treegrid', async () => {
    for (const [role, props] of [
      ['table', {}],
      ['grid', { keyboard: true }],
      ['treegrid', { keyboard: true, tree: true }],
    ] as const) {
      const { probe, screen } = await renderGrid(props)
      expect(document.querySelector(`[role="${role}"]`), role).not.toBeNull()
      await chooseInContext('Recalculate', 'r2')
      const cell = cellEl('r2')!
      await expect.poll(() => busy(cellEl('r2')), { timeout: 2000 }).toBe(true)
      expect(getComputedStyle(cell).cursor, role).not.toBe('progress')
      expect(busy(cellEl('r2', 'city'))).toBe(false)
      probe.run('recalculate').resolve()
      await expect.poll(() => busy(cellEl('r2'))).toBe(false)

      // Отказ тоже снимает ожидание.
      await chooseInContext('Whole row', 'r3')
      await expect.poll(() => busy(cellEl('r3', 'city'))).toBe(true)
      probe.run('wholeRow').reject(new Error('no'))
      await expect.poll(() => busy(cellEl('r3', 'city'))).toBe(false)
      await screen.unmount()
    }
  })

  test('TG7: успех пункта — без вспышки на цели; объявление «…: done» остаётся', async () => {
    const { probe } = await renderGrid()
    await chooseInContext('Recalculate', 'r1')
    probe.run('recalculate').resolve()
    await expect
      .poll(() => liveRegion().textContent)
      .toContain(tableLabels.announceActionDone('Recalculate'))
    await frame()
    await sleep(50)
    expect(flashOf(cellEl('r1'))).toBeNull()
    expect(document.querySelectorAll('[data-flash]')).toHaveLength(0)
  })
})

/** Анимации волны ожидания (ADR 0152, §3). */
const waves = () =>
  document
    .getAnimations()
    .filter(animation => animation.id === PENDING_WAVE_ANIMATION)
const translateOf = (keyframe: Keyframe) =>
  Number.parseFloat(/-?[\d.]+/.exec(String(keyframe.transform))![0])
/** Остановить общую волну так, что пик полосы — над серединой ячейки `cell`. */
const bandOver = async (cell: HTMLElement) => {
  const own = waves().find(
    animation => (animation.effect as KeyframeEffect).target === cell,
  )!
  const [from, to] = (own.effect as KeyframeEffect)
    .getKeyframes()
    .map(translateOf)
  const band = Number.parseFloat(getComputedStyle(cell, '::before').width)
  const center = cell.getBoundingClientRect().width / 2 - band / 2
  const duration = own.effect!.getTiming().duration as number
  const time = ((center - from!) / (to! - from!)) * duration
  for (const animation of waves()) {
    animation.pause()
    animation.currentTime = time
  }
  await frame()
  await frame()
}
/** Остановить волну в начале прохода: полоса левее всех ячеек. */
const bandAway = async () => {
  for (const animation of waves()) {
    animation.pause()
    animation.currentTime = 0
  }
  await frame()
  await frame()
}
/** Точка фона ячейки — у края, дальнего от блока содержимого. */
const bgPoint = (el: HTMLElement): [number, number] => {
  const rect = el.getBoundingClientRect()
  return [Math.min(rect.right - 8, innerWidth - 4), rect.bottom - 6]
}
const inkPoint = (el: HTMLElement): [number, number] => {
  const ink = el
    .querySelector<HTMLElement>('[data-ink]')!
    .getBoundingClientRect()
  return [ink.left + ink.width / 2, ink.top + ink.height / 2]
}
const brightness = (rgb: number[]) => rgb[0]! + rgb[1]! + rgb[2]!
const distance = (a: number[], b: number[]) =>
  a.reduce((sum, value, i) => sum + Math.abs(value - b[i]!), 0)
/** Цвет CSS, вычисленный в теме грида. */
const resolve = (value: string) => {
  const probe = document.createElement('span')
  probe.style.backgroundColor = value
  document.querySelector('.data-grid-theme')!.appendChild(probe)
  const color = getComputedStyle(probe).backgroundColor
  probe.remove()
  return color
}
const sys = (name: string) => {
  const probe = document.createElement('span')
  probe.style.color = name
  document.body.append(probe)
  const value = getComputedStyle(probe).color
  probe.remove()
  return value
}
/** Выделить r1–r3 по всем трём колонкам и запустить пересчёт из меню на r2. */
const pendOnSelection = async () => {
  selectCell(cellEl('r1')!)
  selectCell(cellEl('r3', 'ink')!, true)
  await expect
    .poll(() => cellEl('r3', 'ink')?.getAttribute('data-cell-selected'))
    .toBe('true')
  await chooseInContext('Recalculate', 'r2', 'city')
}

describe('Волна ожидания на цели', () => {
  test('TG13: пока промис ждёт, ячейки цели чуть темнеют и по ним проходит светлый блик — одна наклонная полоса на все ячейки цели, в одной фазе; текст не светится, ячейки вне цели — тоже; итог снимает подложку и блик', async () => {
    const { probe } = await renderGrid()
    await pendOnSelection()
    await expect.poll(() => waves().length).toBe(9)
    expect(new Set(waves().map(animation => animation.startTime)).size).toBe(1)
    expect(
      waves().every(
        animation =>
          (animation.effect as KeyframeEffect).pseudoElement === '::before',
      ),
    ).toBe(true)

    await bandAway()
    const before = await snapshot()
    const target = cellEl('r2', 'ink')!
    await bandOver(target)
    const lit = await snapshot()
    // Блик светлее подложки.
    expect(
      brightness(lit.rgb(...bgPoint(target))) -
        brightness(before.rgb(...bgPoint(target))),
    ).toBeGreaterThan(8)
    expect(
      distance(lit.rgb(...inkPoint(target)), before.rgb(...inkPoint(target))),
    ).toBeLessThan(3)
    const outside = cellEl('r4', 'ink')!
    expect(lit.rgb(...bgPoint(outside))).toEqual(
      before.rgb(...bgPoint(outside)),
    )
    // Наклон: строка ниже отстаёт — пик её полосы левее на высоту строки × наклон.
    const tilt = Number.parseFloat(
      getComputedStyle(target).getPropertyValue(
        '--tsr-comp-skeleton-wave-tilt',
      ),
    )
    const peakX = (cell: HTMLElement) =>
      new DOMMatrixReadOnly(getComputedStyle(cell, '::before').transform).m41 +
      cell.getBoundingClientRect().left
    const below = cellEl('r3', 'ink')!
    const rowGap =
      below.getBoundingClientRect().top - target.getBoundingClientRect().top
    expect(peakX(target) - peakX(below)).toBeCloseTo(rowGap * tilt, 0)

    for (const animation of waves()) animation.play()
    probe.run('recalculate').resolve()
    await expect.poll(() => waves().length).toBe(0)
    expect(getComputedStyle(target, '::before').content).toBe('none')
    expect(getComputedStyle(target, '::after').content).toBe('none')
  })

  test('TG14: уменьшенное движение — блика нет, ячейки цели остаются под неподвижной подложкой', async () => {
    await commands.reducedMotion(true)
    const { probe } = await renderGrid()
    await chooseInContext('Recalculate', 'r2', 'ink')
    const cell = cellEl('r2', 'ink')!
    await expect.poll(() => busy(cellEl('r2', 'ink'))).toBe(true)
    await sleep(300)
    expect(waves()).toHaveLength(0)
    expect(getComputedStyle(cell, '::before').display).toBe('none')
    expect(
      toRgba(getComputedStyle(cell, '::after').backgroundColor)[3],
    ).toBeGreaterThan(0)
    // Подложка темнее соседней ячейки той же чётности.
    const shot = await snapshot()
    expect(
      brightness(shot.rgb(...bgPoint(cellEl('r4', 'ink')!))) -
        brightness(shot.rgb(...bgPoint(cell))),
    ).toBeGreaterThan(4)
    probe.run('recalculate').resolve()
    await expect.poll(() => busy(cellEl('r2', 'ink'))).toBe(false)
  })

  test('TG15: forced-colors — волны нет, вокруг ячеек цели пунктирный контур Highlight', async () => {
    await commands.forcedColors(true)
    const { probe } = await renderGrid()
    // Цель — строка; ячейка, где открыли меню, несёт кольцо фокуса — смотрим соседнюю.
    await chooseInContext('Whole row', 'r2', 'name')
    await expect.poll(() => busy(cellEl('r2', 'ink'))).toBe(true)
    // Наведение рисует свой контур: указатель — вне грида.
    await userEvent.hover(document.body, { position: { x: 1, y: 1 } })
    const cell = cellEl('r2', 'ink')!
    expect(waves()).toHaveLength(0)
    expect(getComputedStyle(cell, '::after').display).toBe('none')
    const ring = getComputedStyle(cell, '::before')
    expect(ring.transform).toBe('none')
    expect(ring.borderTopStyle).toBe('dotted')
    expect(ring.borderTopColor).toBe(sys('Highlight'))
    // Текст ячейки по-прежнему под режимом: цвета системные.
    expect(
      getComputedStyle(
        cell.querySelector('.data-grid__cell-wrapper-content') ?? cell,
      ).forcedColorAdjust,
    ).toBe('auto')
    expect(getComputedStyle(cellEl('r4', 'ink')!, '::before').content).toBe(
      'none',
    )
    probe.run('wholeRow').resolve()
    await expect.poll(() => busy(cellEl('r2', 'ink'))).toBe(false)
    expect(getComputedStyle(cellEl('r2', 'ink')!, '::before').content).toBe(
      'none',
    )
  })

  test('TG16: текст на подложке и под бликом держит 4.5:1 в обеих темах, axe с color-contrast', async () => {
    const { probe } = await renderGrid()
    await chooseInContext('Recalculate', 'r2', 'name')
    await expect.poll(() => waves().length).toBe(1)
    const cell = cellEl('r2', 'name')!
    await bandOver(cell)
    await inBothThemes(async () => {
      const over = (fg: number[], bg: number[]) => [
        ...[0, 1, 2].map(i => fg[i]! * fg[3]! + bg[i]! * (1 - fg[3]!)),
        1,
      ]
      const tinted = over(
        toRgba(resolve('var(--tsr-comp-pending-bg)')),
        backgroundOf(cell),
      )
      const shine = over(
        toRgba(resolve('var(--tsr-comp-pending-wave)')),
        tinted,
      )
      const text = toRgba(
        getComputedStyle(
          cell.querySelector('.data-grid__cell-wrapper-content') ?? cell,
        ).color,
      )
      expect(contrast(text, tinted), 'подложка').toBeGreaterThanOrEqual(4.5)
      expect(contrast(text, shine), 'блик').toBeGreaterThanOrEqual(4.5)
      const { violations } = await axe.run(
        document.querySelector<HTMLElement>('[role="table"]')!,
        {
          ...AXE_OPTIONS,
          rules: {
            ...AXE_OPTIONS.rules,
            'color-contrast': { enabled: true },
          },
        },
      )
      expect(violations.map(v => v.id)).toEqual([])
    })
    for (const animation of waves()) animation.play()
    probe.run('recalculate').resolve()
  })

  test('TG19: больше --tsr-comp-pending-wave-limit занятых ячеек в окне — блика нет, ячейки цели под неподвижной подложкой; цель снова меньше порога — блик возвращается', async () => {
    themeStyle('--tsr-comp-pending-wave-limit: 4;')
    const { probe } = await renderGrid()
    const still = () =>
      document.querySelector('[data-pending-wave-still]') !== null

    // Строка — четыре ячейки с колонкой действий, не больше порога: волна.
    const rowCells = (id: string) =>
      rowEl(id)!.querySelectorAll('.data-grid__body-cell').length
    expect(rowCells('r2')).toBeLessThanOrEqual(4)
    await chooseInContext('Whole row', 'r2', 'name')
    await expect.poll(() => waves().length).toBe(rowCells('r2'))
    expect(still()).toBe(false)
    probe.run('wholeRow').resolve()
    await expect.poll(() => waves().length).toBe(0)

    // Выделение 3 × 3 — девять ячеек, больше порога: неподвижный свет.
    await pendOnSelection()
    await expect.poll(() => busy(cellEl('r3', 'ink'))).toBe(true)
    await expect.poll(still).toBe(true)
    expect(waves()).toHaveLength(0)
    expect(getComputedStyle(cellEl('r2', 'ink')!, '::before').display).toBe(
      'none',
    )
    expect(
      toRgba(
        getComputedStyle(cellEl('r2', 'ink')!, '::after').backgroundColor,
      )[3],
    ).toBeGreaterThan(0)
    probe.run('recalculate').resolve()
    await expect.poll(() => busy(cellEl('r2', 'ink'))).toBe(false)

    // Снова строка — волна вернулась.
    await chooseInContext('Whole row', 'r5', 'name')
    await expect.poll(() => waves().length).toBe(rowCells('r5'))
    expect(still()).toBe(false)
    probe.run('wholeRow').resolve()
  })

  test('TG17: токены --tsr-comp-pending-bg, --tsr-comp-pending-wave, --tsr-comp-pending-wave-duration и общие токены волны — ширина, наклон — меняют вид ожидания', async () => {
    themeStyle(`
      --tsr-comp-pending-bg: rgb(0, 0, 255);
      --tsr-comp-pending-wave: rgb(255, 0, 0);
      --tsr-comp-pending-wave-duration: 5s;
      --tsr-comp-skeleton-wave-width: 300px;
      --tsr-comp-skeleton-wave-tilt: 0;
    `)
    const { probe } = await renderGrid()
    await chooseInContext('Recalculate', 'r2', 'name')
    await expect.poll(() => waves().length).toBe(1)
    const band = getComputedStyle(cellEl('r2', 'name')!, '::before')
    expect(band.backgroundImage).toContain('rgb(255, 0, 0)')
    expect(band.backgroundImage).toContain('90deg')
    expect(band.width).toBe('300px')
    expect(
      getComputedStyle(cellEl('r2', 'name')!, '::after').backgroundColor,
    ).toBe('rgb(0, 0, 255)')
    expect(waves()[0]!.effect!.getTiming().duration).toBe(5000)
    probe.run('recalculate').resolve()
  })
})
