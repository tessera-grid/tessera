/**
 * Замер содержимого колонок для автоподбора ширины (ADR 0217, §1): шапка и строки в окне
 * виртуализации. Ширина ячейки — её подпись целиком, без многоточия, плюс всё остальное в
 * ячейке: поля, отступ дерева, кнопки. Колонки вне окна колонок на время замера дорисовываются.
 */
import { setMeasuringColumns } from '../../core/autosize'
import { viewportOf } from '../../core/scrollToRow/viewport'

const TITLE = '.data-grid__cell-wrapper-title'
const CONTENT = '.data-grid__cell-wrapper-content'
const CELLS =
  '.data-grid__head-cell, .data-grid__body-row:not(.data-grid__body-row--skeleton) .data-grid__body-cell'

const frame = () => new Promise(resolve => requestAnimationFrame(resolve))

/**
 * Ширина содержимого узла целиком: рамки его строк текста и потомков. Диапазон один на замер:
 * каждый живой диапазон браузер правит при удалении узлов, тысячи их замедляют уход колонок.
 */
const contentWidth = (range: Range, node: Element) => {
  range.selectNodeContents(node)
  return range.getBoundingClientRect().width
}

/** Ширина, при которой ячейка показала бы содержимое целиком. */
const cellNeed = (range: Range, cell: HTMLElement) => {
  const target = cell.querySelector(TITLE) ?? cell.querySelector(CONTENT)
  const width = cell.getBoundingClientRect().width
  if (!target) return width
  const box = target.getBoundingClientRect()
  return (
    width - box.width + contentWidth(range, target) + overflowOf(target, box)
  )
}

/** Насколько узел вылез за правый отступ родителя: в узкой колонке его держит `min-width`. */
const overflowOf = (node: Element, box: DOMRect) => {
  const parent = node.parentElement
  if (!parent) return 0
  const inner =
    parent.getBoundingClientRect().right -
    parseFloat(getComputedStyle(parent).paddingRight)
  return Math.max(0, box.right - inner)
}

/** Ячейки смонтированных колонок одним проходом: колонка → её ячейки. */
const cellsByColumn = (root: ParentNode) => {
  const byColumn = new Map<string, HTMLElement[]>()
  for (const cell of root.querySelectorAll<HTMLElement>(CELLS)) {
    const id = cell.getAttribute('data-column-id')
    if (id === null) continue
    const list = byColumn.get(id)
    if (list) list.push(cell)
    else byColumn.set(id, [cell])
  }
  return byColumn
}

/** Колонок вне окна на кадр: пачка монтируется одной задачей, а не вся тысяча разом. */
const BATCH = 20

/**
 * Ширины содержимого колонок, px; колонки без ячеек и грид без области — без записи. Колонки
 * окна меряются сразу, остальные дорисовываются пачками по кадру.
 */
export const measureColumns = async (
  table: unknown,
  columnIds: readonly string[],
): Promise<Record<string, number>> => {
  const root = viewportOf(table)?.getScrollElement()
  if (!root) return {}
  const range = document.createRange()
  const widths: Record<string, number> = {}
  const measure = (
    cellsOf: Map<string, HTMLElement[]>,
    ids: readonly string[],
  ) => {
    for (const id of ids) {
      const cells = cellsOf.get(id)
      if (!cells) continue
      widths[id] = Math.ceil(
        Math.max(...cells.map(cell => cellNeed(range, cell))),
      )
    }
  }
  const mounted = cellsByColumn(root)
  measure(mounted, columnIds)
  const missing = columnIds.filter(id => !mounted.has(id))
  try {
    for (let start = 0; start < missing.length; start += BATCH) {
      const batch = missing.slice(start, start + BATCH)
      setMeasuringColumns(table, batch)
      await frame()
      await frame()
      measure(cellsByColumn(root), batch)
    }
  } finally {
    if (missing.length) setMeasuringColumns(table, [])
  }
  return widths
}
