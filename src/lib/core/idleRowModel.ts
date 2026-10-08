/**
 * Холостой проход модели строк (ADR 0068): когда модели нечего делать второй проход
 * подряд, она отдаёт модель на входе без обхода строк — строки уже в нужном виде.
 * Первый холостой проход после активного и активные — модель TanStack.
 */
export const skipIdlePasses = <TModel>(
  rowModel: () => TModel,
  input: () => TModel,
  isIdle: () => boolean,
  autoReset: () => void,
): (() => TModel) => {
  let lastIdle = false
  let lastInput: TModel | undefined
  return () => {
    const idle = isIdle()
    if (idle && lastIdle) {
      const next = input()
      if (next !== lastInput) {
        lastInput = next
        autoReset()
      }
      return next
    }
    lastIdle = idle
    const model = rowModel()
    lastInput = input()
    return model
  }
}
