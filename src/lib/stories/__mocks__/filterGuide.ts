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

const filterButton = (root: HTMLElement, column: string) =>
  headCell(root, column)?.querySelector<HTMLElement>('.column-filter__button')

/**
 * Пользователь открывает панель фильтра колонки нажатием на её кнопку. Панель этой
 * колонки уже открыта — остаётся: человек не закрывает её, чтобы открыть снова.
 */
export const openPanel = async (
  root: HTMLElement,
  column: string,
  signal: AbortSignal,
) => {
  const own = () =>
    !!panel() &&
    filterButton(root, column)?.getAttribute('aria-expanded') === 'true'
  if (own()) return
  await closePanel(signal)
  await repeat(own, () => filterButton(root, column)?.click(), signal)
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
  // Месяц и год — списки кита (ADR 0183, PK19): кнопка открывает список, пункт выбирает.
  const lists = () =>
    calendar()?.querySelectorAll<HTMLElement>('[role="combobox"]') ?? []
  // Закрытый список Base UI держит пункты в DOM — берём только пункты открытого.
  const options = () => [
    ...document.querySelectorAll<HTMLElement>('[data-open] [role="option"]'),
  ]
  const choose = async (
    list: () => HTMLElement | undefined,
    pick: (all: HTMLElement[]) => HTMLElement | undefined,
  ) => {
    list()?.click()
    await pollUntil(() => !!pick(options()), signal)
    pick(options())!.click()
    await pollUntil(
      () => list()?.getAttribute('aria-expanded') !== 'true',
      signal,
    )
  }
  await pollUntil(() => lists().length === 2, signal)
  const dayButton = () =>
    document.querySelector<HTMLElement>(`[data-day="${day}"] button`)
  // Календарь перерисовывается и после смены условия — выбор повторяется, пока не виден день.
  while (!dayButton()) {
    if (lists()[1]?.textContent?.trim() !== year) {
      await choose(
        () => lists()[1],
        all => all.find(option => option.textContent?.trim() === year),
      )
      continue
    }
    await choose(
      () => lists()[0],
      all => all[month],
    )
    await pollUntil(() => lists().length === 2, signal)
  }
  dayButton()!.click()
}

export const optionOf = (value: string) =>
  document.querySelector<HTMLElement>(
    `[data-testid="filter-panel"] [data-option-index][data-value="${value}"]`,
  )
export const optionChecked = (value: string) =>
  optionOf(value)
    ?.querySelector('[role="checkbox"]')
    ?.getAttribute('aria-checked') === 'true'
/** Пользователь отмечает вариант, пока он не отмечен. */
export const checkOption = (value: string, signal: AbortSignal) =>
  repeat(
    () => optionChecked(value),
    () =>
      optionOf(value)?.querySelector<HTMLElement>('[role="checkbox"]')?.click(),
    signal,
  )
