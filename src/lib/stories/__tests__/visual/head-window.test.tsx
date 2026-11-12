import axe from 'axe-core'
import { commands, page, userEvent } from 'vitest/browser'
import { describe, expect, onTestFinished, test } from 'vitest'

import { getScroller, renderGrid, revealCellButtons } from '../helpers'
import { AXE_OPTIONS, inBothThemes } from './a11y-helpers'

// Одна раскладка шапки (ADR 0207): виртуализация колонок при группах шапки (NV1–NV3, NV5–NV7),
// липкая подпись группы (NV4), линии между колонками токеном темы и граница группы (NV9–NV10),
// axe (NV12). NV8 — модульный `oneHeadLayout`, NV11 — перф в `scroll`.

const pointer = commands as unknown as {
  realDragHold: (
    from: { x: number; y: number },
    to: { x: number; y: number },
  ) => Promise<void>
  realMouseUp: () => Promise<void>
}

const realDrag = (
  commands as unknown as {
    realDrag: (
      from: { x: number; y: number },
      to: { x: number; y: number },
    ) => Promise<void>
  }
).realDrag

const SIZE = 120
const PER_GROUP = 10

const leaf = (index: number) => ({
  id: `c${index}`,
  accessorKey: `c${index}`,
  header: `C${index}`,
  size: SIZE,
  minSize: SIZE,
  enableDragging: true,
})

const flatColumns = (count: number) =>
  Array.from({ length: count }, (_, index) => leaf(index))

/** Группы по `PER_GROUP` листьев; `lead` — лист без группы перед ними, растянут на обе строки. */
const groupedColumns = (count: number, lead = false) => [
  ...(lead
    ? [{ ...leaf(-1), id: 'lead', accessorKey: 'lead', header: 'Lead' }]
    : []),
  ...Array.from({ length: count / PER_GROUP }, (_, group) => ({
    id: `g${group}`,
    header: `Group ${group}`,
    enableDragging: true,
    columns: Array.from({ length: PER_GROUP }, (_, k) =>
      leaf(group * PER_GROUP + k),
    ),
  })),
]

const dataOf = (columns: number, rows = 40) =>
  Array.from({ length: rows }, (_, row) => {
    const item: Record<string, string> = { id: `r${row}`, lead: `L${row}` }
    for (let column = 0; column < columns; column++)
      item[`c${column}`] = `${row}·${column}`
    return item
  })

const viewport = async (width = 900) => {
  const size = { width: innerWidth, height: innerHeight }
  await page.viewport(width, 800)
  onTestFinished(() => page.viewport(size.width, size.height))
}

const mount = async (
  columns: unknown[],
  count: number,
  args: Parameters<typeof renderGrid>[0] = {},
) => {
  const screen = renderGrid({
    columnsOverride: columns as never,
    dataOverride: dataOf(count),
    dataCount: 40,
    ...args,
  })
  await expect
    .poll(() => document.querySelectorAll('.data-grid__body-row').length)
    .toBeGreaterThan(0)
  return screen
}

const HEAD_CELL = '.data-grid__head-cell'
const box = (element: Element) => element.getBoundingClientRect()
const head = (id: string) =>
  document.querySelector<HTMLElement>(`${HEAD_CELL}[data-column-id='${id}']`)
const leafHeads = () =>
  document.querySelectorAll(`${HEAD_CELL}[data-last-headers-row='true']`)
const firstRowCells = () =>
  document.querySelectorAll(
    ".data-grid__body-row[data-index='0'] .data-grid__body-cell",
  )
const near = (actual: number, expected: number, what: string) =>
  expect(Math.abs(actual - expected), what).toBeLessThanOrEqual(1)
const frame = () => new Promise(requestAnimationFrame)
const scrollTo = async (left: number) => {
  getScroller().scrollLeft = left
  for (let k = 0; k < 4; k++) await frame()
}
const rowOf = (cell: Element) => cell.closest<HTMLElement>('[role="row"]')!
/** Левый край ячейки в координатах её строки. */
const leftInRow = (cell: Element) => box(cell).left - box(rowOf(cell)).left

describe('Одна раскладка шапки (ADR 0207)', () => {
  test('NV1: при вложенной шапке колонки виртуализируются: ячеек тела и листьев шапки — по окну колонок, как у плоской шапки той же таблицы', async () => {
    await viewport()
    const flat = await mount(flatColumns(200), 200)
    const flatCells = firstRowCells().length
    const flatLeaves = leafHeads().length
    await flat.unmount()

    await mount(groupedColumns(200), 200)
    expect(flatCells).toBeLessThan(40)
    expect(firstRowCells().length).toBe(flatCells)
    expect(leafHeads().length).toBe(flatLeaves)
    expect(document.querySelectorAll('.data-grid__body-cell').length).toBe(
      flatCells * document.querySelectorAll('.data-grid__body-row').length,
    )
  })

  test('NV2: ячейка группы рисуется, если в окне хотя бы один её лист; её начало — начало первого листа, ширина — сумма ширин её листьев', async () => {
    await viewport()
    await mount(groupedColumns(200), 200)
    const groupWidth = SIZE * PER_GROUP
    // Окно начинается внутри группы g3: её первые листья вне окна.
    await scrollTo(3 * groupWidth + 6 * SIZE)
    expect(head('c30')).toBeNull()
    const g3 = head('g3')!
    expect(g3).not.toBeNull()
    near(leftInRow(g3), 3 * groupWidth, 'начало g3')
    near(box(g3).width, groupWidth, 'ширина g3')
    // Группы без листьев в окне не рисуются.
    expect(head('g1')).toBeNull()
    expect(head('g0')).toBeNull()
  })

  test('NV3: растянутый лист — одна ячейка на свои строки шапки и при прокрутке колонок: верх у верха шапки, низ на линии с соседними листьями', async () => {
    await viewport()
    await mount(groupedColumns(100, true), 100)
    await scrollTo(60)
    const lead = document.querySelectorAll(
      `${HEAD_CELL}[data-column-id='lead']`,
    )
    expect(lead).toHaveLength(1)
    const headBox = box(document.querySelector('.data-grid__head')!)
    near(box(lead[0]!).top, headBox.top, 'верх')
    near(box(lead[0]!).bottom, box(head('c0')!).bottom, 'низ')
    expect(lead[0]!.getAttribute('aria-rowspan')).toBe('2')
  })

  test('NV4: подпись группы шире видимой части держится у левого края видимой части правее закреплённых колонок и не выходит за свою группу', async () => {
    await viewport()
    await mount(groupedColumns(100, true), 100, {
      enableColumnPinning: true,
      initialColumnPinning: { start: ['lead'], end: [] },
    })
    const title = () =>
      head('g1')!.querySelector<HTMLElement>('.data-grid__cell-wrapper-title')!
    const pinnedRight = () => box(head('lead')!).right
    // Группа g1 начинается за левым краем видимой части — подпись у края, правее закреплённой.
    await scrollTo(PER_GROUP * SIZE + 4 * SIZE)
    near(box(title()).left, pinnedRight(), 'подпись у края видимой части')
    // Конец группы близко — подпись не выходит за неё.
    await scrollTo(2 * PER_GROUP * SIZE - 2 * SIZE)
    expect(box(title()).right).toBeLessThanOrEqual(box(head('g1')!).right + 1)
    expect(box(title()).left).toBeGreaterThanOrEqual(box(head('g1')!).left - 1)
  })

  test('NV5: закреплённые группы и листья стоят на месте при прокрутке колонок, растянутый закреплённый лист — тоже; центральные группы уходят под них', async () => {
    await viewport()
    await mount(groupedColumns(100, true), 100, {
      enableColumnPinning: true,
      initialColumnPinning: {
        start: [
          'lead',
          ...Array.from({ length: PER_GROUP }, (_, k) => `c${k}`),
        ],
        end: [],
      },
    })
    const before = { lead: box(head('lead')!), g0: box(head('g0')!) }
    await scrollTo(6 * PER_GROUP * SIZE)
    near(
      box(head('lead')!).left,
      before.lead.left,
      'закреплённый растянутый лист',
    )
    near(box(head('lead')!).bottom, before.lead.bottom, 'его высота')
    near(box(head('g0')!).left, before.g0.left, 'закреплённая группа')
    // Центральная группа под закреплённой: в точке закреплённой — она.
    const at = box(head('g0')!)
    const hit = document.elementFromPoint(
      at.left + at.width / 2,
      at.top + at.height / 2,
    )
    expect(hit?.closest(HEAD_CELL)?.getAttribute('data-column-id')).toBe('g0')
  })

  test('NV6: перетаскивание листа и группы среди соседей переставляет их, когда соседи вне окна колонок', async () => {
    // Группа целиком в видимой части: наведение на неё не прокручивает таблицу.
    await viewport(1600)
    await mount(groupedColumns(100), 100, {
      enableColumnDragging: true,
      enableColumnSizing: false,
    })
    // Первые листья g1 — вне окна: соседка g2 переезжает перед ней.
    await scrollTo(PER_GROUP * SIZE + 6 * SIZE)
    expect(head('c10')).toBeNull()
    const visibleLeft = (id: string) =>
      Math.max(box(head(id)!).left, box(getScroller()).left)
    const handle = async (id: string) => {
      await revealCellButtons(head(id)!)
      const r = box(head(id)!.querySelector('.drag__handler--column')!)
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    }
    const from = await handle('g2')
    // Точка броска у левого края — в зоне автопрокрутки: таблица едет, пока g1 не освободит место
    // для g2. Отпускание — как только освободила: Firefox крутит быстрее, и бросок на ходу пришёлся
    // бы на другую колонку.
    await pointer.realDragHold(from, { x: visibleLeft('g1') + 5, y: from.y })
    await expect
      .poll(() => new DOMMatrix(getComputedStyle(head('g1')!).transform).m41)
      .toBeGreaterThan(0)
    await pointer.realMouseUp()
    // Переезд колонок доигрывает (ADR 0115): место — после движения.
    await expect
      .poll(() => Math.abs(leftInRow(head('g2')!) - PER_GROUP * SIZE))
      .toBeLessThanOrEqual(1)
    // Лист среди соседей своей группы, часть которых вне окна: c27 перед c26.
    // g2 теперь на месте g1: прокрутка вперёд к её середине — первые листья вне окна.
    await scrollTo(PER_GROUP * SIZE - 2 * SIZE)
    await scrollTo(PER_GROUP * SIZE + 6 * SIZE)
    await expect.poll(() => head('c20')).toBeNull()
    const leafFrom = await handle('c27')
    await realDrag(leafFrom, { x: box(head('c26')!).left + 5, y: leafFrom.y })
    await expect
      .poll(() => leftInRow(head('c27')!) < leftInRow(head('c26')!))
      .toBe(true)
  })

  test('NV7: с keyboardNavigation переход в шапке и теле к колонке вне окна монтирует её и ставит фокус; фокус на группе не теряется при прокрутке', async () => {
    await viewport()
    await mount(groupedColumns(100), 100, { enableKeyboardNavigation: true })
    // Тело: End — последняя колонка, вне окна.
    await userEvent.click(
      document.querySelector<HTMLElement>(
        ".data-grid__body-row[data-index='0'] .data-grid__body-cell[data-column-id='c0']",
      )!,
    )
    await userEvent.keyboard('{End}')
    await expect
      .poll(() => document.activeElement?.getAttribute('data-column-id'))
      .toBe('c99')
    // Шапка: строка групп, End — последняя группа.
    await userEvent.keyboard('{Control>}{Home}{/Control}')
    await userEvent.keyboard('{ArrowUp}{ArrowUp}')
    await expect
      .poll(() => document.activeElement?.getAttribute('data-column-id'))
      .toBe('g0')
    await userEvent.keyboard('{End}')
    await expect
      .poll(() => document.activeElement?.getAttribute('data-column-id'))
      .toBe('g9')
    // Фокус на группе держит её в окне при прокрутке к началу.
    await scrollTo(0)
    expect(document.activeElement?.getAttribute('data-column-id')).toBe('g9')
    expect(head('g9')).not.toBeNull()
  })

  test('NV9: токен --tsr-comp-column-divider-width: 0 по умолчанию — вертикальных линий между колонками нет; заданный — линия в шапке, теле и футере, с группами и без; ширины колонок от токена не меняются', async () => {
    await viewport()
    const width = (cell: Element) => getComputedStyle(cell).borderRightWidth
    const cells = () => ({
      head: head('c2')!,
      body: document.querySelector(
        ".data-grid__body-row[data-index='1'] .data-grid__body-cell[data-column-id='c2']",
      )!,
      footer: document.querySelector(
        ".data-grid__footer-cell[data-column-id='c2']",
      )!,
    })
    const footer = (columns: { id: string }[]) =>
      columns.map(column => ({ ...column, footer: () => 'Σ' }))
    for (const columns of [
      footer(flatColumns(30)),
      groupedColumns(30).map(group =>
        'columns' in group
          ? { ...group, columns: footer(group.columns) }
          : group,
      ),
    ]) {
      const screen = await mount(columns, 30, { enableFooter: true })
      const { head: h, body, footer: f } = cells()
      for (const cell of [h, body, f]) expect(width(cell)).toBe('0px')
      const before = [h, body, f].map(cell => box(cell).width)
      document
        .querySelector<HTMLElement>('.data-grid-theme')!
        .style.setProperty('--tsr-comp-column-divider-width', '1px')
      await frame()
      const after = cells()
      for (const cell of [after.head, after.body, after.footer])
        expect(width(cell)).toBe('1px')
      expect(
        [after.head, after.body, after.footer].map(cell => box(cell).width),
      ).toEqual(before)
      await screen.unmount()
    }
  })

  test('NV10: граница группы в шапке видна при любом значении токена: линия по правому краю заголовка группы и последнего листа группы', async () => {
    await viewport()
    await mount(groupedColumns(30), 30)
    const border = (id: string) => getComputedStyle(head(id)!).borderRightWidth
    expect(border('g0')).toBe('1px')
    expect(border('c9')).toBe('1px')
    expect(border('c8')).toBe('0px')
    expect(head('g0')!.hasAttribute('data-group-end')).toBe(true)
    // Цвет — разделителя: в forced-colors тема подменяет его цветом режима (HC19).
    expect(getComputedStyle(head('c9')!).borderRightColor).toBe(
      getComputedStyle(head('g0')!).borderBottomColor,
    )
  })

  test('NV12: axe с color-contrast в обеих темах — вложенная шапка после прокрутки колонок и таблица с линиями между колонками без нарушений', async () => {
    await viewport()
    await mount(groupedColumns(100, true), 100)
    await scrollTo(3 * PER_GROUP * SIZE + 3 * SIZE)
    document
      .querySelector<HTMLElement>('.data-grid-theme')!
      .style.setProperty('--tsr-comp-column-divider-width', '1px')
    await inBothThemes(async () => {
      const result = await axe.run(
        document.querySelector<HTMLElement>('.data-grid__container')!,
        AXE_OPTIONS,
      )
      expect(result.violations.map(violation => violation.id)).toEqual([])
    })
  })
})
