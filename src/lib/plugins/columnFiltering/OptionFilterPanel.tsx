/**
 * Панель фильтра вариантов (ADR 0048, §3, §5): условие, поиск по подписям,
 * «Выбрать все» / «Снять», чек-лист со счётчиками. Галочка и условие применяются
 * сразу, поиск — через `debounceMs`. У справочника с `loadOptions` варианты
 * загружаются по поиску; прошлый запрос отменяется. Модуль ленивый.
 */
import {
  type RefObject,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'

import clsx from 'clsx'

import { optionLabelOf, type OptionValue } from '../../core/columnOptions'
import {
  OptionChecklist,
  OptionStatus,
} from '../../shared/options/OptionChecklist'
import { OptionSearch } from '../../shared/options/OptionSearch'
import { useLoadedOptions } from '../../shared/options/useLoadedOptions'
import { setColumnFilterByUser } from '../../shared/filtering/filtering'
import { useLocalization } from '../../core/localization'
import { useDebouncedCallback } from '../../util/useDebouncedCallback'
import { Button } from '../../ui/Button'
import { operatorLabel } from './describeFilter'
import type { FilterPanelProps } from './FilterPanel'
import { OperatorSelect } from './OperatorSelect'
import { columnFilterDefOf } from '../columnFilteringModel/conditions'
import {
  filterOptionsOf,
  optionCountsOf,
} from '../columnFilteringModel/options'
import type {
  OptionFilter,
  OptionFilterOperator,
  ColumnFilterValue,
} from '../columnFilteringModel/types'

import panelStyles from './FilterPanel.module.css'
import styles from './OptionFilterPanel.module.css'
import { FilterFailure } from './FilterFailure'
import { FilterApply } from './FilterApply'
import { useFilterDraft } from './filterDraft'

const OPERATORS: OptionFilterOperator[] = [
  'anyOf',
  'noneOf',
  'empty',
  'notEmpty',
]
const MULTI_OPERATORS: OptionFilterOperator[] = [
  'anyOf',
  'allOf',
  'noneOf',
  'empty',
  'notEmpty',
]

const needsValues = (operator: OptionFilterOperator) =>
  operator !== 'empty' && operator !== 'notEmpty'

interface Draft {
  operator: OptionFilterOperator
  selected: OptionValue[]
}

const draftOf = (current: OptionFilter | undefined): Draft => ({
  operator: current?.operator ?? 'anyOf',
  selected: current && 'value' in current ? [...current.value] : [],
})

const filterOf = (draft: Draft): OptionFilter | undefined => {
  if (!needsValues(draft.operator)) {
    return { operator: draft.operator } as OptionFilter
  }
  return draft.selected.length > 0
    ? ({ operator: draft.operator, value: draft.selected } as OptionFilter)
    : undefined
}

const normalize = (text: string) => text.trim().toLowerCase()

export const OptionFilterPanel = ({
  table,
  column,
  debounceMs,
  controls,
  type,
}: FilterPanelProps & { type: 'select' | 'multiselect' | 'lookup' }) => {
  const labels = useLocalization()
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef =
    controls.initialFocusRef as RefObject<HTMLInputElement | null>
  const t = table as object
  const def = columnFilterDefOf(column as never)
  const loadOptions = typeof def === 'object' ? def.loadOptions : undefined
  const header =
    typeof (column.columnDef as { header?: unknown }).header === 'string'
      ? ((column.columnDef as { header?: string }).header as string)
      : column.id

  const filterDraft = useFilterDraft({
    table,
    columnId: column.id,
    current: column.getFilterValue(),
    draftOf: current => draftOf(current as OptionFilter | undefined),
    filterOf: next => filterOf(next) as ColumnFilterValue | undefined,
  })
  const { draft, setDraft, server } = filterDraft
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')

  const applySearch = useDebouncedCallback(
    (next: string) => setQuery(next),
    debounceMs,
  )
  const loaded = useLoadedOptions(t, column.id, loadOptions, query)

  const update = (patch: Partial<Draft>) => {
    const next = { ...draft, ...patch }
    setDraft(next)
    // На сервере условие уходит кнопкой «Применить» (ADR 0154).
    if (!server) setColumnFilterByUser(table, column.id, filterOf(next))
  }

  const columnRef = column as unknown as Parameters<typeof filterOptionsOf>[1]
  const counts = loaded ? undefined : optionCountsOf(table, columnRef)
  const options = useMemo(() => {
    if (loaded) {
      // Отмеченные — вверху, даже вне ответа поиска.
      const found = new Set(loaded.options.map(option => option.value))
      const selected = draft.selected
        .filter(value => !found.has(value))
        .map(value => ({
          value,
          label: optionLabelOf(t, columnRef, value),
        }))
      return [...selected, ...loaded.options]
    }
    const needle = normalize(query)
    const all = filterOptionsOf(table, columnRef)
    return needle === ''
      ? all
      : all.filter(option => option.label.toLowerCase().includes(needle))
  }, [loaded, draft.selected, query, table, t, columnRef])

  const isSelected = (value: OptionValue) => draft.selected.includes(value)
  const toggle = (value: OptionValue, checked: boolean) =>
    update({
      selected: checked
        ? [...draft.selected, value]
        : draft.selected.filter(item => item !== value),
    })
  const visibleValues = options.map(option => option.value)
  const selectAll = () =>
    update({
      selected: [
        ...draft.selected,
        ...visibleValues.filter(value => !isSelected(value)),
      ],
    })
  const clearVisible = () =>
    update({
      selected: draft.selected.filter(value => !visibleValues.includes(value)),
    })
  const reset = () => {
    applySearch.cancel()
    setColumnFilterByUser(table, column.id, undefined)
    setDraft(draftOf(undefined))
    filterDraft.forget()
  }

  // Модуль ленивый: к открытию поповера панели ещё нет, фокус ставится после загрузки.
  useEffect(() => {
    const root = rootRef.current
    if (!root || root.contains(document.activeElement)) return
    ;(
      searchRef.current ??
      root.querySelector<HTMLElement>('[data-testid="filter-operator"]')
    )?.focus()
  }, [searchRef])

  const operators = type === 'multiselect' ? MULTI_OPERATORS : OPERATORS
  const statusLabels = {
    loading: labels.filterLoadingOptions,
    empty: labels.filterNoOptions,
    error: labels.filterOptionsError,
    retry: labels.filterRetry,
  }
  const hasList = loaded?.status !== 'error' && options.length > 0
  const busy = loaded?.status === 'loading'

  return (
    <div
      ref={rootRef}
      className={clsx(panelStyles.panel, styles.panel)}
      data-testid="filter-panel"
      data-filter-type={type}
    >
      <OperatorSelect
        value={draft.operator}
        operators={operators}
        labelOf={operator => operatorLabel(operator, labels)}
        onChange={operator => update({ operator })}
      />
      {needsValues(draft.operator) && (
        <>
          <OptionSearch
            value={search}
            onClear={() => {
              setSearch('')
              applySearch.cancel()
              setQuery('')
            }}
          >
            <input
              ref={searchRef}
              className={panelStyles.input}
              type="text"
              value={search}
              placeholder={labels.filterSearchOptions}
              aria-label={labels.filterSearchOptions}
              aria-controls={hasList ? listId : undefined}
              onChange={event => {
                setSearch(event.target.value)
                applySearch.schedule(event.target.value)
              }}
              data-testid="filter-options-search"
            />
          </OptionSearch>
          <div className={styles.bulk}>
            <Button
              variant="ghost"
              disabled={options.length === 0}
              onClick={selectAll}
              data-testid="filter-select-all"
            >
              {labels.filterSelectAll}
            </Button>
            <Button
              variant="ghost"
              disabled={!options.some(option => isSelected(option.value))}
              onClick={clearVisible}
              data-testid="filter-clear-selection"
            >
              {labels.filterClearSelection}
            </Button>
          </div>
          {loaded?.status === 'error' ? (
            <OptionStatus
              status="error"
              onRetry={loaded.retry}
              reason={loaded.reason}
              labels={statusLabels}
              retryTestId="filter-options-retry"
            />
          ) : options.length === 0 ? (
            <OptionStatus
              status={busy ? 'loading' : 'empty'}
              labels={statusLabels}
              retryTestId="filter-options-retry"
            />
          ) : (
            <OptionChecklist
              id={listId}
              options={options}
              isSelected={isSelected}
              onToggle={toggle}
              label={header}
              busy={busy}
              counts={counts}
              testId="filter-options"
            />
          )}
        </>
      )}
      <div className={panelStyles.footer}>
        <FilterFailure table={table} columnId={column.id} />
        <Button variant="ghost" onClick={reset} data-testid="filter-reset">
          {labels.filterReset}
        </Button>
        {server && <FilterApply {...filterDraft} />}
      </div>
    </div>
  )
}
