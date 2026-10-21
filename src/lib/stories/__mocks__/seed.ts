import type { TesseraFeatureEntry } from '../../core/features'

/**
 * Плагин-«семя» истории (ADR 0117, §6): `apply` ставит состояние один раз, как только
 * появились строки — история подаёт данные эффектом.
 */
export const seed = <T>(
  id: string,
  apply: (table: T) => void,
): TesseraFeatureEntry => ({
  id,
  setup: table => {
    const rows = () =>
      (
        table as { getCoreRowModel: () => { rows: unknown[] } }
      ).getCoreRowModel().rows.length
    let frame = 0
    const run = () => {
      if (rows() === 0) {
        frame = requestAnimationFrame(run)
        return
      }
      apply(table as T)
    }
    run()
    return () => cancelAnimationFrame(frame)
  },
})
