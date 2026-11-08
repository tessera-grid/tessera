/**
 * Ссылка таблицы для приложения и грида (ADR 0196, §2): новая — только на смену входов
 * отрисовки; поля и методы ядра читаются через прототип живыми.
 */

const ids = new WeakMap<object, number>()
let lastId = 0

const keyOf = (value: unknown): string => {
  if (
    (typeof value === 'object' && value !== null) ||
    typeof value === 'function'
  ) {
    let id = ids.get(value)
    if (id === undefined) {
      id = ++lastId
      ids.set(value, id)
    }
    return `#${id}`
  }
  return typeof value === 'string' ? JSON.stringify(value) : String(value)
}

/** Ключ входов отрисовки: объекты — по ссылке, прочие значения — по значению. */
export const renderKeyOf = (values: readonly unknown[]): string =>
  values.map(keyOf).join('|')

/** Вид таблицы поверх экземпляра ядра: свои поля — от ядра, своей записи нет. */
export const tableViewOf = <T extends object>(core: T): T =>
  Object.create(core) as T
