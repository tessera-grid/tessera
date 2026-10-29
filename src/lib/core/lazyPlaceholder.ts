/**
 * Скелет-строка ленивых детей (ADR 0155, §3): пока ответ `loadChildren` в пути, у раскрытой
 * строки в модели один ребёнок-заглушка. Это не строка данных: тело рисует её скелетом, её
 * нельзя выбрать, выгрузить и сосчитать. Общий модуль тела, выбора и выгрузки — вне папок
 * плагинов (IV3).
 */
const PLACEHOLDER = Symbol('tessera.lazyChildrenPlaceholder')

const placeholders = new WeakMap<object, Map<string, readonly object[]>>()

/** Дети-заглушки строки таблицы: один и тот же массив, пока ответа нет. */
export const lazyPlaceholdersOf = (
  table: unknown,
  parentId: string,
): readonly object[] => {
  const store = (table as { store: object }).store
  let byParent = placeholders.get(store)
  if (!byParent) {
    byParent = new Map()
    placeholders.set(store, byParent)
  }
  let children = byParent.get(parentId)
  if (!children) {
    children = [Object.freeze({ [PLACEHOLDER]: parentId })]
    byParent.set(parentId, children)
  }
  return children
}

/** Данные строки — заглушка ленивых детей. */
export const isLazyPlaceholder = (original: unknown): boolean =>
  typeof original === 'object' && original !== null && PLACEHOLDER in original

/** Строка модели — заглушка ленивых детей. */
export const isPlaceholderRow = (row: unknown): boolean =>
  isLazyPlaceholder((row as { original?: unknown } | undefined)?.original)
