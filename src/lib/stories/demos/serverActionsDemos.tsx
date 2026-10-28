/**
 * «Сервер» серверных действий (ADR 0116): сортировка, страница, фильтр и поиск — один запрос.
 * Ответ приходит промисом колбэка: через задержку, по команде (удержание) или отказом.
 */
import type { ServerActionContext } from '../../core/serverActions'
import type { FilteringItem } from '../__mocks__/filteringData'
import { type ServerFilters, queryFiltering } from './filteringDemos'
import { type ServerSort, sortRows } from './panelsDemos'

export const ACTION_SERVER_PAGE = 25
export const ACTION_SERVER_REFUSAL = 'Server responded 503 Service Unavailable'

export interface ActionServerQuery {
  sort: ServerSort
  pageIndex: number
  pageSize: number
  search: string
  columnIds: string[]
  filters: ServerFilters
}

export const initialActionQuery = (): ActionServerQuery => ({
  sort: undefined,
  pageIndex: 0,
  pageSize: ACTION_SERVER_PAGE,
  search: '',
  columnIds: [],
  filters: [],
})

/** Ответ «сервера» на запрос: страница строк и число найденных. */
export const queryActionServer = (query: ActionServerQuery) => {
  const found = sortRows(
    queryFiltering(query.filters, query.search, query.columnIds),
    query.sort,
  )
  const from = query.pageIndex * query.pageSize
  return { rows: found.slice(from, from + query.pageSize), total: found.length }
}

/** Как «сервер» поступит с запросом: ответит через задержку, задержит до команды, откажет. */
export type ActionServerMode = 'answer' | 'hold' | 'refuse'

/** Куда «сервер» отдаёт ответ: данные приложения и консоль истории. */
export interface ActionServerSink {
  answer: (rows: FilteringItem[], total: number) => void
  log: (text: string) => void
}

export const createActionServer = ({
  delayMs,
  mode,
}: {
  delayMs: number
  mode: () => ActionServerMode
}) => {
  // Подтверждённый ответом запрос и запрос под текущее состояние таблицы.
  let answered = initialActionQuery()
  let wanted = answered
  let held: (() => void) | undefined

  const send = (
    change: Partial<ActionServerQuery>,
    { signal }: ServerActionContext,
    sink: ActionServerSink,
  ) =>
    new Promise<void>((resolve, reject) => {
      const next = { ...wanted, ...change }
      wanted = next
      const reply = () => {
        if (held === reply) held = undefined
        if (signal.aborted) return
        if (mode() === 'refuse') {
          // Таблица откатывает сортировку и страницу к последнему ответу.
          wanted = answered
          sink.log(`refused ${describeQuery(next)}`)
          reject(new Error(ACTION_SERVER_REFUSAL))
          return
        }
        answered = next
        const { rows, total } = queryActionServer(next)
        sink.log(describeQuery(next, total))
        sink.answer(rows, total)
        resolve()
      }
      if (mode() === 'hold') {
        held = reply
        return
      }
      const timer = setTimeout(reply, delayMs)
      signal.addEventListener('abort', () => clearTimeout(timer), {
        once: true,
      })
    })

  return {
    /** Колбэки серверных действий таблицы. */
    callbacks: (sink: ActionServerSink) => ({
      onToggleColumnSort: (
        id: string,
        direction: 'asc' | 'desc' | false,
        context: ServerActionContext,
      ) =>
        send(
          {
            sort: direction ? { id, desc: direction === 'desc' } : undefined,
          },
          context,
          sink,
        ),
      onPageChange: (
        pageIndex: number,
        pageSize: number,
        context: ServerActionContext,
      ) => send({ pageIndex, pageSize }, context, sink),
      onSearchChange: (
        search: string,
        { columnIds }: { columnIds: string[] },
        context: ServerActionContext,
      ) => send({ search, columnIds }, context, sink),
      onFilterChange: (filters: ServerFilters, context: ServerActionContext) =>
        send({ filters }, context, sink),
    }),
    /** Ответить на задержанный запрос — по текущему режиму. */
    release: () => held?.(),
    /** Запрос ждёт команды. */
    holding: () => held !== undefined,
    /** Новое открытие таблицы — первая страница без условий. */
    reset: () => {
      answered = initialActionQuery()
      wanted = answered
      held = undefined
    },
  }
}

/** Запрос строкой консоли: `page 1 of 8 by name desc search "Alice"`. */
const describeQuery = (query: ActionServerQuery, total?: number) =>
  [
    `page ${query.pageIndex + 1}` +
      (total === undefined
        ? ''
        : ` of ${Math.max(1, Math.ceil(total / query.pageSize))}`),
    query.sort && `by ${query.sort.id} ${query.sort.desc ? 'desc' : 'asc'}`,
    query.filters.length > 0 &&
      `filter ${query.filters.map(({ id, value }) => `${id}=${JSON.stringify(value)}`).join(' ')}`,
    query.search && `search "${query.search}"`,
  ]
    .filter(Boolean)
    .join(' ')
