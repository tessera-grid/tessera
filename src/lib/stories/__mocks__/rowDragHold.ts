/**
 * Удержание строки за ручку на уровне дерева в гайдах перетаскивания (ADR 0108, ADR 0130):
 * раскладка встала, цель в середине окна, текст облака — на отступе уровня.
 */
import {
  cancelDrag,
  centerOf,
  dragHold,
  pollUntil,
  shieldHeldDrag,
} from './catalogPlay'
import type { StepRun } from '../demos/GuideStory'
import { HANDLE, OVERLAY, ROW, USER_CELL, nextFrame } from '../rowDragging.dnd'

export const CLOUD_TITLE = `${OVERLAY} .data-grid__cell-wrapper-title`
/** Колонка с отступом дерева в данных `makeData`. */
const LEVEL_COLUMN = 'country'

export const tokenPx = (root: Element, name: string) => {
  const probe = document.createElement('span')
  probe.style.cssText = `position:absolute;display:block;width:var(${name})`
  root.appendChild(probe)
  const value = parseFloat(getComputedStyle(probe).width)
  probe.remove()
  return value
}

/**
 * Ждёт, пока узел 15 кадров подряд стоит на месте: после «Далее» панель гайда сначала
 * заливает полоску и лишь затем меняет шаг и свою высоту — грид под ней сдвигается.
 */
export const layoutStill = async (el: Element) => {
  let last = NaN
  for (let still = 0, frame = 0; still < 15 && frame < 300; frame++) {
    await nextFrame()
    const top = el.getBoundingClientRect().top
    still = top === last ? still + 1 : 0
    last = top
  }
}

/**
 * Подводит строку в среднюю полосу окна прокруткой самого окна, не грида: у краёв окна
 * dnd-kit прокручивал бы страницу сам, и цель уезжала бы из-под указателя.
 */
export const centerInWindow = async (row: Element) => {
  const box = row.getBoundingClientRect()
  if (box.top >= innerHeight * 0.25 && box.bottom <= innerHeight * 0.75) return
  scrollBy({
    top: box.top + box.height / 2 - innerHeight / 2,
    behavior: 'instant',
  })
  await layoutStill(row)
}

/** Строка тела, а не её призрак движения (ADR 0107). */
export const rowOf = (root: ParentNode, id: string) =>
  root.querySelector<HTMLElement>(
    `${ROW}[data-row-id="${CSS.escape(id)}"]:not([data-row-ghost])`,
  )

/** Отступ уровня строки — по колонке `column` с отступом дерева. */
export const indentOf = (
  root: ParentNode,
  selector: string,
  column = LEVEL_COLUMN,
) =>
  parseFloat(
    getComputedStyle(
      root.querySelector(`${selector} [data-column-id="${column}"]`)!,
    ).paddingLeft,
  )

export const rowIndent = (root: ParentNode, id: string, column?: string) =>
  indentOf(
    root,
    `${ROW}[data-row-id="${CSS.escape(id)}"]:not([data-row-ghost])`,
    column,
  )

/**
 * Действие шага: берёт строку `id` за ручку и держит над строкой `overId` так, чтобы
 * текст облака встал на уровень `depth` (ADR 0108): слот — на этом уровне. Цели — в
 * верхней части окна грида, вдали от автопрокрутки (ADR 0130, §4). Уход с шага
 * отменяет удержание; пока оно держится, мышь и нажатия на панель гайда его не трогают.
 * `column` — колонка с отступом дерева.
 */
export const holdRowAtLevel = async (
  root: HTMLElement,
  id: string,
  overId: string,
  depth: number,
  { signal, onLeave }: StepRun,
  column?: string,
) => {
  // Удержание прошлого шага отменено: строка вернулась на место.
  await pollUntil(() => !root.querySelector('[data-row-dragging]'), signal)
  const container = root.querySelector('.data-grid__container')!
  await centerInWindow(rowOf(root, overId)!)
  await layoutStill(container)
  signal.throwIfAborted()
  // Тема самого грида: у других узлов темы на холсте шаг без линий дерева.
  const theme = container.closest('.data-grid-theme')!
  const step = tokenPx(theme, '--tsr-comp-row-nesting-indent')
  const source = rowOf(root, id)!
  const cell = source.querySelector<HTMLElement>(
    `${USER_CELL} > .data-grid__cell-wrapper-content`,
  )!
  const sourceDepth = Math.round(rowIndent(root, id, column) / step)
  const levelZero =
    cell.getBoundingClientRect().left +
    parseFloat(getComputedStyle(cell).paddingLeft) -
    sourceDepth * step
  const handle = source.querySelector<HTMLElement>(HANDLE)!
  const from = centerOf(handle)
  const lift = shieldHeldDrag()
  onLeave(lift)
  onLeave(cancelDrag)
  // Строку берут на месте: взятая группа сворачивается, цель меряется после.
  const held = await dragHold(handle, { x: from.x, y: from.y + 8 }, 4, signal)
  await pollUntil(() => !!document.querySelector(CLOUD_TITLE), signal)
  await layoutStill(rowOf(root, overId)!)
  await centerInWindow(rowOf(root, overId)!)
  signal.throwIfAborted()
  const over = rowOf(root, overId)!.getBoundingClientRect()
  const y = over.top + over.height / 2 + (over.top > from.y ? 6 : -6)
  const cloud = document.querySelector(CLOUD_TITLE)!.getBoundingClientRect()
  /** Указатель, при котором текст облака стоит на уровне `level`. */
  const xAt = (level: number) => from.x + levelZero + level * step - cloud.left
  await held.moveTo({ x: xAt(depth), y }, 12)
  return {
    ...held,
    xAt,
    /** Бросок: удерживать больше нечего — фильтр событий снят. */
    release: () => {
      held.release()
      lift()
    },
  }
}

export type HeldRow = Awaited<ReturnType<typeof holdRowAtLevel>>
