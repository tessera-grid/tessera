import type { ValueChangeFlashColumnDef } from './valueChangeFlashFeature'

/** Слайс плагина valueChangeFlash в `table.getHooks()` (ADR 0221, §2). */
export interface ValueChangeFlashHooks {
  /** Вид колонок без своего `changeFlash`. */
  columnDefault: NonNullable<ValueChangeFlashColumnDef['changeFlash']>
}
