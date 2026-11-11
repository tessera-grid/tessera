import styles from './BodyCell.module.css'

/** Класс стороны закрепления ячейки тела: по нему стиль неприлипшего блока (ADR 0213). */
export const pinnedCellClass = (start: boolean, end: boolean) =>
  start
    ? styles['body__cell--pinned-left']
    : end
      ? styles['body__cell--pinned-right']
      : undefined
