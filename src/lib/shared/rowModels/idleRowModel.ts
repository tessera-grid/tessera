/**
 * Холостой проход модели строк (ADR 0068): когда модели нечего делать второй проход
 * подряд, она отдаёт модель на входе без обхода строк — строки уже в нужном виде.
 * Первый холостой проход после активного и активные — модель TanStack. `startIdle` —
 * строки ещё не видели активного прохода: первый холостой проход тоже без обхода (§1а).
 */
export const skipIdlePasses = <TModel>(
  rowModel: () => TModel,
  input: () => TModel,
  isIdle: () => boolean,
  autoReset: () => void,
  startIdle?: () => boolean,
): (() => TModel) => {
  let lastIdle = false
  let lastInput: TModel | undefined
  let first = true
  return () => {
    const idle = isIdle()
    if (first) {
      first = false
      if (idle && startIdle?.()) {
        lastIdle = true
        lastInput = input()
        return lastInput
      }
    }
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
