/**
 * Выбор «всё, кроме» серверной модели строк (ADR 0138, §9): срез `rowSelection` хранит
 * `{ all: true, except }`, а TanStack получает эффективное значение — объект, где каждая
 * строка выбрана, кроме исключений, в том числе строки блоков, которые придут позже.
 * Общий модуль выбора строк и выгрузки — вне папок плагинов (IV3).
 */
import type { RowSelectionState } from '@tanstack/react-table'

/** Выбраны все строки списка, кроме перечисленных. */
export interface RowSelectionAll {
  all: true
  except: string[]
}

/** Срез выбора строк: выбранные `id` или «всё, кроме». */
export type RowSelectionValue = RowSelectionState | RowSelectionAll

export const isAllSelection = (value: unknown): value is RowSelectionAll =>
  typeof value === 'object' &&
  value !== null &&
  (value as { all?: unknown }).all === true &&
  Array.isArray((value as { except?: unknown }).except)

const effective = new WeakMap<RowSelectionAll, RowSelectionState>()
const sourceOf = new WeakMap<object, RowSelectionAll>()

/**
 * Эффективное значение «всё, кроме» для TanStack: строка выбрана, если её нет в
 * исключениях. Ключей у объекта нет — перечислить весь итог нельзя; один объект на
 * значение среза.
 */
export const effectiveSelectionOf = (
  value: RowSelectionAll,
): RowSelectionState => {
  let proxy = effective.get(value)
  if (!proxy) {
    const except = new Set(value.except)
    const selected = (key: string | symbol) =>
      typeof key === 'string' && !except.has(key)
    proxy = new Proxy({} as RowSelectionState, {
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
    effective.set(value, proxy)
    sourceOf.set(proxy, value)
  }
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

/** Срез выбора, как его видит приложение: `{ all, except }` или выбранные `id`. */
export const rowSelectionValueOf = (table: unknown): RowSelectionValue => {
  const selection = (table as SelectionTable).atoms?.rowSelection?.get()
  return allSelectionOf(selection) ?? ((selection ?? {}) as RowSelectionState)
}

/** Выбрать строку или снять с неё выбор в режиме «всё, кроме»: исключения меняются. */
export const setAllSelectionRow = (
  table: unknown,
  rowId: string,
  selected: boolean,
) =>
  (table as SelectionTable).setRowSelection?.(previous => {
    if (!isAllSelection(previous)) return previous
    const except = previous.except.filter(id => id !== rowId)
    return { all: true, except: selected ? except : [...except, rowId] }
  })

/** Выбрать весь список (`true`) или снять весь выбор (`false`). */
export const setAllRowsSelected = (table: unknown, selected: boolean) =>
  (table as SelectionTable).setRowSelection?.((): RowSelectionValue =>
    selected ? { all: true, except: [] } : {},
  )
