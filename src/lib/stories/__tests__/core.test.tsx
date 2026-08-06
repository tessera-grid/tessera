import { page, userEvent } from 'vitest/browser'
import { describe, expect, test } from 'vitest'

import {
  SEL,
  bodyRows,
  getScroller,
  headCells,
  renderGrid,
  renderedColumnIndexes,
  renderedRowIndexes,
  scrollToEnd,
} from './helpers'

// Каждое требование ядра из docs/decisions/0004-core-on-tanstack-table.md —
// это отдельный именованный тест с префиксом `R<n>`, чтобы `npm test` отчитывался
// и падал по каждому требованию поимённо (см. docs/architecture/visual-tests.md).
// Охват — базовое поведение таблицы, наблюдаемое независимо от плагинов: структура,
// размеры, отступы, базовые роли/атрибуты, hover-состояния, зебра и раскладка при
// прокрутке. Плагинные атрибуты и механика виртуализации — в ADR своих фич.
//
// Все тесты гоняют каноническую историю `All Features`; каждый монтируется заново
// (auto-cleanup vitest-browser-react), поэтому состояние не течёт между тестами.
// Тесты, поднимающие CSS-`:hover`, снимают его в finally, чтобы курсор не оставался
// над ячейкой.

// --- Локальные хелперы --------------------------------------------------------

const nextFrame = () =>
  new Promise<void>(resolve => requestAnimationFrame(() => resolve()))

/** Дождаться, пока грид смонтируется и отрисует заголовки и строки. */
const waitForGrid = () =>
  expect.element(page.getByText('Country')).toBeInTheDocument()

const bodyCellsOf = (row: HTMLElement) =>
  Array.from(row.querySelectorAll<HTMLElement>(SEL.bodyCell))

const textOf = (el: Element) => el.textContent?.trim() ?? ''

/** Строки в визуальном (сверху вниз) порядке. */
const rowsTopDown = () =>
  bodyRows().sort(
    (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top,
  )

/** Заголовки в визуальном (слева направо) порядке. */
const headCellsLeftRight = () =>
  headCells().sort(
    (a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left,
  )

/**
 * Разрешить цвет CSS-переменной грида в конкретный rgb: пробник наследует
 * `--data-grid-*` от обёртки темы, поэтому `var(--token)` вычисляется так же, как
 * на реальной ячейке. Позволяет сравнивать фактический цвет с обещанным токеном
 * без хрупких хардкод-rgb.
 */
const resolveVarColor = (expr: string): string => {
  const host = getScroller()
  const probe = document.createElement('span')
  probe.style.color = `var(${expr})`
  host.appendChild(probe)
  const rgb = getComputedStyle(probe).color
  probe.remove()
  return rgb
}

const HEAD_HEIGHT_VAR = '--data-grid-head-height'
const ROW_HEIGHT_VAR = '--data-grid-row-height'

/** Значение CSS-переменной, вычисленное на реальном узле грида. */
const cssVar = (name: string) =>
  getComputedStyle(getScroller()).getPropertyValue(name).trim()

// --- R1–R5: структура, порядок, содержимое ------------------------------------

describe('Ядро на TanStack — структура и порядок', () => {
  test('R1: во вьюпорте число заголовков = числу колонок, строк = числу data', async () => {
    const columnCount = 3
    const dataCount = 5
    renderGrid({ columnCount, dataCount })
    await waitForGrid()

    expect(headCells()).toHaveLength(columnCount)

    const rows = bodyRows()
    expect(rows).toHaveLength(dataCount)
    rows.forEach(row => {
      expect(bodyCellsOf(row)).toHaveLength(columnCount)
    })
  })

  test('R2: порядок колонок (aria-colindex) совпадает с порядком их создания', async () => {
    renderGrid({ columnCount: 3, dataCount: 3 })
    await waitForGrid()

    // DOM-порядок заголовков (слева направо) и их aria-colindex — восходящие 0..n-1,
    // а тексты идут в порядке определения колонок (Country → First Name → Last Name).
    const cells = headCellsLeftRight()
    expect(cells.map(c => Number(c.getAttribute('aria-colindex')))).toEqual([
      0, 1, 2,
    ])
    expect(cells.map(textOf)).toEqual(['Country', 'First Name', 'Last Name'])
  })

  test('R3: порядок строк (data-index/aria-rowindex) совпадает с порядком data', async () => {
    const dataCount = 5
    renderGrid({ columnCount: 3, dataCount })
    await waitForGrid()

    const rows = rowsTopDown()
    // Сверху вниз индексы идут 0..n-1 (порядок массива data), а aria-rowindex
    // на каждой строке совпадает с её data-index.
    rows.forEach((row, i) => {
      expect(row.getAttribute('data-index')).toBe(String(i))
      expect(row.getAttribute('aria-rowindex')).toBe(String(i))
    })
  })

  test('R4: i-я ячейка тела выровнена по ширине и позиции с i-м заголовком', async () => {
    renderGrid({ columnCount: 3, dataCount: 3 })
    await waitForGrid()

    const heads = headCellsLeftRight()
    const firstRowCells = bodyCellsOf(rowsTopDown()[0]).sort(
      (a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left,
    )
    expect(firstRowCells).toHaveLength(heads.length)

    heads.forEach((head, i) => {
      const hr = head.getBoundingClientRect()
      const cr = firstRowCells[i].getBoundingClientRect()
      // Колонка и её заголовок несут один aria-colindex...
      expect(firstRowCells[i].getAttribute('aria-colindex')).toBe(
        head.getAttribute('aria-colindex'),
      )
      // ...и совпадают по левому краю и ширине (одна вертикальная колонка).
      expect(Math.abs(cr.left - hr.left)).toBeLessThan(1)
      expect(Math.abs(cr.width - hr.width)).toBeLessThan(1)
    })
  })

  test('R5: заголовок рендерит columnDef.header, ячейка — columnDef.cell', async () => {
    // Явные данные: значение ячейки колонки country = row.country, поэтому в теле
    // видно ровно то, что вернул columnDef.cell (getValue()), а в шапке — header.
    renderGrid({
      columnCount: 3,
      dataOverride: [{ country: 'Wonderland', firstName: 'Alice', lastName: 'Liddell' }],
    })
    await waitForGrid()

    const heads = headCellsLeftRight()
    expect(textOf(heads[0])).toBe('Country')

    const firstRowCells = bodyCellsOf(rowsTopDown()[0]).sort(
      (a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left,
    )
    expect(textOf(firstRowCells[0])).toBe('Wonderland')
    expect(textOf(firstRowCells[1])).toBe('Alice')
  })
})

// --- R6–R9: размеры и отступы -------------------------------------------------

describe('Ядро на TanStack — размеры и отступы', () => {
  test('R6: высота ряда заголовков фиксирована (50px/уровень + 1px разделитель)', async () => {
    renderGrid({ columnCount: 4, dataCount: 4 })
    await waitForGrid()

    // Один уровень заголовков → переменная высоты шапки = 50 + 1.
    expect(cssVar(HEAD_HEIGHT_VAR)).toBe('51px')

    const cells = headCells()
    cells.forEach(cell => {
      const wrapper = cell.querySelector<HTMLElement>(
        '.data-grid__cell-wrapper-content',
      )!
      // Фиксированный пол высоты — 50px, а overflow:hidden не даёт контенту
      // растянуть ячейку сверх него (высота не зависит от содержимого).
      expect(getComputedStyle(wrapper).minHeight).toBe('50px')
      expect(getComputedStyle(cell).overflow).toBe('hidden')
    })

    // Все заголовки одного уровня одной высоты.
    const heights = cells.map(c => Math.round(c.getBoundingClientRect().height))
    expect(new Set(heights).size).toBe(1)
  })

  test('R7: высота строки тела фиксирована (--data-grid-row-height, 50px)', async () => {
    renderGrid({ columnCount: 4, dataCount: 6 })
    await waitForGrid()

    expect(cssVar(ROW_HEIGHT_VAR)).toBe('50px')

    const rows = bodyRows()
    rows.forEach(row => {
      // Высота задана переменной явно — не зависит от содержимого ячеек.
      expect(getComputedStyle(row).height).toBe('50px')
    })
  })

  test('R8: ширина колонки определяется её размером (columnDef.size)', async () => {
    // country=200, firstName=150, lastName=150 (см. __mocks__/columns).
    renderGrid({ columnCount: 3, dataCount: 3 })
    await waitForGrid()

    const widths = headCellsLeftRight().map(c =>
      Math.round(c.getBoundingClientRect().width),
    )
    expect(widths).toEqual([200, 150, 150])
  })

  test('R9: горизонтальный отступ контента ячейки зависит от режима', async () => {
    // Дефолтный режим: COLUMN_CONTENT_PADDING = 16px по горизонтали.
    renderGrid({ columnCount: 3, dataCount: 3, enableRowActions: true })
    await waitForGrid()

    const dataWrapper = bodyCellsOf(rowsTopDown()[0])[0].querySelector<HTMLElement>(
      '.data-grid__cell-wrapper-content',
    )!
    const dataStyle = getComputedStyle(dataWrapper)
    expect(dataStyle.paddingLeft).toBe('16px')
    expect(dataStyle.paddingRight).toBe('16px')

    // Сервисная колонка действий рендерится в режиме smallPadding = 4px.
    const actionCell = document.querySelector<HTMLElement>(
      `${SEL.bodyCell}[data-actions-column-cell='true']`,
    )!
    const actionWrapper = actionCell.querySelector<HTMLElement>(
      '.data-grid__cell-wrapper-content',
    )!
    expect(getComputedStyle(actionWrapper).padding).toBe('4px')
  })
})

// --- R10–R12: базовые роли и атрибуты доступности -----------------------------

describe('Ядро на TanStack — роли и атрибуты', () => {
  test('R10: выставлены базовые роли (table/rowgroup/row/columnheader)', async () => {
    // Футер включён, чтобы проверить все три rowgroup (head/body/footer).
    renderGrid({ columnCount: 3, dataCount: 3, enableFooter: true })
    await waitForGrid()

    expect(document.querySelector('[role="table"]')).not.toBeNull()

    const rowgroups = document.querySelectorAll('[role="rowgroup"]')
    expect(rowgroups.length).toBe(3)
    expect(document.querySelector('.data-grid__head[role="rowgroup"]')).not.toBeNull()
    expect(document.querySelector('.data-grid__body[role="rowgroup"]')).not.toBeNull()

    expect(bodyRows().every(r => r.getAttribute('role') === 'row')).toBe(true)
    expect(headCells().every(h => h.getAttribute('role') === 'columnheader')).toBe(
      true,
    )
  })

  test('R11: выставлены базовые индексы (aria-colindex, aria-rowindex + data-index)', async () => {
    renderGrid({ columnCount: 3, dataCount: 3, enableFooter: true })
    await waitForGrid()

    expect(headCells().every(h => h.getAttribute('aria-colindex') !== null)).toBe(
      true,
    )
    bodyCellsOf(bodyRows()[0]).forEach(cell => {
      expect(cell.getAttribute('aria-colindex')).not.toBeNull()
    })
    document
      .querySelectorAll<HTMLElement>('.data-grid__footer-cell')
      .forEach(cell => expect(cell.getAttribute('aria-colindex')).not.toBeNull())

    bodyRows().forEach(row => {
      expect(row.getAttribute('aria-rowindex')).not.toBeNull()
      expect(row.getAttribute('data-index')).not.toBeNull()
    })
  })

  test('R12: на строках/ячейках/заголовках есть базовые позиционные data-атрибуты', async () => {
    renderGrid({ columnCount: 3, dataCount: 3 })
    await waitForGrid()

    const rowAttrs = ['data-layout', 'data-row-odd', 'data-last-row']
    bodyRows().forEach(row => {
      rowAttrs.forEach(attr => expect(row.getAttribute(attr)).not.toBeNull())
    })

    const cellAttrs = [
      'data-first-cell-in-row',
      'data-last-cell-in-row',
      'data-cell-of-first-row',
      'data-cell-of-last-row',
    ]
    bodyCellsOf(bodyRows()[0]).forEach(cell => {
      cellAttrs.forEach(attr => expect(cell.getAttribute(attr)).not.toBeNull())
    })

    const headAttrs = [
      'data-first-header-in-row',
      'data-last-header-in-row',
      'data-first-headers-row',
      'data-last-headers-row',
      'data-header-full-height',
    ]
    headCells().forEach(cell => {
      headAttrs.forEach(attr => expect(cell.getAttribute(attr)).not.toBeNull())
    })
  })
})

// --- R13–R16: визуальные состояния --------------------------------------------

describe('Ядро на TanStack — визуальные состояния', () => {
  test('R13: наведение на заголовок красит фон в --data-grid-head-cell-hovered-bg', async () => {
    renderGrid({ columnCount: 3, dataCount: 3 })
    await waitForGrid()

    const head = headCellsLeftRight()[0]
    const before = getComputedStyle(head).backgroundColor
    const expected = resolveVarColor('--data-grid-head-cell-hovered-bg')

    try {
      await userEvent.hover(head)
      await expect
        .poll(() => getComputedStyle(head).backgroundColor)
        .toBe(expected)
      expect(getComputedStyle(head).backgroundColor).not.toBe(before)
    } finally {
      await userEvent.unhover(head)
    }
  })

  test('R14: наведение на строку красит фон в --data-grid-row-hovered-bg', async () => {
    renderGrid({ columnCount: 3, dataCount: 4 })
    await waitForGrid()

    const row = rowsTopDown()[0]
    const before = getComputedStyle(row).backgroundColor
    const expected = resolveVarColor('--data-grid-row-hovered-bg')

    try {
      await userEvent.hover(row)
      await expect
        .poll(() => getComputedStyle(row).backgroundColor)
        .toBe(expected)
      expect(getComputedStyle(row).backgroundColor).not.toBe(before)
    } finally {
      await userEvent.unhover(row)
    }
  })

  test('R15: наведение на ячейку обводит её аутлайном (--data-grid-cell-outline-color, offset -1px)', async () => {
    renderGrid({ columnCount: 3, dataCount: 3 })
    await waitForGrid()

    const cell = bodyCellsOf(rowsTopDown()[0])[0]
    const expected = resolveVarColor('--data-grid-cell-outline-color')

    try {
      await userEvent.hover(cell)
      await expect
        .poll(() => getComputedStyle(cell).outlineStyle)
        .toBe('solid')
      const style = getComputedStyle(cell)
      expect(style.outlineWidth).toBe('1px')
      expect(style.outlineColor).toBe(expected)
      expect(style.outlineOffset).toBe('-1px')
    } finally {
      await userEvent.unhover(cell)
    }
  })

  test('R16: нечётные строки имеют отличный фон (зебра)', async () => {
    renderGrid({ columnCount: 3, dataCount: 6 })
    await waitForGrid()

    const rows = rowsTopDown()
    const oddRow = rows.find(r => r.getAttribute('data-row-odd') === 'true')!
    const evenRow = rows.find(r => r.getAttribute('data-row-odd') === 'false')!

    const oddBg = getComputedStyle(oddRow).backgroundColor
    const evenBg = getComputedStyle(evenRow).backgroundColor

    expect(oddBg).toBe(resolveVarColor('--data-grid-row-odd-bg'))
    expect(evenBg).toBe(resolveVarColor('--data-grid-row-bg'))
    expect(oddBg).not.toBe(evenBg)
  })
})

// --- R17–R18: раскладка при прокрутке -----------------------------------------

describe('Ядро на TanStack — раскладка при прокрутке', () => {
  test('R17: заголовок липкий (sticky, top 0) и остаётся видимым при прокрутке', async () => {
    renderGrid({ columnCount: 10, dataCount: 200 })
    await waitForGrid()

    const head = document.querySelector<HTMLElement>('.data-grid__head')!
    const style = getComputedStyle(head)
    expect(style.position).toBe('sticky')
    expect(style.top).toBe('0px')

    const scroller = getScroller()
    await scrollToEnd('y')

    // После прокрутки тела вниз шапка приклеена к верхнему краю скроллера.
    const headTop = head.getBoundingClientRect().top
    const scrollerTop = scroller.getBoundingClientRect().top
    expect(Math.abs(headTop - scrollerTop)).toBeLessThan(2)
  })

  test('R18: прокрутка доводит до средней и последней строки/колонки, и они рендерятся', async () => {
    const columnCount = 30
    const dataCount = 200
    renderGrid({ columnCount, dataCount })
    await waitForGrid()

    const scroller = getScroller()

    // Средняя строка достижима вертикальной прокруткой.
    scroller.scrollTop = (scroller.scrollHeight - scroller.clientHeight) / 2
    await nextFrame()
    await nextFrame()
    await expect
      .poll(() =>
        renderedRowIndexes().some(
          i => i > dataCount * 0.4 && i < dataCount * 0.6,
        ),
      )
      .toBe(true)

    // Последняя строка достижима до самого низа.
    await scrollToEnd('y')
    expect(Math.max(...renderedRowIndexes())).toBe(dataCount - 1)

    // Средняя колонка достижима горизонтальной прокруткой.
    scroller.scrollTop = 0
    scroller.scrollLeft = (scroller.scrollWidth - scroller.clientWidth) / 2
    await nextFrame()
    await nextFrame()
    await expect
      .poll(() =>
        renderedColumnIndexes().some(
          i => i > columnCount * 0.4 && i < columnCount * 0.6,
        ),
      )
      .toBe(true)

    // Последняя колонка достижима до самого края.
    await scrollToEnd('x')
    expect(Math.max(...renderedColumnIndexes())).toBe(columnCount - 1)
  })
})
