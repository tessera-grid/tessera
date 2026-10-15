/** Положение строки футера (ADR 0118). */
export type FooterPosition = 'pinned' | 'inline'

/** Положение футера таблицы: без опции — у низа области прокрутки. */
export const getFooterPosition = (table: unknown): FooterPosition =>
  (table as { options: { footerPosition?: FooterPosition } }).options
    .footerPosition === 'inline'
    ? 'inline'
    : 'pinned'

/** Футер стоит за последней строкой и прокручивается вместе с телом. */
export const isFooterInline = (table: unknown): boolean =>
  !!(table as { options: { enableFooter?: boolean } }).options.enableFooter &&
  getFooterPosition(table) === 'inline'
