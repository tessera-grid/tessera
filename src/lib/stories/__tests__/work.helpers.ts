import { commands } from 'vitest/browser'

import { onReactCommit, type FiberRoot } from './reactCommits'
import type { RenderMetrics } from './work.commands'

// Счётчики работы действия (ADR 0099, этап 2): коммиты React, отрисованные компоненты,
// созданные и удалённые DOM-узлы, раскладки и пересчёты стилей, пересборки моделей
// строк. Работа считается, а не меряется: на любой машине два одинаковых действия дают
// одинаковые числа.

const trace = commands as unknown as {
  renderTraceStart: (id: string) => Promise<void>
  renderTraceStop: (id: string) => Promise<RenderMetrics>
}

let traces = 0

interface Fiber {
  tag: number
  flags: number
  type: unknown
  stateNode: unknown
  child: Fiber | null
  sibling: Fiber | null
  return: Fiber | null
}

/** Флаг fiber «компонент выполнил работу в этом рендере» (`PerformedWork` React). */
const PERFORMED_WORK = 1
const HOST_ROOT = 3
/** Function, Class, ForwardRef, SimpleMemo; у `memo` с `compare` считается внутренний fiber. */
const COMPONENT_TAGS = new Set([0, 1, 11, 15])

/** Компонент как ключ счёта: функция, класс или объект `forwardRef`; `memo` — его `type`. */
type Component = unknown

const MEMO = Symbol.for('react.memo')

const unwrap = (component: Component): Component => {
  const memo = component as { $$typeof?: symbol; type?: Component }
  return memo?.$$typeof === MEMO ? unwrap(memo.type) : component
}

const nameOf = (component: Component) => {
  const type = component as
    | { displayName?: string; name?: string; render?: { name?: string } }
    | undefined
  return type?.displayName || type?.name || type?.render?.name || '(анонимный)'
}

const fiberOf = (element: Element): Fiber => {
  const key = Object.keys(element).find(name =>
    name.startsWith('__reactFiber$'),
  )
  if (!key) throw new Error('элемент не отрисован React')
  return (element as unknown as Record<string, Fiber>)[key]
}

/** Корень React, которому принадлежит элемент. */
const rootOf = (element: Element): FiberRoot => {
  let fiber = fiberOf(element)
  while (fiber.return) fiber = fiber.return
  if (fiber.tag !== HOST_ROOT) throw new Error('корень React не найден')
  return fiber.stateNode as FiberRoot
}

/**
 * Все fiber текущего дерева — стеком по `child` и `sibling`: в пропущенном поддереве
 * `return` может указывать на прежнюю копию родителя, и обход вверх уходит в чужое дерево.
 */
const fibersOf = (root: FiberRoot) => {
  const fibers = new Set<Fiber>()
  const stack = [root.current as Fiber]
  while (stack.length > 0) {
    for (let fiber: Fiber | null = stack.pop()!; fiber; fiber = fiber.sibling) {
      fibers.add(fiber)
      if (fiber.child) stack.push(fiber.child)
    }
  }
  return fibers
}

export interface Work {
  /** Коммиты корня грида. */
  commits: number
  /** Отрисовки по компоненту — за все коммиты действия. */
  components: Map<Component, number>
  /** Всего отрисованных компонентов. */
  rendered: number
  /** Вставленные и удалённые элементы, с поддеревьями. */
  nodesAdded: number
  nodesRemoved: number
  layouts: number
  styleRecalcs: number
  /** Пересборки моделей строк: сколько новых моделей вернул метод таблицы. */
  builds: Record<string, number>
}

const frames = async (count: number) => {
  for (let i = 0; i < count; i++) {
    await new Promise(resolve => requestAnimationFrame(resolve))
  }
}

const elementsIn = (nodes: NodeList) => {
  let count = 0
  for (const node of nodes) {
    if (node instanceof Element) {
      count += 1 + node.getElementsByTagName('*').length
    }
  }
  return count
}

/** Модель строк в конвейере TanStack: `sortedRowModel`, `paginatedRowModel`… */
export type RowModelName =
  | 'coreRowModel'
  | 'filteredRowModel'
  | 'groupedRowModel'
  | 'sortedRowModel'
  | 'expandedRowModel'
  | 'paginatedRowModel'

/**
 * Счёт пересборок моделей: мемоизированные модели конвейера лежат в `table._rowModels`,
 * общем у экземпляра ядра и его копий из `useTable`, и звенья вызывают друг друга через
 * него. Модель ленивая: новый результат — это пересборка.
 */
const watchModels = (
  table: object | undefined,
  names: readonly RowModelName[],
) => {
  const builds: Record<string, number> = {}
  const restore: (() => void)[] = []
  if (names.length === 0) return { builds, stop: () => {} }
  const source = table as {
    getRowModel: () => unknown
    _rowModels: Record<string, (() => unknown) | undefined>
  }
  source.getRowModel()
  const models = source._rowModels
  for (const name of names) {
    const original = models[name]
    if (!original) throw new Error(`в конвейере нет модели ${name}`)
    let last = original()
    builds[name] = 0
    models[name] = () => {
      const result = original()
      if (result !== last) {
        last = result
        builds[name]++
      }
      return result
    }
    restore.push(() => (models[name] = original))
  }
  return { builds, stop: () => restore.forEach(fn => fn()) }
}

export interface MeasureOptions {
  /** Экземпляр таблицы — для счёта пересборок моделей. */
  table?: object
  /** Модели строк, чьи пересборки считать. */
  models?: readonly RowModelName[]
  /** Кадров без коммитов, после которых действие считается законченным. */
  quietFrames?: number
}

/**
 * Считает работу `action` в корне React элемента `grid`. После действия ждёт
 * `quietFrames` кадров без коммитов: эффекты и отложенные перерисовки входят в счёт.
 */
export const measureWork = async (
  grid: Element,
  action: () => Promise<unknown> | unknown,
  { table, models = [], quietFrames = 3 }: MeasureOptions = {},
): Promise<Work> => {
  // Кадр прежнего действия дорисовывается до замера: иначе его раскладка попадёт в счёт.
  await frames(2)
  const root = rootOf(grid)
  let previous = fibersOf(root)
  const work: Work = {
    commits: 0,
    components: new Map(),
    rendered: 0,
    nodesAdded: 0,
    nodesRemoved: 0,
    layouts: 0,
    styleRecalcs: 0,
    builds: {},
  }
  onReactCommit(committed => {
    if (committed !== root) return
    work.commits++
    const current = fibersOf(root)
    for (const fiber of current) {
      if (
        COMPONENT_TAGS.has(fiber.tag) &&
        !previous.has(fiber) &&
        (fiber.flags & PERFORMED_WORK) !== 0
      ) {
        work.components.set(
          fiber.type,
          (work.components.get(fiber.type) ?? 0) + 1,
        )
        work.rendered++
      }
    }
    previous = current
  })
  const count = (records: MutationRecord[]) => {
    for (const record of records) {
      work.nodesAdded += elementsIn(record.addedNodes)
      work.nodesRemoved += elementsIn(record.removedNodes)
    }
  }
  const observer = new MutationObserver(count)
  observer.observe(document.body, { childList: true, subtree: true })
  const watched = watchModels(table, models)
  const traceId = `work-${++traces}`
  await trace.renderTraceStart(traceId)
  let rendering: RenderMetrics
  try {
    await action()
    let quiet = 0
    while (quiet < quietFrames) {
      const commits = work.commits
      await frames(1)
      quiet = work.commits === commits ? quiet + 1 : 0
    }
  } finally {
    count(observer.takeRecords())
    observer.disconnect()
    onReactCommit(undefined)
    watched.stop()
    rendering = await trace.renderTraceStop(traceId)
  }
  work.layouts = rendering.layouts
  work.styleRecalcs = rendering.styleRecalcs
  work.builds = watched.builds
  return work
}

/** Отрисовки компонентов из списка; `memo` разворачивается. */
export const renders = (work: Work, ...components: Component[]) =>
  components.reduce<number>(
    (sum, component) => sum + (work.components.get(unwrap(component)) ?? 0),
    0,
  )

/** Сводка для сообщения теста: самые частые отрисовки и прочие счётчики. */
export const describeWork = (work: Work) => {
  const top = [...work.components]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([component, count]) => `${nameOf(component)}×${count}`)
    .join(', ')
  return (
    `коммитов ${work.commits}, компонентов ${work.rendered} (${top}), ` +
    `узлов +${work.nodesAdded}/−${work.nodesRemoved}, раскладок ${work.layouts}, ` +
    `стилей ${work.styleRecalcs}, моделей ${JSON.stringify(work.builds)}`
  )
}
