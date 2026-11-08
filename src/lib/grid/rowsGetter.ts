/**
 * Список строк для пропсов — геттером, один на массив (ADR 0199, MS12): dev-сборка React 19
 * сравнивает пропсы перерисованной компоненты и обошла бы массив строк, а функцию сравнивает
 * по ссылке. Новый список — новый геттер.
 */
const getters = new WeakMap<object, () => unknown>()

const noRows = () => undefined

export const rowsGetterOf = <T extends object | undefined>(
  rows: T,
): (() => T) => {
  if (rows === undefined) return noRows as () => T
  let getter = getters.get(rows)
  if (!getter) {
    getter = () => rows
    getters.set(rows, getter)
  }
  return getter as () => T
}
