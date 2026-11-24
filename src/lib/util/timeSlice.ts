/**
 * Долгая работа кусками (ADR 0146, §4): после `sliceMs` работы — уступить главный поток,
 * чтобы ввод и кадры не ждали её конца.
 */
export const yieldToMain = () =>
  new Promise<void>(resolve => {
    setTimeout(resolve, 0)
  })

/** Отметка куска работы: уступает поток, когда кусок дольше `sliceMs`. */
export const timeSlicer = (sliceMs = 8) => {
  let start = performance.now()
  return async () => {
    if (performance.now() - start < sliceMs) return
    await yieldToMain()
    start = performance.now()
  }
}
