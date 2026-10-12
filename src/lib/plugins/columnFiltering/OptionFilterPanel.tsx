/**
 * Панель фильтра вариантов (ADR 0048, §3, §5): условие, поиск по подписям,
 * «Выбрать все» / «Снять», чек-лист со счётчиками. Галочка и условие применяются
 * сразу, поиск — через `debounceMs`. У справочника с `loadOptions` варианты
 * загружаются по поиску; прошлый запрос отменяется. Модуль ленивый.
 */
import {
  type KeyboardEvent,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'

import { Checkbox } from '@base-ui/react/checkbox'
import { useVirtualizer } from '@tanstack/react-virtual'
import clsx from 'clsx'

import {
  type ColumnOption,
  optionLabelOf,
  type OptionValue,
  rememberOptionLabels,
} from '../../core/columnOptions'
import { setColumnFilterByUser } from '../../core/filtering'
import { useLocalization } from '../../core/localization'
import { useDebouncedCallback } from '../../core/useDebouncedCallback'
import { Button } from '../../ui/Button'
import { useIcons } from '../../ui/icons'
import { Tooltip } from '../../ui/Tooltip'
import { operatorLabel } from './describeFilter'
import type { FilterPanelProps } from './FilterPanel'
import { OperatorSelect } from './OperatorSelect'
import { filterOptionsOf, optionCountsOf } from './options'
import type {
  ColumnFilterDef,
  LoadOptions,
  OptionFilter,
  OptionFilterOperator,
} from './types'

import panelStyles from './FilterPanel.module.css'
import checkboxStyles from '../../ui/SelectCheckbox/SelectCheckbox.module.css'
import styles from './OptionFilterPanel.module.css'

const ROW_HEIGHT = 32
const OVERSCAN = 8
const MAX_VISIBLE_ROWS = 8

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

type Loaded =
  | { status: 'loading'; options: ColumnOption[] }
  | { status: 'ready'; options: ColumnOption[] }
  | { status: 'error'; options: ColumnOption[] }

/** Варианты справочника по строке поиска; новый запрос отменяет прошлый. */
const useLoadedOptions = (
  table: object,
  columnId: string,
  loadOptions: LoadOptions | undefined,
  query: string,
) => {
  const [loaded, setLoaded] = useState<Loaded>({
    status: 'loading',
    options: [],
  })
  const [attempt, setAttempt] = useState(0)

  // Новый запрос — сразу «загрузка» с прежними вариантами, ещё в этом рендере.
  const request = [table, columnId, loadOptions, query, attempt]
  const [lastRequest, setLastRequest] = useState(request)
  if (request.some((value, index) => value !== lastRequest[index])) {
    setLastRequest(request)
    setLoaded(prev => ({ status: 'loading', options: prev.options }))
  }

  useEffect(() => {
    if (!loadOptions) return
    const controller = new AbortController()
    loadOptions(query, { signal: controller.signal }).then(
      options => {
        if (controller.signal.aborted) return
        rememberOptionLabels(table, columnId, options)
        setLoaded({ status: 'ready', options })
      },
      () => {
        if (controller.signal.aborted) return
        setLoaded(prev => ({ status: 'error', options: prev.options }))
      },
    )
    return () => controller.abort()
  }, [table, columnId, loadOptions, query, attempt])

  const retry = useCallback(() => setAttempt(n => n + 1), [])
  return loadOptions ? { ...loaded, retry } : undefined
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
  const { clear: ClearIcon } = useIcons()
  const listId = useId()
  const scrollRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef =
    controls.initialFocusRef as RefObject<HTMLInputElement | null>
  const t = table as object
  const def = column.columnDef.filter as ColumnFilterDef | undefined
  const loadOptions = typeof def === 'object' ? def.loadOptions : undefined
  const header =
    typeof (column.columnDef as { header?: unknown }).header === 'string'
      ? ((column.columnDef as { header?: string }).header as string)
      : column.id

  const [draft, setDraft] = useState(() =>
    draftOf(column.getFilterValue() as OptionFilter | undefined),
  )
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const applySearch = useDebouncedCallback(
    (next: string) => setQuery(next),
    debounceMs,
  )
  const loaded = useLoadedOptions(t, column.id, loadOptions, query)

  const update = (patch: Partial<Draft>) => {
    const next = { ...draft, ...patch }
    setDraft(next)
    setColumnFilterByUser(table, column.id, filterOf(next))
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

  const virtualizer = useVirtualizer({
    count: options.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
    initialRect: { width: 0, height: MAX_VISIBLE_ROWS * ROW_HEIGHT },
  })

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
  }

  const activeIndex = Math.min(active, Math.max(options.length - 1, 0))
  const focusOption = (index: number) => {
    setActive(index)
    virtualizer.scrollToIndex(index)
  }
  // Виртуализация: фокус — на вариант, когда он смонтирован.
  const [pendingFocus, setPendingFocus] = useState(false)
  // Новый диапазон виртуализатора — новый массив: эффект повторяется после прокрутки.
  const virtualItems = virtualizer.getVirtualItems()
  useEffect(() => {
    if (!pendingFocus) return
    const target = listRef.current?.querySelector<HTMLElement>(
      `[data-option-index="${activeIndex}"] [role="checkbox"]`,
    )
    if (target) {
      target.focus()
      setPendingFocus(false)
    }
  }, [pendingFocus, activeIndex, virtualItems])
  const onListKeyDown = (event: KeyboardEvent) => {
    const last = options.length - 1
    const next =
      event.key === 'ArrowDown'
        ? Math.min(activeIndex + 1, last)
        : event.key === 'ArrowUp'
          ? Math.max(activeIndex - 1, 0)
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null
    if (next === null) return
    event.preventDefault()
    focusOption(next)
    setPendingFocus(true)
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
          <div className={styles.searchRow}>
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
            {search !== '' && (
              <button
                type="button"
                className={styles.clearSearch}
                aria-label={labels.clearSearch}
                onClick={() => {
                  setSearch('')
                  applySearch.cancel()
                  setQuery('')
                }}
              >
                <ClearIcon width={14} height={14} />
              </button>
            )}
          </div>
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
            <div className={styles.status} role="alert">
              <span>{labels.filterOptionsError}</span>
              <Button
                variant="ghost"
                onClick={loaded.retry}
                data-testid="filter-options-retry"
              >
                {labels.filterRetry}
              </Button>
            </div>
          ) : options.length === 0 ? (
            <p className={styles.status} aria-busy={busy || undefined}>
              {busy ? labels.filterLoadingOptions : labels.filterNoOptions}
            </p>
          ) : (
            <div
              ref={scrollRef}
              className={styles.scroller}
              aria-busy={busy || undefined}
              data-testid="filter-options"
            >
              <div
                ref={listRef}
                id={listId}
                className={styles.list}
                style={{ height: virtualizer.getTotalSize() }}
                role="group"
                aria-label={header}
                onKeyDown={onListKeyDown}
              >
                {virtualItems.map(item => {
                  const option = options[item.index]
                  const checked = isSelected(option.value)
                  const count = counts?.get(option.value) ?? 0
                  return (
                    <div
                      key={String(option.value)}
                      className={styles.item}
                      style={{ transform: `translateY(${item.start}px)` }}
                      data-option-index={item.index}
                      data-value={String(option.value)}
                    >
                      <label className={styles.row}>
                        <Checkbox.Root
                          className={checkboxStyles.checkbox}
                          checked={checked}
                          onCheckedChange={next => toggle(option.value, next)}
                          tabIndex={item.index === activeIndex ? 0 : -1}
                          onFocus={() => setActive(item.index)}
                        >
                          <Checkbox.Indicator
                            keepMounted
                            className={checkboxStyles.indicator}
                          >
                            {checked && <CheckIcon />}
                          </Checkbox.Indicator>
                        </Checkbox.Root>
                        <Tooltip title={option.label} overflowOnly>
                          <span className={styles.label}>{option.label}</span>
                        </Tooltip>
                        {counts && (
                          <span
                            className={styles.count}
                            data-testid="filter-option-count"
                          >
                            {count}
                          </span>
                        )}
                      </label>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
      <div className={panelStyles.footer}>
        <Button variant="ghost" onClick={reset} data-testid="filter-reset">
          {labels.filterReset}
        </Button>
      </div>
    </div>
  )
}

const CheckIcon = () => {
  const { checkboxChecked: Icon } = useIcons()
  return <Icon className={checkboxStyles.icon} />
}
