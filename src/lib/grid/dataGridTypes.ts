import type { StubsOverride } from '../core/stubs'
import type { CSSProperties } from 'react'

import type {
  ExactLabelDictionary,
  LabelDictionary,
} from '../core/localization'
import type { ColorMode, ContrastMode } from '../ui/theme'
import type { TableIcons } from '../ui/icons'
import type { PluginDiagnostic } from '../core/pluginDiagnostics'

/**
 * The table from `useCreateTable` (ADR 0091): typed by shape, without TanStack parameters — a
 * table with specific plugins and data isn't assignable to `Table<any, any>`.
 */
export interface DataGridTable {
  getPluginDiagnostics: () => PluginDiagnostic[]
}

export interface DataGridProps<D extends LabelDictionary = LabelDictionary> {
  /** The table instance returned by useCreateTable. */
  table: DataGridTable
  /**
   * Theme (ADR 0090): 'auto' follows `.dark` on an ancestor, 'light' and 'dark' are fixed.
   * @default 'auto'
   */
  colorMode?: ColorMode
  /**
   * Increased contrast (ADR 0088): 'auto' follows the system setting prefers-contrast: more,
   * 'more' — always, 'standard' — never.
   * @default 'auto'
   */
  contrast?: ContrastMode
  /** Overrides the table's icons. */
  icons?: Partial<TableIcons>
  /**
   * Table labels: a template string with `{name}` or a function; word forms use
   * `<key>_<form>` keys (ADR 0132).
   */
  localization?: ExactLabelDictionary<D>
  /**
   * number — height in px; string — in percent (50%, 100%); auto — a flexbox container with
   * flex: 1.
   */
  height?: number | string | 'auto'
  /** number — max height in px; string — in percent. */
  maxHeight?: number | string
  /**
   * Custom empty-table stubs by reason (ADR 0123): `noData`, `noColumns`, `columnsHidden`,
   * `filtered`, `loadError` and plugin reasons — a node or a function of `{ action, error }`.
   * The grid decides which stub to show.
   */
  stubs?: StubsOverride
  /** Extra CSS class on the grid wrapper (the one with `.data-grid-theme`). */
  className?: string
  /** Inline style of the grid wrapper (per-instance theme token overrides). */
  style?: CSSProperties
}
