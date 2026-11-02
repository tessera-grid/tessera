/** Причина отказа «сервера» гайдов сохранения. */
export const REFUSAL = 'The server refused the value'

interface Waiting {
  resolve: () => void
  reject: (reason: Error) => void
}

/**
 * «Сервер» гайда: придерживает ответ, пока шаг ожидания на виду; `answer` отвечает
 * ждущим и следующим — успехом или отказом с причиной `REFUSAL`.
 */
export const createHeldServer = () => {
  let held = true
  let refuse = false
  const waiting = new Set<Waiting>()
  const answer = (entry: Waiting) =>
    refuse ? entry.reject(new Error(REFUSAL)) : entry.resolve()
  return {
    hold: () => {
      held = true
    },
    answer: (ok: boolean) => {
      held = false
      refuse = !ok
      waiting.forEach(answer)
      waiting.clear()
    },
    save: () =>
      new Promise<void>((resolve, reject) => {
        const entry = { resolve, reject }
        if (held) waiting.add(entry)
        else answer(entry)
      }),
  }
}
