/**
 * Уровень броска по тексту облака (ADR 0108, §2): строка встаёт на самый глубокий
 * уровень, до отступа которого дошёл текст облака. Служебные колонки перед первой пользовательской
 * сдвигают начало уровней, шаг — шаг отступа темы.
 */
const TITLE = '.data-grid__cell-wrapper-title'
/** Содержимое первой пользовательской ячейки: его начало не двигают кнопки наведения. */
const USER_CONTENT =
  '.data-grid__body-cell:not([data-actions-column-cell="true"]) > .data-grid__cell-wrapper-content'

export interface DropLevelAnchor {
  /** Левый край строки на старте: от него облако смещается на `delta.x`. */
  rowLeft: number
  /** Начало содержимого строки глубины 0. */
  levelZero: number
}

/** Замер на старте, пока строка ещё с текстом, а не скелет слота. */
export const measureDropLevelAnchor = (
  row: Element | null | undefined,
  depth: number,
  indent: number,
): DropLevelAnchor | null => {
  const content = row?.querySelector(USER_CONTENT)
  if (!row || !content) return null
  return {
    rowLeft: row.getBoundingClientRect().left,
    levelZero:
      content.getBoundingClientRect().left +
      parseFloat(getComputedStyle(content).paddingLeft) -
      depth * indent,
  }
}

/**
 * Дробный уровень под текстом облака: облако стоит у левого края строки, сдвинутое на
 * `deltaX`; отступ текста внутри облака меряется по нему самому.
 */
export const dropLevelAt = (
  anchor: DropLevelAnchor | null,
  overlay: Element | null,
  deltaX: number,
  indent: number,
): number | undefined => {
  const title = overlay?.querySelector(TITLE)
  if (!anchor || !overlay || !title || !indent) return undefined
  const textOffset =
    title.getBoundingClientRect().left - overlay.getBoundingClientRect().left
  return (anchor.rowLeft + deltaX + textOffset - anchor.levelZero) / indent
}

/** Замер уровня на сессию перетаскивания: начало уровней строки и облако. */
export const createDropLevel = () => {
  let anchor: DropLevelAnchor | null = null
  let overlay: Element | null = null
  let indent = 0
  return {
    setOverlay: (node: Element | null) => {
      overlay = node
    },
    start: (row: Element | null | undefined, depth: number, step: number) => {
      indent = step
      anchor = measureDropLevelAnchor(row, depth, step)
    },
    levelAt: (deltaX: number) => dropLevelAt(anchor, overlay, deltaX, indent),
  }
}
