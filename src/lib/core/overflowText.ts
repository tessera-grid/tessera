/**
 * Обрезанный текст ячейки (ADR 0075; ADR 0231, §6): где он, обрезан ли, и событие «показать
 * полностью», которое пункт контекстного меню шлёт тексту, а подсказка грида ловит.
 */

/** Текст ячейки; значение строки группы обрезается отдельно от числа строк (ADR 0184, §8). */
export const OVERFLOW_TITLE =
  '[data-group-value], .data-grid__cell-wrapper-title'

/** Событие на тексте ячейки: показать его подсказку сразу. */
export const SHOW_FULL_TEXT_EVENT = 'tsr-show-full-text'

/**
 * Текст не помещается в свой контейнер и обрезан многоточием; перенесённый текст — по высоте:
 * строки сверх видимых (ADR 0218, AH2).
 */
export const isTruncated = (element: HTMLElement) =>
  element.scrollWidth > element.clientWidth ||
  (!!element.closest('[data-text-wrap]') &&
    element.scrollHeight > element.clientHeight + 1)

/** Обрезанный текст ячейки или `null`. */
export const truncatedTitleIn = (cell: Element): HTMLElement | null => {
  const title = cell.querySelector<HTMLElement>(OVERFLOW_TITLE)
  return title?.textContent?.trim() && isTruncated(title) ? title : null
}
