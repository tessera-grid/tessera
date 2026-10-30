/**
 * Выбор «всё, кроме» серверной модели строк (ADR 0138, §9) и дерево выбора групп (ADR 0148)
 * и веток (ADR 0162): срез `rowSelection` хранит `{ all, except, groups?, branches? }`, а
 * TanStack получает эффективное значение — объект, где строка выбрана по ближайшему узлу пути
 * её групп или предков, в том числе строки блоков, которые придут позже.
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
 * Узел ветки дерева в дереве выбора (ADR 0162, §2): узлы вложены по дереву строк — узел ветки
 * стоит внутри узла её родителя.
 */
export interface RowSelectionBranch {
  /** Строка-родитель ветки. */
  id: string
  /** Ветка выбрана целиком, кроме `except` и узлов `branches` внутри неё. */
  all: boolean
  /** Вложенные строки ветки, чьё состояние обратно `all`. */
  except: string[]
  branches?: RowSelectionBranch[]
}

/**
 * Выбор без перечисления строк: выбрана вся выборка (`all`), кроме `except`, или не выбрана,
 * кроме `except`; узлы `groups` — группы, чьё состояние отличается от родителя (ADR 0148);
 * узлы `branches` — ветки дерева (ADR 0162). Узлы групп и веток вместе не встречаются.
 */
export interface RowSelectionAll {
  all: boolean
  /** Строки, чьё состояние обратно `all`. */
  except: string[]
  groups?: RowSelectionGroup[]
  branches?: RowSelectionBranch[]
}

/** Срез выбора строк: выбранные `id` или «всё, кроме». */
export type RowSelectionValue = RowSelectionState | RowSelectionAll

export const isAllSelection = (value: unknown): value is RowSelectionAll =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { all?: unknown }).all === 'boolean' &&
  Array.isArray((value as { except?: unknown }).except)

type Node = RowSelectionAll & { keys?: unknown[]; id?: string }

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

/** Подузлы групп и веток без отличий от узла убраны. */
const normalizeChildren = (node: Node) => {
  const kept = (children: Node[] | undefined) =>
    children
      ?.map(child => normalizeNode(child, node.all))
      .filter((child): child is Node => !!child)
  return {
    groups: kept(node.groups) as RowSelectionGroup[] | undefined,
    branches: kept(node.branches) as RowSelectionBranch[] | undefined,
  }
}

/** Узлы без отличий от родителя убраны; пустой выбор и выбор без узлов — прежней формы. */
const normalizeNode = (node: Node, parentAll: boolean): Node | undefined => {
  const { groups, branches } = normalizeChildren(node)
  if (
    node.all === parentAll &&
    node.except.length === 0 &&
    !groups?.length &&
    !branches?.length
  ) {
    return undefined
  }
  return {
    ...(node.keys ? { keys: node.keys } : {}),
    ...(node.id !== undefined ? { id: node.id } : {}),
    all: node.all,
    except: node.except,
    ...(groups?.length ? { groups } : {}),
    ...(branches?.length ? { branches } : {}),
  }
}

const normalize = (root: Node): RowSelectionValue => {
  const { groups, branches } = normalizeChildren(root)
  if (!root.all && !groups?.length && !branches?.length) {
    return Object.fromEntries(root.except.map(id => [id, true]))
  }
  return {
    all: root.all,
    except: root.except,
    ...(groups?.length ? { groups } : {}),
    ...(branches?.length ? { branches } : {}),
  }
}

const cloneNode = <T extends Node>(node: T): T => ({
  ...node,
  except: [...node.except],
  ...(node.groups ? { groups: node.groups.map(cloneNode) } : {}),
  ...(node.branches ? { branches: node.branches.map(cloneNode) } : {}),
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

// --- Ветки дерева (ADR 0162) ---------------------------------------------------------

/** Ближайший к пути узел ветки (`path` — id предков строки от корня) и сколько пути пройдено. */
const branchWalk = (root: Node, path: readonly string[]) => {
  let node = root
  let depth = 0
  for (const id of path) {
    const child = node.branches?.find(branch => branch.id === id)
    if (!child) break
    node = child
    depth++
  }
  return { node, depth }
}

/** Строка выбрана по ближайшему узлу пути её предков. */
export const rowSelectedIn = (
  value: RowSelectionAll,
  path: readonly string[],
  id: string,
) => {
  const { node } = branchWalk(value, path)
  return node.all !== node.except.includes(id)
}

/**
 * Флажок строки-родителя при каскаде (ADR 0162, §2): строка и её ветка выбраны целиком,
 * частично или не выбраны.
 */
export const branchSelectionOf = (
  value: RowSelectionAll,
  path: readonly string[],
  id: string,
): 'all' | 'some' | 'none' => {
  const own = rowSelectedIn(value, path, id)
  const { node, depth } = branchWalk(value, path)
  const branch =
    depth === path.length
      ? node.branches?.find(each => each.id === id)
      : undefined
  if (
    branch &&
    (branch.all !== own ||
      branch.except.length > 0 ||
      !!branch.branches?.length)
  ) {
    return 'some'
  }
  return own ? 'all' : 'none'
}

/** Строка уходит из исключений узлов пути. */
const dropFromPath = (root: Node, path: readonly string[], id: string) => {
  let node: Node | undefined = root
  node.except = node.except.filter(each => each !== id)
  for (const parent of path) {
    node = node.branches?.find(branch => branch.id === parent)
    if (!node) return
    node.except = node.except.filter(each => each !== id)
  }
}

/** Узел ветки родителя по пути; недостающие узлы заводятся с состоянием своего родителя. */
const branchNodeAt = (root: Node, path: readonly string[]) => {
  let node = root
  for (const parent of path) {
    let child: Node | undefined = node.branches?.find(
      branch => branch.id === parent,
    )
    if (!child) {
      child = { id: parent, all: node.all, except: [] }
      node.branches = [...(node.branches ?? []), child as RowSelectionBranch]
    }
    node = child
  }
  return node
}

/**
 * Выбрать строку дерева или снять с неё выбор (ADR 0162): исключение — в узле её родителя,
 * при каскаде (`cascade`) ветка строки встаёт в то же состояние целиком.
 */
export const toggleBranchRowIn = (
  value: RowSelectionValue | undefined,
  path: readonly string[],
  id: string,
  selected: boolean,
  cascade: boolean,
): RowSelectionValue => {
  const root = treeOf(value)
  dropFromPath(root, path, id)
  const node = branchNodeAt(root, path)
  if (selected !== node.all) node.except.push(id)
  if (cascade) {
    node.branches = [
      ...(node.branches ?? []).filter(branch => branch.id !== id),
      { id, all: selected, except: [] },
    ]
  }
  return normalize(root)
}

/**
 * Строка дерева переехала из ветки с путём `from` в ветку с путём `to`: её выбор и выбор её
 * ветки — прежние (ADR 0162, §4). Без узлов веток выбор от места строки не зависит.
 */
export const moveRowIn = (
  value: RowSelectionValue,
  id: string,
  from: readonly string[],
  to: readonly string[],
): RowSelectionValue => {
  if (!isAllSelection(value) || !value.branches?.length) return value
  const selected = rowSelectedIn(value, from, id)
  const root = treeOf(value)
  const { node, depth } = branchWalk(root, from)
  let branch =
    depth === from.length
      ? (node.branches?.find(each => each.id === id) as Node | undefined)
      : undefined
  if (branch) node.branches = node.branches!.filter(each => each !== branch)
  else branch = { id, all: node.all, except: [] }
  dropFromPath(root, from, id)
  const target = branchNodeAt(root, to)
  if (selected !== target.all) target.except.push(id)
  target.branches = [
    ...(target.branches ?? []).filter(each => each.id !== id),
    branch as RowSelectionBranch,
  ]
  return normalize(root)
}

/**
 * Строк выбрано по дереву; `size(keys)` — строк данных в группе пути (у корня — пусто),
 * `branchSize(id)` — вложенных строк ветки на всех уровнях; `undefined` — неизвестно.
 * Неизвестен размер нужного узла — `undefined` (ADR 0148, §3; ADR 0162, §4).
 */
export const countSelectionIn = (
  value: RowSelectionAll,
  size: (keys: readonly unknown[]) => number | undefined,
  branchSize?: (id: string) => number | undefined,
): number | undefined => {
  const sizeOf = (node: Node) =>
    node.id !== undefined ? branchSize?.(node.id) : size(keysOf(node))
  const count = (node: Node): number | undefined => {
    const own = node.all ? sizeOf(node) : 0
    if (own === undefined) return undefined
    let selected = node.all ? own - node.except.length : node.except.length
    for (const child of [...(node.groups ?? []), ...(node.branches ?? [])]) {
      const inner = count(child)
      if (inner === undefined) return undefined
      if (node.all) {
        const whole = sizeOf(child)
        if (whole === undefined) return undefined
        selected += inner - whole
      } else selected += inner
    }
    return Math.max(0, selected)
  }
  return count(value)
}

/**
 * Выбор без размеров узлов: отдельно выбранные строки и группы или ветки, выбранные
 * целиком, — или исключения выбранной выборки (строки и снятые группы или ветки).
 */
export const selectionPartsOf = (value: RowSelectionAll) => {
  let rows = 0
  let groups = 0
  let branches = 0
  let excluded = 0
  const walk = (node: Node, parentAll: boolean) => {
    if (node !== value && node.all !== parentAll) {
      if (!node.all) excluded++
      else if (node.id !== undefined) branches++
      else groups++
    }
    if (node.all) excluded += node.except.length
    else rows += node.except.length
    for (const child of [...(node.groups ?? []), ...(node.branches ?? [])])
      walk(child, node.all)
  }
  walk(value, value.all)
  return { rows, groups, branches, excluded }
}

const effective = new WeakMap<
  RowSelectionAll,
  { proxy: RowSelectionState; holder: SelectionContext }
>()
const sourceOf = new WeakMap<object, RowSelectionAll>()

interface SelectionContext {
  /** Выбираемая строка данных (в дереве SSRM без `subRows` — только корни, ADR 0138, §14). */
  test?: (id: string) => boolean
  /** Строка-группа, в которой строка данных; без группировки — нет. */
  groupOf?: (id: string) => string | undefined
  /** `id` предков строки дерева от корня (ADR 0162). */
  pathOf?: (id: string) => readonly string[]
}

/**
 * Эффективное значение «всё, кроме» для TanStack: строка данных выбрана по ближайшему узлу
 * пути её групп или веток, если она выбираема; строка-группа — если выбрана целиком. Ключей
 * у объекта нет — перечислить весь итог нельзя; один объект на значение среза.
 */
export const effectiveSelectionOf = (
  value: RowSelectionAll,
  eligible?: (id: string) => boolean,
  groupOfRow?: (id: string) => string | undefined,
  pathOfRow?: (id: string) => readonly string[],
): RowSelectionState => {
  const cached = effective.get(value)
  if (cached) {
    if (eligible) cached.holder.test = eligible
    if (groupOfRow) cached.holder.groupOf = groupOfRow
    if (pathOfRow) cached.holder.pathOf = pathOfRow
    return cached.proxy
  }
  const holder: SelectionContext = {
    test: eligible,
    groupOf: groupOfRow,
    pathOf: pathOfRow,
  }
  // Узел ветки — один раз на родителя строки и значение среза.
  const branchNodes = new Map<string, Node>()
  const nodeOfParent = (path: readonly string[]) => {
    const key = path.at(-1) ?? ''
    let node = branchNodes.get(key)
    if (!node) {
      node = branchWalk(value, path).node
      branchNodes.set(key, node)
    }
    return node
  }
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
    const node =
      value.branches?.length && holder.pathOf
        ? nodeOfParent(holder.pathOf(key))
        : nodeOfGroup(holder.groupOf?.(key))
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

/**
 * Удалённые строки выпадают из выбора: из выбранных `id` и из исключений каждого узла
 * (ADR 0157, §3). Ничего не выпало — тот же объект.
 */
export const dropRowsIn = (
  value: RowSelectionValue,
  ids: ReadonlySet<string>,
): RowSelectionValue => {
  if (ids.size === 0) return value
  if (!isAllSelection(value)) {
    if (!Object.keys(value).some(id => ids.has(id))) return value
    return Object.fromEntries(
      Object.entries(value).filter(([id]) => !ids.has(id)),
    )
  }
  let dropped = false
  const prune = <T extends Node>(node: T): T => {
    const except = node.except.filter(id => !ids.has(id))
    if (except.length !== node.except.length) dropped = true
    // Узел удалённой строки-родителя уходит вместе с ней (ADR 0162, §4).
    const branches = node.branches?.filter(branch => !ids.has(branch.id))
    if (branches && branches.length !== node.branches!.length) dropped = true
    return {
      ...node,
      except,
      ...(node.groups ? { groups: node.groups.map(prune) } : {}),
      ...(branches ? { branches: branches.map(prune) } : {}),
    }
  }
  const pruned = prune(value as Node)
  return dropped ? normalize(pruned) : value
}

/** Выбрано всё без исключений и узлов групп и веток (ADR 0148, §2; ADR 0162, §2). */
export const isWholeSelection = (value: RowSelectionAll | undefined) =>
  !!value &&
  value.all &&
  value.except.length === 0 &&
  !value.groups?.length &&
  !value.branches?.length

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

/**
 * Выбрать строку дерева серверной модели или снять с неё выбор (ADR 0162): `path` — её
 * предки, `cascade` — с её веткой.
 */
export const setBranchRowSelected = (
  table: unknown,
  rowId: string,
  path: readonly string[],
  selected: boolean,
  cascade: boolean,
) =>
  (table as SelectionTable).setRowSelection?.(previous =>
    toggleBranchRowIn(previous, path, rowId, selected, cascade),
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
