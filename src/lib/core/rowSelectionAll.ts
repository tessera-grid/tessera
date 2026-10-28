/**
 * Выбор «всё, кроме» серверной модели строк (ADR 0138, §9) и дерево выбора групп
 * (ADR 0148): срез `rowSelection` хранит `{ all, except, groups? }`, а TanStack получает
 * эффективное значение — объект, где строка выбрана по ближайшему узлу пути её групп, в том
 * числе строки блоков, которые придут позже.
 * Общий модуль выбора строк и выгрузки — вне папок плагинов (IV3).
 */
import type { RowSelectionState } from '@tanstack/react-table'

import { GROUP_ROW_PREFIX, groupKeysOf } from './rowSource'

/** Узел группы в дереве выбора: путь её значений и состояние внутри неё. */
export interface RowSelectionGroup {
  /** Путь значений группировки от корня: `['US', 'Smith']`. */
  keys: unknown[]
  /** Группа выбрана целиком, кроме `except` и узлов `groups` внутри неё. */
  all: boolean
  /** Строки, чьё состояние обратно `all`. */
  except: string[]
  groups?: RowSelectionGroup[]
}

/**
 * Выбор без перечисления строк: выбрана вся выборка (`all`), кроме `except`, или не выбрана,
 * кроме `except`; узлы `groups` — группы, чьё состояние отличается от родителя (ADR 0148).
 */
export interface RowSelectionAll {
  all: boolean
  /** Строки, чьё состояние обратно `all`. */
  except: string[]
  groups?: RowSelectionGroup[]
}

/** Срез выбора строк: выбранные `id` или «всё, кроме». */
export type RowSelectionValue = RowSelectionState | RowSelectionAll

export const isAllSelection = (value: unknown): value is RowSelectionAll =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { all?: unknown }).all === 'boolean' &&
  Array.isArray((value as { except?: unknown }).except)

type Node = RowSelectionAll & { keys?: unknown[] }

const sameKey = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b)

/** `prefix` — начало пути `keys`. */
const startsWith = (keys: readonly unknown[], prefix: readonly unknown[]) =>
  prefix.length <= keys.length &&
  prefix.every((value, level) => sameKey(value, keys[level]))

const keysOf = (node: Node) => node.keys ?? []

/** Ближайший к пути узел дерева: его путь — начало `keys`. */
const nodeOf = (root: Node, keys: readonly unknown[]): Node => {
  let node = root
  for (;;) {
    const child = node.groups?.find(group => startsWith(keys, group.keys))
    if (!child) return node
    node = child
  }
}

/** Состояние флажка группы: выбрана целиком, частично или не выбрана (ADR 0148, §1). */
export const groupSelectionOf = (
  value: RowSelectionAll,
  keys: readonly unknown[],
): 'all' | 'some' | 'none' => {
  const node = nodeOf(value, keys)
  const exact = keysOf(node).length === keys.length
  const differs = exact
    ? node.except.length > 0 || !!node.groups?.length
    : !!node.groups?.some(group => startsWith(group.keys, keys))
  if (differs) return 'some'
  return node.all ? 'all' : 'none'
}

/** Узлы без отличий от родителя убраны; пустой выбор и выбор без групп — прежней формы. */
const normalizeNode = (node: Node, parentAll: boolean): Node | undefined => {
  const groups = node.groups
    ?.map(group => normalizeNode(group, node.all))
    .filter((group): group is Node => !!group) as
    RowSelectionGroup[] | undefined
  if (node.all === parentAll && node.except.length === 0 && !groups?.length) {
    return undefined
  }
  return {
    keys: node.keys,
    all: node.all,
    except: node.except,
    ...(groups?.length ? { groups } : {}),
  }
}

const normalize = (root: Node): RowSelectionValue => {
  const groups = root.groups
    ?.map(group => normalizeNode(group, root.all))
    .filter((group): group is Node => !!group) as
    RowSelectionGroup[] | undefined
  if (!root.all && !groups?.length) {
    return Object.fromEntries(root.except.map(id => [id, true]))
  }
  return {
    all: root.all,
    except: root.except,
    ...(groups?.length ? { groups } : {}),
  }
}

const cloneNode = <T extends Node>(node: T): T => ({
  ...node,
  except: [...node.except],
  ...(node.groups ? { groups: node.groups.map(cloneNode) } : {}),
})

/** Дерево по срезу: выбранные `id` — исключения невыбранного корня. */
const treeOf = (value: RowSelectionValue | undefined): Node =>
  isAllSelection(value)
    ? cloneNode(value)
    : {
        all: false,
        except: Object.keys(value ?? {}).filter(id => value![id]),
      }

/** Выбрать группу целиком (`true`) или снять с неё выбор: узлы внутри неё уходят. */
export const toggleGroupIn = (
  value: RowSelectionValue | undefined,
  keys: readonly unknown[],
  selected: boolean,
): RowSelectionValue => {
  const root = treeOf(value)
  const node = nodeOf(root, keys)
  if (keysOf(node).length === keys.length && node !== root) {
    node.all = selected
    node.except = []
    delete node.groups
  } else {
    node.groups = [
      ...(node.groups ?? []).filter(group => !startsWith(group.keys, keys)),
      { keys: [...keys], all: selected, except: [] },
    ]
  }
  return normalize(root)
}

/**
 * Выбрать строку данных или снять с неё выбор: исключение — в узле её группы, чтобы флажок
 * группы видел его (ADR 0148, §2).
 */
export const toggleRowIn = (
  value: RowSelectionValue | undefined,
  keys: readonly unknown[],
  id: string,
  selected: boolean,
): RowSelectionValue => {
  const root = treeOf(value)
  let node: Node = root
  for (;;) {
    node.except = node.except.filter(each => each !== id)
    const child = node.groups?.find(group => startsWith(keys, group.keys))
    if (!child) break
    node = child
  }
  if (keysOf(node).length < keys.length) {
    const leaf: RowSelectionGroup = {
      keys: [...keys],
      all: node.all,
      except: [],
    }
    node.groups = [...(node.groups ?? []), leaf]
    node = leaf
  }
  if (selected !== node.all) node.except.push(id)
  return normalize(root)
}

/**
 * Строк выбрано по дереву; `size(keys)` — строк данных в группе пути (у корня — пусто),
 * `undefined` — неизвестно. Неизвестен размер нужного узла — `undefined` (ADR 0148, §3).
 */
export const countSelectionIn = (
  value: RowSelectionAll,
  size: (keys: readonly unknown[]) => number | undefined,
): number | undefined => {
  const count = (node: Node): number | undefined => {
    const own = node.all ? size(keysOf(node)) : 0
    if (own === undefined) return undefined
    let selected = node.all ? own - node.except.length : node.except.length
    for (const group of node.groups ?? []) {
      const inner = count(group)
      if (inner === undefined) return undefined
      if (node.all) {
        const whole = size(group.keys)
        if (whole === undefined) return undefined
        selected += inner - whole
      } else selected += inner
    }
    return Math.max(0, selected)
  }
  return count(value)
}

/**
 * Выбор без размеров групп: отдельно выбранные строки и группы, выбранные целиком, — или
 * исключения выбранной выборки (строки и снятые группы).
 */
export const selectionPartsOf = (value: RowSelectionAll) => {
  let rows = 0
  let groups = 0
  let excluded = 0
  const walk = (node: Node, parentAll: boolean) => {
    if (node !== value && node.all !== parentAll) {
      if (node.all) groups++
      else excluded++
    }
    if (node.all) excluded += node.except.length
    else rows += node.except.length
    for (const group of node.groups ?? []) walk(group, node.all)
  }
  walk(value, value.all)
  return { rows, groups, excluded }
}

const effective = new WeakMap<
  RowSelectionAll,
  { proxy: RowSelectionState; holder: SelectionContext }
>()
const sourceOf = new WeakMap<object, RowSelectionAll>()

interface SelectionContext {
  /** Выбираемая строка данных (в дереве SSRM — только корни, ADR 0138, §14). */
  test?: (id: string) => boolean
  /** Строка-группа, в которой строка данных; без группировки — нет. */
  groupOf?: (id: string) => string | undefined
}

/**
 * Эффективное значение «всё, кроме» для TanStack: строка данных выбрана по ближайшему узлу
 * пути её групп, если она выбираема; строка-группа — если выбрана целиком. Ключей у объекта
 * нет — перечислить весь итог нельзя; один объект на значение среза.
 */
export const effectiveSelectionOf = (
  value: RowSelectionAll,
  eligible?: (id: string) => boolean,
  groupOfRow?: (id: string) => string | undefined,
): RowSelectionState => {
  const cached = effective.get(value)
  if (cached) {
    if (eligible) cached.holder.test = eligible
    if (groupOfRow) cached.holder.groupOf = groupOfRow
    return cached.proxy
  }
  const holder: SelectionContext = { test: eligible, groupOf: groupOfRow }
  // Узел и состояние — один раз на группу и значение среза: строк много, групп мало.
  const nodes = new Map<string, Node>()
  const nodeOfGroup = (groupId = '') => {
    let node = nodes.get(groupId)
    if (!node) {
      node = nodeOf(value, groupKeysOf(groupId))
      nodes.set(groupId, node)
    }
    return node
  }
  const groupsSelected = new Map<string, boolean>()
  const selected = (key: string | symbol) => {
    if (typeof key !== 'string') return false
    if (key.startsWith(GROUP_ROW_PREFIX)) {
      let all = groupsSelected.get(key)
      if (all === undefined) {
        all = groupSelectionOf(value, groupKeysOf(key)) === 'all'
        groupsSelected.set(key, all)
      }
      return all
    }
    if (!(holder.test?.(key) ?? true)) return false
    const node = nodeOfGroup(holder.groupOf?.(key))
    return node.all !== node.except.includes(key)
  }
  const proxy = new Proxy({} as RowSelectionState, {
    get: (_, key) => (selected(key) ? true : undefined),
    has: (_, key) => selected(key),
    getOwnPropertyDescriptor: (_, key) =>
      selected(key)
        ? {
            value: true,
            writable: false,
            enumerable: false,
            configurable: true,
          }
        : undefined,
    ownKeys: () => [],
  })
  effective.set(value, { proxy, holder })
  sourceOf.set(proxy, value)
  return proxy
}

/** Сохранённое «всё, кроме» за эффективным значением среза; иначе `undefined`. */
export const allSelectionOf = (
  selection: unknown,
): RowSelectionAll | undefined =>
  typeof selection === 'object' && selection !== null
    ? sourceOf.get(selection)
    : undefined

type SelectionTable = {
  atoms?: { rowSelection?: { get: () => unknown } }
  setRowSelection?: (
    updater: (previous: RowSelectionValue) => RowSelectionValue,
  ) => void
}

/** «Всё, кроме» текущего среза таблицы; иначе `undefined`. */
export const tableAllSelection = (table: unknown) =>
  allSelectionOf((table as SelectionTable).atoms?.rowSelection?.get())

/** Срез выбора, как его видит приложение: `{ all, except, groups? }` или выбранные `id`. */
export const rowSelectionValueOf = (table: unknown): RowSelectionValue => {
  const selection = (table as SelectionTable).atoms?.rowSelection?.get()
  return allSelectionOf(selection) ?? ((selection ?? {}) as RowSelectionState)
}

/** Ничего не выбрано. */
export const isSelectionEmpty = (value: RowSelectionValue) =>
  !isAllSelection(value) && !Object.values(value).some(Boolean)

/** Задать срез выбора целиком (сброс и откат при смене группировки, ADR 0148, §4). */
export const setRowSelectionValue = (
  table: unknown,
  value: RowSelectionValue,
) => (table as SelectionTable).setRowSelection?.(() => value)

/**
 * Выбрать строку или снять с неё выбор деревом: в режиме «всё, кроме» и при серверной
 * группировке; `keys` — путь групп строки.
 */
export const setAllSelectionRow = (
  table: unknown,
  rowId: string,
  selected: boolean,
  keys: readonly unknown[] = [],
) =>
  (table as SelectionTable).setRowSelection?.(previous =>
    toggleRowIn(previous, keys, rowId, selected),
  )

/** Выбрать группу целиком или снять с неё выбор (ADR 0148). */
export const setGroupSelected = (
  table: unknown,
  keys: readonly unknown[],
  selected: boolean,
) =>
  (table as SelectionTable).setRowSelection?.(previous =>
    toggleGroupIn(previous, keys, selected),
  )

/** Выбрать весь список (`true`) или снять весь выбор (`false`). */
export const setAllRowsSelected = (table: unknown, selected: boolean) =>
  (table as SelectionTable).setRowSelection?.((): RowSelectionValue =>
    selected ? { all: true, except: [] } : {},
  )
