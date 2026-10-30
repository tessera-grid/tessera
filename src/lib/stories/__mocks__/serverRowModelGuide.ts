/**
 * «Сервер» гайдов серверной модели строк (ADR 0138, ADR 0151): запросы и удержанные
 * ответы, наборы строк и групп, общие помощники историй подразделов.
 */
import type { TesseraFeatureEntry } from '../../core/features'
import { scrollLayer } from '../../core/scrollStretch'
import type { ServerRowsRequest, ServerRowsResponse } from '../../plugins'
import {
  type FilteringItem,
  filteringColumns,
  filteringItemAt,
} from './filteringData'
import { type GuideStoryStep } from '../demos/GuideStory'
import { SERVER_FAILURE, serverAnswer } from '../demos/serverRowModelDemos'

export const layout = {
  containerHeight: '600',
  height: '480',
  maxHeight: '480',
}

export const bodyRows = (root: HTMLElement) => [
  ...root.querySelectorAll<HTMLElement>('.data-grid__body-row[data-row-id]'),
]
export const skeletonRows = (root: HTMLElement) =>
  root.querySelectorAll('[data-pending-row]').length
export const scroller = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('.data-grid__container')
export const hasRow = (root: HTMLElement, index: number) =>
  !!root.querySelector(`.data-grid__body-row[data-row-id="item-id-${index}"]`)

// --- «Сервер» гайдов ------------------------------------------------------------------

export const SERVER_DELAY_MS = 500

/** Запросы, которые «сервер» получил, и ответы, которые он держит до шага гайда. */
export const server = {
  table: undefined as unknown,
  hold: false,
  held: [] as (() => void)[],
  failed: new Set<number>(),
  starts: [] as number[],
  /** Строки, чьих вложенных строк просили. */
  parents: [] as string[],
  /** Колонка, сортировку по которой «сервер» отклоняет. */
  refuseSort: undefined as string | undefined,
}

/** Отдать ответы, которые «сервер» держал. */
export const release = () => {
  const held = server.held
  server.held = []
  for (const answer of held) answer()
}

/** Новое открытие таблицы — новый кэш: прежние ответы ей не принадлежат. */
export const serverReset: TesseraFeatureEntry = {
  id: 'serverRowModelGuideReset',
  setup: table => {
    // `setup` повторяется при смене аргументов плагинов, а обёртка таблицы новая на каждом
    // рендере: новое открытие узнаётся по хранилищу состояния.
    const store = (table as { store: unknown }).store
    if (server.table === store) return
    server.table = store
    // Окно таблицы просит строки раньше этого `setup`: удержанный запрос новой таблицы
    // отдаётся, ответы прежней она не примет.
    server.hold = false
    release()
    server.starts = []
    server.parents = []
    server.refuseSort = undefined
  },
}

export type ServerMode = {
  total: number
  knownTotal: boolean
  blockSize: number
  /** Начало блока, чья первая попытка падает. */
  failBlock?: number
  /** Сортировку по колонке считает «сервер». */
  sortable?: boolean
  /** Выделение ячеек и клавиатура (ADR 0146). */
  selection?: boolean
}

/** Весь набор «сервера» в порядке сортировки; один расчёт на порядок. */
export const sortedSets = new Map<string, FilteringItem[]>()
export const sortedSet = (
  sorting: ServerRowsRequest['sorting'],
  total: number,
) => {
  const key = `${total}:${JSON.stringify(sorting)}`
  let set = sortedSets.get(key)
  if (!set) {
    set = Array.from({ length: total }, (_, i) => filteringItemAt(i))
    const [sort] = sorting
    if (sort) {
      const id = sort.id as keyof FilteringItem
      set.sort((a, b) => {
        const order = String(a[id]).localeCompare(String(b[id]), undefined, {
          numeric: true,
        })
        return sort.desc ? -order : order
      })
    }
    sortedSets.set(key, set)
  }
  return set
}

export const serverProps =
  ({
    total,
    knownTotal,
    blockSize,
    failBlock,
    sortable,
    selection,
  }: ServerMode): GuideStoryStep['props'] =>
  () => ({
    columnsOverride: filteringColumns,
    dataOverride: [],
    enableServerRowModel: true,
    serverRowModelBlockSize: blockSize,
    serverRowModelRowCount: knownTotal ? total : undefined,
    ...(sortable && {
      enableColumnSorting: true,
      columnSortingMultiSort: false,
    }),
    ...(selection && {
      enableCellSelection: true,
      enableKeyboardNavigation: true,
    }),
    serverRowModelGetRows: ({
      start,
      end,
      sorting,
      signal,
    }: ServerRowsRequest) =>
      new Promise<ServerRowsResponse<FilteringItem>>((resolve, reject) => {
        server.starts.push(start)
        const answer = () => {
          if (signal.aborted) return
          if (start === failBlock && !server.failed.has(start)) {
            server.failed.add(start)
            return reject(new Error(SERVER_FAILURE))
          }
          if (
            sortable &&
            server.refuseSort !== undefined &&
            sorting[0]?.id === server.refuseSort
          ) {
            return reject(new Error(SORT_REFUSAL))
          }
          if (sortable) {
            resolve({
              rows: sortedSet(sorting, total).slice(start, end),
              rowCount: total,
            })
            return
          }
          resolve(serverAnswer({ start, end }, total, knownTotal))
        }
        if (server.hold) server.held.push(answer)
        else setTimeout(answer, SERVER_DELAY_MS)
      }),
    extraPlugins: [serverReset],
  })

/** Пользователь ставит прокрутку на долю высоты списка. */
export const scrollTo = (root: HTMLElement, fraction: number) => {
  const el = scroller(root)!
  el.scrollTop = (el.scrollHeight - el.clientHeight) * fraction
}
export const refreshing = (root: HTMLElement) =>
  !!root.querySelector('.data-grid-theme[data-refreshing]')
export const SORT_REFUSAL = 'The server could not sort the list'

export const layerOf = (root: HTMLElement) => scrollLayer(scroller(root)!)

/** Ввод пользователя — после кадра: действие шага стартует внутри эффекта React. */
export const nextFrame = () => new Promise(requestAnimationFrame)

/** Нажатие клавиши на элементе с фокусом — как ввод пользователя. */
export const press = (
  target: HTMLElement,
  key: string,
  init: KeyboardEventInit = {},
) =>
  target.dispatchEvent(
    new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
      ...init,
    }),
  )

// --- ADR 0144: серверная группировка -------------------------------------------------

export const GROUP_TOTAL = 100_000
export const GROUP_BLOCK = 50
export const GROUP_REFUSAL = 'Server error: grouping is not available'

/** Колонки группировки: сумма визитов и средний возраст — агрегаты сервера. */
export const groupingColumns = filteringColumns.map(column =>
  column.id === 'visits'
    ? { ...column, aggregationFn: 'sum' as const }
    : column.id === 'age'
      ? { ...column, aggregationFn: 'mean' as const }
      : column,
) as typeof filteringColumns

/** Строка-группа «сервера»: значение группы, агрегаты и число строк в ней. */
export interface GroupItem extends FilteringItem {
  count?: number
}

export let groupItems: FilteringItem[] | undefined
export const allGroupItems = () =>
  (groupItems ??= Array.from({ length: GROUP_TOTAL }, (_, i) =>
    filteringItemAt(i),
  ))

/** Строки выборки «сервера»: поиск по имени и городу, путь групп. */
export const groupSelections = new Map<string, FilteringItem[]>()
export const groupSelectionOf = ({
  globalFilter,
  grouping,
  groupKeys,
}: ServerRowsRequest) => {
  const key = JSON.stringify([globalFilter, grouping, groupKeys])
  let items = groupSelections.get(key)
  if (!items) {
    const query = globalFilter.trim().toLowerCase()
    items = allGroupItems().filter(
      item =>
        (!query ||
          item.name.toLowerCase().includes(query) ||
          item.city.toLowerCase().includes(query)) &&
        groupKeys.every(
          (value, level) =>
            item[grouping[level] as keyof FilteringItem] === value,
        ),
    )
    groupSelections.set(key, items)
  }
  return items
}

/** Агрегаты «сервера»: сумма визитов и средний возраст среди известных. */
export const aggregate = (items: readonly FilteringItem[]) => {
  let visits = 0
  let ages = 0
  let known = 0
  for (const item of items) {
    visits += item.visits
    if (item.age !== null) {
      ages += item.age
      known++
    }
  }
  return { visits, age: known ? Math.round(ages / known) : null }
}

/** Ответ «сервера» с группировкой: группы уровня или строки данных, итоги у корня. */
export const groupAnswer = (
  request: ServerRowsRequest,
): ServerRowsResponse<GroupItem> => {
  const items = groupSelectionOf(request)
  const level = request.groupKeys.length
  let rows: GroupItem[] = items
  if (level < request.grouping.length) {
    const column = request.grouping[level] as keyof FilteringItem
    const groups = new Map<unknown, FilteringItem[]>()
    for (const item of items) {
      const members = groups.get(item[column])
      if (members) members.push(item)
      else groups.set(item[column], [item])
    }
    rows = [...groups]
      .sort(([a], [b]) => String(a).localeCompare(String(b)))
      .map(([value, members]) => ({
        id: '',
        name: '',
        city: column === 'city' ? (value as string) : '',
        vip: column === 'vip' ? (value as boolean | null) : null,
        ...aggregate(members),
        count: members.length,
      }))
  }
  return {
    rows: rows.slice(request.start, request.end),
    rowCount: rows.length,
    ...(level === 0 && {
      totals: aggregate(items),
      leafCount: items.length,
    }),
  }
}

export const groupServer = { refuse: false }

export const groupProps =
  ({
    grouping = [],
    search = false,
    counts = true,
  }: {
    grouping?: string[]
    search?: boolean
    /** Сервер присылает число строк групп. */
    counts?: boolean
  }): GuideStoryStep['props'] =>
  () => ({
    columnsOverride: groupingColumns,
    dataOverride: [],
    enableServerRowModel: true,
    serverRowModelBlockSize: GROUP_BLOCK,
    serverRowModelGetGroupChildCount: counts
      ? (row: GroupItem) => row.count
      : undefined,
    enableRowGrouping: true,
    rowGroupingInitialGrouping: grouping,
    enableRowExpanding: true,
    // Линии дерева у серверных групп (ADR 0161).
    enableTreeLines: true,
    enableFooter: true,
    ...(search && { enableQuickSearch: true }),
    serverRowModelGetRows: (request: ServerRowsRequest) =>
      new Promise<ServerRowsResponse<GroupItem>>((resolve, reject) => {
        server.starts.push(request.start)
        if (request.parentId) server.parents.push(request.parentId)
        const answer = () => {
          if (request.signal.aborted) return
          if (groupServer.refuse && request.grouping.length > 0) {
            reject(new Error(GROUP_REFUSAL))
            return
          }
          resolve(groupAnswer(request))
        }
        if (server.hold) server.held.push(answer)
        else setTimeout(answer, SERVER_DELAY_MS)
      }),
    extraPlugins: [serverReset],
  })

export const groupButton = (root: HTMLElement) =>
  root.querySelector<HTMLElement>(
    '.data-grid__head-cell[data-column-id="city"] .column-group__button',
  )
export const groupRows = (root: HTMLElement) =>
  bodyRows(root).filter(row => row.dataset.groupRow === 'true')
export const groupRowOf = (root: HTMLElement, city: string) =>
  root.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id='group:${JSON.stringify([city])}']`,
  )
export const parisItems = () =>
  allGroupItems().filter(item => item.city === 'Paris')

// --- Дерево «сервера» (ADR 0138, S7) ---------------------------------------------------

export const TREE_TOTAL = 1000
export const TREE_BLOCK = 50
/** Вложенных строк у каждой строки верхнего уровня. */
export const TREE_CHILDREN = 4

/** Тысяча строк, у каждой — четыре вложенные; вложенные «сервер» держит по `server.hold`. */
export const treeProps: GuideStoryStep['props'] = () => ({
  columnsOverride: filteringColumns,
  dataOverride: [],
  enableServerRowModel: true,
  serverRowModelBlockSize: TREE_BLOCK,
  serverRowModelRowCount: TREE_TOTAL,
  enableRowExpanding: true,
  rowExpandingHasChildren: (row: { depth: number }) => row.depth === 0,
  // Линии дерева у веток серверной модели (ADR 0161).
  enableTreeLines: true,
  serverRowModelGetRows: ({
    start,
    end,
    parentId,
    signal,
  }: ServerRowsRequest) =>
    new Promise<ServerRowsResponse<FilteringItem>>(resolve => {
      server.starts.push(start)
      if (parentId) server.parents.push(parentId)
      const answer = () => {
        if (signal.aborted) return
        if (!parentId) {
          resolve(serverAnswer({ start, end }, TREE_TOTAL, true))
          return
        }
        // Вложенные строки — свои записи «сервера» с id родителя в начале.
        const first = TREE_TOTAL + Number(parentId.split('-').at(-1)) * 100
        resolve({
          rows: Array.from(
            { length: Math.max(0, Math.min(end, TREE_CHILDREN) - start) },
            (_, k) => ({
              ...filteringItemAt(first + start + k),
              id: `${parentId}.${start + k}`,
            }),
          ),
          rowCount: TREE_CHILDREN,
        })
      }
      if (server.hold && parentId) server.held.push(answer)
      else setTimeout(answer, SERVER_DELAY_MS)
    }),
  extraPlugins: [serverReset],
})
