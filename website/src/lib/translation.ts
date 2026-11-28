// Состояние перевода пары страниц (ADR 0113 §2, DC3) по `revision` во frontmatter.

/** Префикс русской локали в id страниц. */
export const RU_PREFIX = 'ru/'

/**
 * `current` — перевод свеж, `outdated` — английскую правили по существу после перевода,
 * `ahead` — правили только перевод: проверка падает.
 */
export type TranslationStatus = 'current' | 'outdated' | 'ahead'

export const translationStatus = (
  enRevision = 1,
  ruRevision = 1,
): TranslationStatus =>
  ruRevision === enRevision
    ? 'current'
    : ruRevision < enRevision
      ? 'outdated'
      : 'ahead'

/** Id английской пары русской страницы. */
export const englishIdOf = (ruId: string) => ruId.slice(RU_PREFIX.length)
