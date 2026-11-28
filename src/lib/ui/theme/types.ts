/** Grid theme (ADR 0090): from an ancestor with `.dark`, always light, or always dark. */
export type ColorMode = 'auto' | 'light' | 'dark'

/** Increased contrast (ADR 0088): by system setting, always, or never. */
export type ContrastMode = 'auto' | 'more' | 'standard'

/**
 * Stable class of the grid wrapper where token defaults are declared (`theme.css`, the
 * `:where(.data-grid-theme)` layer). The public theme anchor: consumers override `--tsr-comp-*`
 * with a regular CSS rule on it.
 */
export const DATA_GRID_THEME_CLASS = 'data-grid-theme'
