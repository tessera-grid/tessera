/**
 * Действия гайдов фильтра колонок (ADR 0045, ADR 0047, ADR 0172): панель, условие,
 * календарь. Общие у историй Filtering и Data types.
 */
import {
  byTestId,
  headCell,
  pollUntil,
  pressEscape,
  repeat,
} from './catalogPlay'

export const panel = () => byTestId('filter-panel')

/** Пользователь закрывает открытую панель. */
export const closePanel = (signal: AbortSignal) =>
  repeat(() => !panel(), pressEscape, signal)

/** Пользователь открывает панель фильтра колонки нажатием на её кнопку. */
export const openPanel = async (
  root: HTMLElement,
  column: string,
  signal: AbortSignal,
) => {
  await closePanel(signal)
  await repeat(
    () => !!panel(),
    () =>
      headCell(root, column)
        ?.querySelector<HTMLElement>('.column-filter__button')
        ?.click(),
    signal,
  )
}

/** Кнопка фильтра колонки отмечена как включённая. */
export const filterActive = (root: HTMLElement, column: string) =>
  !!headCell(root, column)?.querySelector(
    '.column-filter__button[data-active="true"]',
  )
export const filteredCount = () =>
  byTestId('filtered-rows-count')?.textContent ?? ''

/** Выбранное условие панели — значение скрытого поля списка условий. */
export const operatorValue = () =>
  panel()?.querySelector<HTMLInputElement>('input[aria-hidden="true"]')?.value
/** Пользователь выбирает условие панели: открывает список и нажимает пункт. */
export const chooseOperator = (operator: string, signal: AbortSignal) =>
  repeat(
    () =>
      operatorValue() === operator &&
      byTestId('filter-operator')?.getAttribute('aria-expanded') === 'false',
    () => {
      const trigger = byTestId('filter-operator')
      if (trigger?.getAttribute('aria-expanded') !== 'true') trigger?.click()
      else
        document
          .querySelector<HTMLElement>(`[data-operator="${operator}"]`)
          ?.click()
    },
    signal,
  )

export const calendar = () => byTestId('filter-calendar')

/** Пользователь выбирает в календаре год, месяц (номер с нуля) и день. */
export const pickDay = async (
  year: string,
  month: number,
  day: string,
  signal: AbortSignal,
) => {
  await pollUntil(() => !!calendar()?.querySelector('select'), signal)
  const change = (select: HTMLSelectElement, value: string) => {
    if (select.value === value) return
    Object.getOwnPropertyDescriptor(
      HTMLSelectElement.prototype,
      'value',
    )!.set!.call(select, value)
    select.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const selects = () =>
    calendar()!.querySelectorAll<HTMLSelectElement>('select')
  // Календарь перерисовывается и после смены условия — выбор повторяется, пока не виден день.
  await repeat(
    () => !!document.querySelector(`[data-day="${day}"] button`),
    () => {
      change(selects()[1]!, year)
      change(selects()[0]!, String(month))
    },
    signal,
  )
  document.querySelector<HTMLElement>(`[data-day="${day}"] button`)!.click()
}
