/**
 * Пауза над свёрнутой группой (ADR 0109, §1): таймер на одну группу. Та же группа не
 * перезапускает его, другая или её отсутствие — сбрасывают.
 */
export interface ExpandTimer {
  /** Ждать `delay` мс над группой `key`, затем `fire`. */
  arm: (key: string, delay: number, fire: () => void) => void
  clear: () => void
}

export const createExpandTimer = (): ExpandTimer => {
  let armed: { key: string; id: ReturnType<typeof setTimeout> } | undefined
  const clear = () => {
    if (armed) clearTimeout(armed.id)
    armed = undefined
  }
  return {
    arm: (key, delay, fire) => {
      if (armed?.key === key) return
      clear()
      armed = {
        key,
        id: setTimeout(() => {
          armed = undefined
          fire()
        }, delay),
      }
    },
    clear,
  }
}
