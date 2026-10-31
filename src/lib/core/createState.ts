/**
 * Управление состоянием таблицы. Бо́льшую часть срезов держат сами фичи
 * (uncontrolled через getInitialState), поэтому ядро контролирует только:
 *  - columnPinning — чтобы применить пиннинг сервисных колонок (display-transform):
 *    политику объявляет плагин (`pin`), ядро исполняет;
 *  - columnSizing — чтобы слить пользовательский ресайз с авто-слайсом плагинов
 *    (ширины служебных колонок, generic-escape).
 *
 * Остальные контролируемые слайсы (expanded/rowSelection/grouping/sorting/…)
 * прокидываются как есть из `state`/`handlers` потребителя.
 */
import type {
  ColumnPinningState,
  ColumnSizingState,
} from '@tanstack/react-table'

// --- Пиннинг сервисных колонок (start/end) -----------------------------------

export interface ServiceColumnPin {
  side: 'start' | 'end'
  when: 'always' | 'with-user'
}

export const defaultColumnPinningState: ColumnPinningState = {
  start: [],
  end: [],
}

export const mergeColumnPinning = (
  prev: ColumnPinningState | undefined,
  next: ColumnPinningState | undefined,
): ColumnPinningState => ({
  start: [...new Set([...(prev?.start || []), ...(next?.start || [])])],
  end: [...new Set([...(prev?.end || []), ...(next?.end || [])])],
})

/**
 * Слияние пользовательского пиннинга с сервисными колонками.
 * Только МЕХАНИКА: политику (сторона / всегда или только с пользователем) задаёт
 * плагин-владелец колонки. Сервисные колонки прижаты к внешнему краю блока:
 * leading — в начало start, trailing — в конец end.
 */
export const mergeServiceColumnPinning = (
  pinning: ColumnPinningState | undefined,
  serviceColumns: { id: string; pin?: ServiceColumnPin }[],
): ColumnPinningState => {
  const active = pinning ?? defaultColumnPinningState
  const userStart = active.start ?? []
  const userEnd = active.end ?? []
  const hasUserStart = userStart.length > 0
  const hasUserEnd = userEnd.length > 0

  const pinnedTo = (side: ServiceColumnPin['side'], hasUser: boolean) =>
    serviceColumns
      .filter(
        column =>
          column.pin?.side === side &&
          (column.pin.when === 'always' || hasUser),
      )
      .map(column => column.id)

  return {
    start: [...new Set([...pinnedTo('start', hasUserStart), ...userStart])],
    end: [...new Set([...userEnd, ...pinnedTo('end', hasUserEnd)])],
  }
}

// --- Размеры: слияние пользовательского ресайза с авто-слайсом ----------------

/**
 * Итоговый columnSizing. Авто-слайс плагинов (ширины служебных колонок) идёт
 * ПОСЛЕДНИМ и побеждает как контролируемый, так и внутренний размер.
 */
export const mergeColumnSizing = (
  externalColumnSizing: ColumnSizingState | undefined,
  columnSizing: ColumnSizingState,
  columnAutoSizing: ColumnSizingState,
): ColumnSizingState => ({
  ...(externalColumnSizing ?? columnSizing),
  ...columnAutoSizing,
})

export const isSameColumnSizing = (
  a: ColumnSizingState,
  b: ColumnSizingState,
): boolean => {
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  return aKeys.every(key => a[key] === b[key])
}
