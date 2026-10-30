/**
 * «Сервер» гайдов перетаскивания строк в серверной модели (ADR 0159): свой порядок строк,
 * блоки из него, перенос сохраняется по шагу гайда — подтверждение меняет порядок
 * «сервера», отказ его не трогает.
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

/** Порядок строк «сервера» и переносы, ждущие его ответа. */
export const dragServer = {
  table: undefined as unknown,
  items: initialItems(),
  moves: [] as Move[],
  /** Переносы «сервер» подтверждает сам — без шага гайда. */
  auto: false,
  /** Ответ на перенос — отказ. */
  refuse: false,
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
  const from = dragServer.items.findIndex(item => item.id === move.end.rowId)
  const [item] = dragServer.items.splice(from, 1)
  dragServer.items.splice(move.end.index, 0, item!)
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
    for (const move of dragServer.moves) move.reject(new Error('reset'))
    dragServer.moves = []
  },
}

export const dragProps =
  ({ delayMs = SERVER_DELAY_MS } = {}): GuideStoryStep['props'] =>
  () => ({
    columnsOverride: filteringColumns,
    dataOverride: [],
    enableServerRowModel: true,
    serverRowModelBlockSize: DRAG_BLOCK,
    serverRowModelRowCount: DRAG_TOTAL,
    serverRowModelGetRows: ({ start, end }: ServerRowsRequest) =>
      new Promise<ServerRowsResponse<FilteringItem>>(resolve =>
        setTimeout(
          () =>
            resolve({
              rows: dragServer.items.slice(start, end),
              rowCount: dragServer.items.length,
            }),
          delayMs,
        ),
      ),
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
