/**
 * Список поповера открывается на выбранном: он посередине, а не у края под затемнением (ADR 0183,
 * PK31). Выбранный — пункт с `selector` внутри списка.
 */
export const centerSelected = (list: HTMLElement | null, selector: string) => {
  const selected = list?.querySelector<HTMLElement>(selector)
  if (!list || !selected) return
  const offset =
    selected.getBoundingClientRect().top - list.getBoundingClientRect().top
  list.scrollTop += offset - (list.clientHeight - selected.offsetHeight) / 2
}
