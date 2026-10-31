/** Тема грида (ADR 0090): по предку с `.dark`, всегда светлая или всегда тёмная. */
export type ColorMode = 'auto' | 'light' | 'dark'

/** Повышенный контраст (ADR 0088): по системе, всегда или никогда. */
export type ContrastMode = 'auto' | 'more' | 'standard'

/**
 * Стабильный класс обёртки грида, на котором объявлены дефолты токенов
 * (`theme.css`, слой `:where(.data-grid-theme)`). Публичный якорь темы: по нему
 * потребитель переопределяет `--tsr-comp-*` обычным CSS-правилом.
 */
export const DATA_GRID_THEME_CLASS = 'data-grid-theme'
