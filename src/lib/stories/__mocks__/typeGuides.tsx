/** Помощники гайдов разделов «Columns/Data types/<Тип>»: ячейки, правка, сортировка. */
import { type StoryProps } from '../DataGridStory.types'
import { untilDone } from './cellGestures'
import { headCell, orderedRows, repeat } from './catalogPlay'
import { filteredCount, panel } from './filterGuide'
import {
  OPTION_COLUMNS,
  EDIT_COLUMNS,
  EDIT_ROWS,
  EDIT_TYPES,
} from './editingData'
import { productColumns } from './dataTypesData'

export const OWN_TABLE =
  'The section sets rows and columns: one column per type'

// --- Чтение ячеек в `play` ----------------------------------------------------------

export const CELL = '.data-grid__body-cell'
export const cellOf = (root: ParentNode, rowIndex: number, columnId: string) =>
  root.querySelectorAll<HTMLElement>(
    `.data-grid__body-row ${CELL}[data-column-id="${columnId}"]`,
  )[rowIndex]
export const textOf = (root: ParentNode, rowIndex: number, columnId: string) =>
  cellOf(root, rowIndex, columnId)?.textContent?.trim()

// --- Порядок и отбор в `play` и действиях шагов ----------------------------------------

export const rowIds = (root: HTMLElement) =>
  orderedRows(root).map(row => row.dataset.rowId)
export const idsOf = (...indexes: number[]) =>
  indexes.map(index => `product-${index + 1}`)
export const sortButtonOf = (root: HTMLElement, column: string) =>
  headCell(root, column)?.querySelector<HTMLElement>('.column-sort__button') ??
  null
export const sortOf = (root: HTMLElement, column: string) =>
  headCell(root, column)?.getAttribute('aria-sort') ?? 'none'
/** Пользователь нажимает кнопку сортировки колонки, пока порядок не станет нужным. */
export const sortTo = (column: string, direction: 'ascending' | 'descending') =>
  untilDone(
    root => sortOf(root, column) === direction,
    root => sortButtonOf(root, column)?.click(),
  )
export const columnsOf = (priceType: string, ids: readonly string[]) =>
  productColumns(priceType).filter(column => ids.includes(column.id!))
export const moneyIn = (locale: string, value: number) =>
  new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(
    value,
  )

/** Набрать значение в поле — как ввод с клавиатуры. */
export const typeInto = (input: HTMLInputElement, value: string) => {
  Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )!.set!.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

export const press = (input: HTMLElement, key: string) =>
  input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))

/**
 * Набрать время `HH:mm` в поле времени кита (ADR 0183, PK20) — цифрами по сегментам, как с
 * клавиатуры; у 12-часового формата — ещё половина суток.
 */
export const typeTime = (field: HTMLElement, value: string) => {
  const [hours, minutes] = value.split(':').map(Number) as [number, number]
  const segment = (name: string) =>
    field.querySelector<HTMLElement>(`[data-segment="${name}"]`)
  const period = segment('period')
  const shown = period ? hours % 12 || 12 : hours
  for (const digit of String(shown).padStart(2, '0'))
    press(segment('hours')!, digit)
  for (const digit of String(minutes).padStart(2, '0'))
    press(segment('minutes')!, digit)
  if (period) press(period, hours >= 12 ? 'p' : 'a')
}

/** Значение поля времени кита: `HH:mm` или пустая строка. */
export const timeValue = (field: HTMLElement) =>
  field.getAttribute('data-value') ?? ''

// --- ADR 0175: редакторы по типу -----------------------------------------------------

export const PRODUCT_ROW = 'product-1'

export const productCellOf = (root: ParentNode, column: string) =>
  root.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${PRODUCT_ROW}"] .data-grid__body-cell[data-column-id="${column}"]`,
  )
export const productInput = (root: ParentNode, column: string) =>
  // Поле правки, а не скрытое поле формы у флажка Base UI.
  productCellOf(root, column)?.querySelector<HTMLInputElement>(
    'input:not([aria-hidden="true"])',
  ) ?? null
export const productEditButton = (root: ParentNode, column: string) =>
  productCellOf(root, column)?.querySelector<HTMLElement>(
    '.cell__button button',
  ) ?? null
/** Значение ячейки без кнопки правки. */
export const productText = (root: ParentNode, column: string) => {
  const copy = productCellOf(root, column)?.cloneNode(true) as
    HTMLElement | undefined
  copy?.querySelectorAll('.cell__button').forEach(button => button.remove())
  return copy?.textContent?.trim()
}
export const fieldError = (root: ParentNode, column: string) =>
  productCellOf(root, column)?.querySelector('[role="alert"]')?.textContent ??
  ''

/** Открыть правку ячейки, набрать текст и сохранить его Enter — по шагу за раз. */
export const typeAndSave = (
  root: HTMLElement,
  column: string,
  value: string,
) => {
  const input = productInput(root, column)
  if (!input) productEditButton(root, column)?.click()
  else if (input.value !== value) typeInto(input, value)
  else press(input, 'Enter')
}

export const localeOf = (args: { locale?: string }) =>
  args.locale === 'ru' ? 'ru-RU' : 'en-US'
export const dollars = (locale: string, value: number) =>
  new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(
    value,
  )

export const productArgs = {
  enableCellEditing: true,
  enableKeyboardNavigation: true,
  columnsOverride: EDIT_COLUMNS,
  dataOverride: EDIT_ROWS,
  dataTypes: EDIT_TYPES,
  editableColumns: ['price', 'inStock'],
  height: '360',
} satisfies Partial<StoryProps>

export const dateCellOf = (root: ParentNode, column: string) =>
  root.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${PRODUCT_ROW}"] .data-grid__body-cell[data-column-id="${column}"]`,
  )
export const datePopup = () =>
  document.querySelector<HTMLElement>('[data-testid="edit-date"]')
export const dateDay = (iso: string) =>
  datePopup()?.querySelector<HTMLButtonElement>(`[data-day="${iso}"] button`) ??
  null
export const dateTime = () =>
  datePopup()?.querySelector<HTMLElement>('[data-testid="edit-time"]') ?? null
export const openDateEdit = (root: ParentNode, column: string) =>
  dateCellOf(root, column)
    ?.querySelector<HTMLElement>('.cell__button button')
    ?.click()

/** Текст ячейки даты без кнопки правки: новый день — число 20, новое время — минуты 30. */
export const dateText = (root: ParentNode, column: string) => {
  const copy = dateCellOf(root, column)?.cloneNode(true) as
    HTMLElement | undefined
  copy?.querySelectorAll('.cell__button').forEach(button => button.remove())
  return copy?.textContent ?? ''
}

// --- ADR 0175: варианты -------------------------------------------------------------

/** Последний на странице: таблица прошлой истории каталога может ещё не уйти. */
export const lastOf = <T extends Element>(selector: string) =>
  [...document.querySelectorAll<T>(selector)].at(-1) ?? null
export const optionCellOf = (root: ParentNode, column: string) =>
  root.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${PRODUCT_ROW}"] .data-grid__body-cell[data-column-id="${column}"]`,
  )
export const optionCellText = (root: ParentNode, column: string) => {
  const copy = optionCellOf(root, column)?.cloneNode(true) as
    HTMLElement | undefined
  copy?.querySelectorAll('.cell__button').forEach(button => button.remove())
  return copy?.textContent?.trim() ?? ''
}
export const openOptionEdit = (root: ParentNode, column: string) =>
  optionCellOf(root, column)
    ?.querySelector<HTMLElement>('.cell__button button')
    ?.click()
export const selectField = () =>
  lastOf<HTMLInputElement>('[data-testid="edit-select"]')
export const optionsPopup = () =>
  lastOf<HTMLElement>('[data-testid="edit-options"]')
export const optionItem = (value: string) =>
  optionsPopup()?.querySelector<HTMLElement>(`[data-value="${value}"]`) ?? null
export const highlightedValue = () =>
  optionsPopup()
    ?.querySelector('[data-highlighted]')
    ?.getAttribute('data-value') ?? null

export const optionArgs = {
  ...productArgs,
  columnsOverride: OPTION_COLUMNS,
  editableColumns: ['status', 'tags'],
} satisfies Partial<StoryProps>

// --- Фильтр по типу ---------------------------------------------------------------------

/** Число строк, которое называет нижняя панель: первое число подписи. */
export const shownCount = () =>
  Number(filteredCount().match(/\d+/)?.[0] ?? Number.NaN)

export const filterValueField = () =>
  panel()?.querySelector<HTMLInputElement>('[data-testid="filter-value"]') ??
  null

/** Пользователь набирает значение условия фильтра. */
export const typeFilterValue = (value: string, signal: AbortSignal) =>
  repeat(
    () => filterValueField()?.value === value,
    () => {
      const field = filterValueField()
      if (field) typeInto(field, value)
    },
    signal,
  )

const booleanChoice = (choice: string) =>
  panel()?.querySelector<HTMLElement>(
    `[data-testid="filter-boolean"] [data-value="${choice}"]`,
  ) ?? null

/** Выбор панели фильтра булева: все, да, нет, пусто. */
export const booleanChosen = (choice: string) =>
  booleanChoice(choice)?.hasAttribute('data-checked') === true

/** Пользователь выбирает вариант панели фильтра булева. */
export const chooseBoolean = (choice: string, signal: AbortSignal) =>
  repeat(
    () => booleanChosen(choice),
    () => booleanChoice(choice)?.click(),
    signal,
  )
