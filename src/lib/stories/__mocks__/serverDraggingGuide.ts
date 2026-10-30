/**
 * «Сервер» гайдов перетаскивания строк в серверной модели (ADR 0159): свой порядок строк и
 * вложенных строк веток, блоки из него, перенос сохраняется по шагу гайда — подтверждение
 * меняет порядок «сервера», отказ его не трогает.
 */
import type { TesseraFeatureEntry } from '../../core/features'
import type {
  RowDragEnd,
  ServerRowsRequest,
  ServerRowsResponse,
} from '../../plugins'
import type { GuideStoryStep, StepRun } from '../demos/GuideStory'
import { HANDLE, ROW } from '../rowDragging.dnd'
import { cancelDrag, dragHold, pollUntil, shieldHeldDrag } from './catalogPlay'
import {
  type FilteringItem,
  filteringColumns,
  filteringItemAt,
} from './filteringData'

export const DRAG_TOTAL = 1000
const DRAG_BLOCK = 100
const SERVER_DELAY_MS = 300

interface Move {
  end: RowDragEnd
  resolve: () => void
  reject: (error: Error) => void
}

const initialItems = () =>
  Array.from({ length: DRAG_TOTAL }, (_, i) => filteringItemAt(i))

/** Вложенных строк у ветки. */
const BRANCH_CHILDREN = 4

/** У каждой четвёртой строки верхнего уровня — вложенные строки (S3). */
export const isBranch = (id: string) =>
  !id.includes('.') && Number(id.split('-').at(-1)) % 4 === 3

/** Порядок строк «сервера» и переносы, ждущие его ответа. */
export const dragServer = {
  table: undefined as unknown,
  items: initialItems(),
  moves: [] as Move[],
  /** Вложенные строки веток, которые «сервер» уже отдавал. */
  children: new Map<string, FilteringItem[]>(),
  /** Ответы с вложенными строками «сервер» держит до шага гайда. */
  holdChildren: false,
  held: [] as (() => void)[],
  /** Переносы «сервер» подтверждает сам — без шага гайда. */
  auto: false,
  /** Ответ на перенос — отказ. */
  refuse: false,
}

/** Строки ветки `parentId`, без него — верхнего уровня. */
const listOf = (parentId: string | undefined) => {
  if (!parentId) return dragServer.items
  let list = dragServer.children.get(parentId)
  if (!list) {
    const first = DRAG_TOTAL + Number(parentId.split('-').at(-1)) * 10
    list = Array.from({ length: BRANCH_CHILDREN }, (_, k) => ({
      ...filteringItemAt(first + k),
      id: `${parentId}.${k}`,
    }))
    dragServer.children.set(parentId, list)
  }
  return list
}

/** «Сервер» отдаёт вложенные строки, которые держал. */
export const releaseChildren = () => {
  dragServer.holdChildren = false
  const held = dragServer.held
  dragServer.held = []
  for (const answer of held) answer()
}

export const MOVE_REFUSAL = 'The server could not save the new order'

/** Ответить на ждущий перенос: подтверждение переставляет строку у «сервера». */
export const answerMove = (ok: boolean) => {
  const move = dragServer.moves.shift()
  if (!move) return
  if (!ok) {
    move.reject(new Error(MOVE_REFUSAL))
    return
  }
  const source = listOf(move.end.previousParentId)
  const from = source.findIndex(item => item.id === move.end.rowId)
  const [item] = source.splice(from, 1)
  listOf(move.end.parentId).splice(move.end.index, 0, item!)
  move.resolve()
}

/** Новое открытие таблицы — порядок «сервера» сначала. */
const dragReset: TesseraFeatureEntry = {
  id: 'serverDraggingGuideReset',
  setup: table => {
    const store = (table as { store: unknown }).store
    if (dragServer.table === store) return
    dragServer.table = store
    dragServer.items = initialItems()
    dragServer.children = new Map()
    dragServer.holdChildren = false
    dragServer.held = []
    for (const move of dragServer.moves) move.reject(new Error('reset'))
    dragServer.moves = []
  },
}

/** Таблица гайда; `tree` — у строк верхнего уровня есть ветки (S3). */
export const dragProps =
  ({ delayMs = SERVER_DELAY_MS, tree = false } = {}): GuideStoryStep['props'] =>
  () => ({
    columnsOverride: filteringColumns,
    dataOverride: [],
    enableServerRowModel: true,
    serverRowModelBlockSize: DRAG_BLOCK,
    serverRowModelRowCount: DRAG_TOTAL,
    serverRowModelGetRows: ({ start, end, parentId }: ServerRowsRequest) =>
      new Promise<ServerRowsResponse<FilteringItem>>(resolve => {
        const answer = () => {
          const list = listOf(parentId)
          resolve({ rows: list.slice(start, end), rowCount: list.length })
        }
        if (parentId && dragServer.holdChildren) dragServer.held.push(answer)
        else setTimeout(answer, delayMs)
      }),
    ...(tree && {
      enableRowExpanding: true,
      rowExpandingHasChildren: (row: { id: string }) => isBranch(row.id),
    }),
    enableRowDragging: true,
    onRowDragEnd: (end: RowDragEnd) =>
      new Promise<void>((resolve, reject) => {
        dragServer.moves.push({ end, resolve, reject })
        if (dragServer.auto) {
          setTimeout(() => answerMove(!dragServer.refuse), delayMs)
        }
      }),
    extraPlugins: [dragReset],
  })

export const rowOf = (root: ParentNode, id: string) =>
  root.querySelector<HTMLElement>(`${ROW}[data-row-id="${id}"]`)
/** Место строки в списке. */
export const indexOfRow = (root: ParentNode, id: string) =>
  Number(rowOf(root, id)?.dataset.index ?? -1)
/** По ручке строки бежит дуга ожидания. */
export const movePending = (root: ParentNode, id: string) =>
  rowOf(root, id)?.getAttribute('aria-busy') === 'true'

const centerOf = (el: Element) => {
  const box = el.getBoundingClientRect()
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
}

/**
 * Пользователь переносит строку `id` за ручку на место строки `overId`: указатель — на
 * середину цели со сдвигом в сторону движения, бросок.
 */
export const dropRow = async (
  root: HTMLElement,
  id: string,
  overId: string,
  { signal, onLeave }: StepRun,
) => {
  await pollUntil(() => !!rowOf(root, id) && !!rowOf(root, overId), signal)
  const handle = rowOf(root, id)!.querySelector<HTMLElement>(HANDLE)!
  const lift = shieldHeldDrag()
  onLeave(lift)
  onLeave(cancelDrag)
  const from = centerOf(handle)
  const held = await dragHold(handle, { x: from.x, y: from.y + 8 }, 4, signal)
  const over = rowOf(root, overId)!.getBoundingClientRect()
  const down = over.top > from.y
  await held.moveTo(
    { x: from.x, y: over.top + over.height / 2 + (down ? 6 : -6) },
    12,
  )
  signal.throwIfAborted()
  await held.release()
  lift()
}
