/**
 * Редакторы вариантов (ADR 0175, ED8–ED10, ED25): в ячейке — текст значения, под ней поповер
 * с полем поиска: у `select` и `object` — список (Combobox Base UI), у `multiSelect` —
 * флажки; внизу — «Очистить значение». Варианты — `options` колонки,
 * справочник — `loadOptions` с ожиданием, отказом и повтором; длинный список виртуализирован.
 * Модуль ленивый — грузится при первой правке варианта.
 */
import {
  type CSSProperties,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'

import { Combobox } from '@base-ui/react/combobox'

import type { ColumnOption, OptionValue } from '../../core/columnOptions'
import { objectKeyOf, objectLabelOf } from '../../core/dataTypeFormat'
import { readPluginHooks } from '../../core/definePlugin'
import { useLocalization } from '../../core/localization'
import type { RowSource } from '../../core/rowSource'
import { optionsLabels } from '../../shared/options/labels'
import { useLoadedOptions } from '../../shared/options/useLoadedOptions'
import { Checklist, ChecklistStatus } from '../../ui/Checklist/Checklist'
import { Field, SearchField } from '../../ui/Field/Field'
import { PopupItem, PopupItemMark } from '../../ui/Popup/PopupItem'
import { PopupSurface } from '../../ui/Popup/PopupSurface'
import { useCloseOnGridScroll } from '../../ui/Popup/useCloseOnGridScroll'
import { useScrollFade } from '../../ui/Popup/useScrollFade'
import { useDebouncedCallback } from '../../util/useDebouncedCallback'
import { useVirtualizer } from '../../../vendor/tanstack-virtual/react-virtual'
import {
  ClearValue,
  EditPopover,
  movedFocus,
  useFocusReturn,
} from './EditPopover'
import type { CellEditingHooks, CellEditorProps } from './types'

import popoverStyles from './EditPopover.module.css'
import styles from './OptionEditors.module.css'
import { cellEditingLabels } from './labels'

const ROW_HEIGHT = 32
const OVERSCAN = 8

type Cell = CellEditorProps['cell']

const loadOptionsOf = (cell: Cell) =>
  cell.column.getDataType()?.definition.loadOptions ??
  cell.column.columnDef.loadOptions

/** Записи колонки `object` в загруженных строках — по ключу, подпись по `getLabel` (ED17). */
const recordsInData = (cell: Cell): ColumnOption[] => {
  const definition = cell.column.getDataType()!.definition
  const byKey = new Map<unknown, ColumnOption>()
  for (const row of rowSourceOf(cell).loadedRows()) {
    const value = row.getValue(cell.column.id)
    if (value === null || value === undefined) continue
    const key = keyOf(cell, value)
    if (!byKey.has(key))
      byKey.set(key, {
        value: key as OptionValue,
        label: objectLabelOf(definition, value),
        record: value,
      })
  }
  return [...byKey.values()]
}

/**
 * Варианты колонки: ответ справочника, иначе `options`, у `object` без них — записи из
 * данных; без справочника — отфильтрованные поиском. Запрос справочника идёт после паузы
 * ввода `searchDebounceMs` (ED18).
 */
const useEditOptions = (cell: Cell, query: string) => {
  const delay = readPluginHooks<Partial<CellEditingHooks>>(
    cell.table as never,
    'cellEditing',
  ).searchDebounceMs
  const [requested, setRequested] = useState(query)
  const request = useDebouncedCallback(setRequested, delay ?? 0)
  useEffect(() => {
    if (delay) request.schedule(query)
  }, [delay, query, request])
  const loaded = useLoadedOptions(
    cell.table,
    cell.column.id,
    loadOptionsOf(cell),
    delay ? requested : query,
  )
  const own = cell.column.columnDef.options
  const object = cell.column.getDataType()?.base === 'object'
  const all = useMemo(
    () => (loaded ? [] : (own ?? (object ? recordsInData(cell) : []))),
    [loaded, own, object, cell],
  )
  const options = useMemo(() => {
    if (loaded) return loaded.options
    const needle = query.trim().toLowerCase()
    return needle === ''
      ? all
      : all.filter(option => option.label.toLowerCase().includes(needle))
  }, [loaded, all, query])
  return { loaded, options }
}

/** Ключ значения ячейки — у записи `object` по `getKey`, иначе само значение. */
const keyOf = (cell: Cell, value: unknown) =>
  cell.column.getDataType()?.base === 'object'
    ? objectKeyOf(cell.table as never, cell.column as never, value)
    : value

const rowSourceOf = (cell: Cell) =>
  (
    cell.table as unknown as {
      getRowSource: () => RowSource<{ getValue: (id: string) => unknown }>
    }
  ).getRowSource()

/** Запись с этим ключом среди строк, загруженных в таблицу. */
const recordInData = (cell: Cell, key: unknown) => {
  for (const row of rowSourceOf(cell).loadedRows()) {
    const value = row.getValue(cell.column.id)
    if (value !== undefined && Object.is(keyOf(cell, value), key)) return value
  }
  return undefined
}

/**
 * Сохранить выбранный вариант: у `object` — `record` варианта, иначе запись с тем же ключом
 * из данных, иначе текст ключа разбирает свой `parseValue` (ED8).
 */
const saveOption = (props: CellEditorProps, option: ColumnOption) => {
  if (props.cell.column.getDataType()?.base !== 'object')
    return props.commit(option.value)
  const record = option.record ?? recordInData(props.cell, option.value)
  if (record !== undefined) props.commit(record)
  else props.commitText(String(option.value))
}

const editStatusLabels = (labels: ReturnType<typeof useLocalization>) => ({
  loading: cellEditingLabels(labels).editLoadingOptions,
  empty: cellEditingLabels(labels).editNoOptions,
  error: cellEditingLabels(labels).editOptionsError,
  retry: cellEditingLabels(labels).editRetry,
})

type Virtualizer = ReturnType<typeof useVirtualizer<HTMLDivElement, Element>>

const VirtualOptions = ({
  virtualizerRef,
}: {
  virtualizerRef: RefObject<Virtualizer | null>
}) => {
  const items = Combobox.useFilteredItems<ColumnOption>()
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  })
  useImperativeHandle(virtualizerRef, () => virtualizer)
  const measureOnMount = useCallback(
    (element: HTMLDivElement | null) => {
      scrollRef.current = element
      if (element) virtualizer.measure()
    },
    [virtualizer],
  )
  const onScrollRef = useScrollFade(measureOnMount)
  if (items.length === 0) return null
  const total = virtualizer.getTotalSize()
  return (
    <div
      role="presentation"
      ref={onScrollRef}
      className={styles.scroller}
      data-popup-scroller=""
      style={{ '--_total': `${total}px` } as CSSProperties}
    >
      <div
        role="presentation"
        className={styles.track}
        style={{ height: total }}
      >
        {virtualizer.getVirtualItems().map(row => {
          const item = items[row.index]!
          return (
            <PopupItem
              key={String(item.value)}
              render={<Combobox.Item index={row.index} value={item} />}
              className={styles.item}
              aria-setsize={items.length}
              aria-posinset={row.index + 1}
              data-value={String(item.value)}
              style={{
                height: row.size,
                transform: `translateY(${row.start}px)`,
              }}
              end={
                <PopupItemMark
                  render={<Combobox.ItemIndicator />}
                  status="checked"
                />
              }
            >
              <span className={styles.label}>{item.label}</span>
            </PopupItem>
          )
        })}
      </div>
    </div>
  )
}

const statusOf = (
  loaded: ReturnType<typeof useEditOptions>['loaded'],
  count: number,
) =>
  loaded?.status === 'error'
    ? 'error'
    : count > 0
      ? undefined
      : loaded?.status === 'loading'
        ? 'loading'
        : 'empty'

/**
 * `select` и `object`: в ячейке — текст значения, под ней поповер с полем поиска и списком;
 * выбор сохраняет, Escape, нажатие мимо и прокрутка таблицы отменяют (ED8, ED23, ED25).
 */
export const SelectEditor = (props: CellEditorProps) => {
  const { cell, label, cancel, value, text } = props
  const labels = useLocalization()
  const anchor = useRef<HTMLSpanElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const virtualizerRef = useRef<Virtualizer | null>(null)
  const [query, setQuery] = useState('')
  const { loaded, options } = useEditOptions(cell, query)
  const currentKey = keyOf(cell, value)
  const selected =
    options.find(option => Object.is(option.value, currentKey)) ?? null
  const status = statusOf(loaded, options.length)
  useCloseOnGridScroll(true, cancel)
  useFocusReturn(anchor)

  return (
    <span ref={anchor} className={popoverStyles.anchor}>
      {text}
      <Combobox.Root
        open
        virtualized
        autoHighlight
        items={options}
        filteredItems={options}
        value={selected}
        inputValue={query}
        onInputValueChange={setQuery}
        itemToStringLabel={(item: ColumnOption) => item.label}
        isItemEqualToValue={(item: ColumnOption, other: ColumnOption) =>
          Object.is(item.value, other.value)
        }
        onValueChange={(next: ColumnOption | null) => {
          if (next) saveOption(props, next)
        }}
        // Escape и уход отменяют; снятый в никуда фокус — нет, как у поповера правки.
        onOpenChange={(open, details) => {
          if (
            !open &&
            (details.reason === 'escape-key' ||
              details.reason === 'outside-press' ||
              movedFocus(details))
          )
            cancel()
        }}
        onItemHighlighted={(item, { reason, index }) => {
          const virtualizer = virtualizerRef.current
          if (!item || !virtualizer) return
          const last = index === virtualizer.options.count - 1
          if (
            reason === 'none' ||
            (reason === 'keyboard' && (index === 0 || last))
          )
            queueMicrotask(() =>
              virtualizer.scrollToIndex(index, {
                align: last ? 'start' : 'end',
              }),
            )
        }}
      >
        <Combobox.Portal>
          <PopupSurface
            positioner={
              <Combobox.Positioner
                anchor={anchor}
                side="bottom"
                align="start"
              />
            }
            popup={
              <Combobox.Popup
                aria-label={label}
                initialFocus={input}
                finalFocus={false}
                data-testid="edit-options"
                // Клавиши поповера — его, а не навигации грида.
                onKeyDown={event => event.stopPropagation()}
              />
            }
            className={styles.popup}
          >
            <SearchField
              clear={
                query === ''
                  ? undefined
                  : {
                      label: optionsLabels(labels).clearSearch,
                      onClick: () => {
                        setQuery('')
                        input.current?.focus()
                      },
                      'data-testid': 'edit-options-clear-search',
                    }
              }
            >
              <Field
                ref={input}
                render={<Combobox.Input />}
                aria-label={cellEditingLabels(labels).editSearchOptions}
                placeholder={cellEditingLabels(labels).editSearchOptions}
                data-testid="edit-select"
              />
            </SearchField>
            {status && (
              <ChecklistStatus
                status={status}
                onRetry={loaded?.retry}
                reason={loaded?.status === 'error' ? loaded.reason : undefined}
                labels={editStatusLabels(labels)}
                retryTestId="edit-options-retry"
              />
            )}
            <Combobox.List>
              <VirtualOptions virtualizerRef={virtualizerRef} />
            </Combobox.List>
            <ClearValue onClear={() => props.commit(null)} />
          </PopupSurface>
        </Combobox.Portal>
      </Combobox.Root>
    </span>
  )
}

/**
 * `multiSelect`: поповер с полем поиска и списком флажков; Enter и уход сохраняют, Escape и
 * прокрутка таблицы отменяют (ED9, ED23).
 */
export const MultiSelectEditor = (props: CellEditorProps) => {
  const { cell, label, text, commit, cancel, setDraft, value } = props
  const labels = useLocalization()
  const listId = useId()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<OptionValue[]>(() =>
    Array.isArray(value) ? (value as OptionValue[]) : [],
  )
  const { loaded, options } = useEditOptions(cell, query)
  const status = statusOf(loaded, options.length)

  const toggle = (option: OptionValue, checked: boolean) => {
    const next = checked
      ? [...selected, option]
      : selected.filter(item => item !== option)
    setSelected(next)
    setDraft(next)
  }

  return (
    <EditPopover
      text={text}
      label={label}
      testId="edit-multiselect"
      initialFocus={popup => popup?.querySelector<HTMLElement>('input') ?? true}
      onCancel={cancel}
      onLeave={() => commit(selected)}
    >
      <div
        className={styles.multi}
        onKeyDown={event => {
          if (event.key === 'Enter') commit(selected)
          if (event.key === 'Escape') cancel()
        }}
      >
        <SearchField
          clear={
            query === ''
              ? undefined
              : {
                  label: optionsLabels(labels).clearSearch,
                  onClick: () => setQuery(''),
                  'data-testid': 'edit-options-clear-search',
                }
          }
        >
          <Field
            type="text"
            value={query}
            placeholder={cellEditingLabels(labels).editSearchOptions}
            aria-label={cellEditingLabels(labels).editSearchOptions}
            aria-controls={options.length > 0 ? listId : undefined}
            onChange={event => setQuery(event.target.value)}
            data-testid="edit-options-search"
          />
        </SearchField>
        {status ? (
          <ChecklistStatus
            status={status}
            onRetry={loaded?.retry}
            reason={loaded?.status === 'error' ? loaded.reason : undefined}
            labels={editStatusLabels(labels)}
            retryTestId="edit-options-retry"
          />
        ) : (
          <Checklist
            id={listId}
            options={options}
            isSelected={option => selected.includes(option)}
            onToggle={toggle}
            label={label}
            busy={loaded?.status === 'loading'}
            testId="edit-options"
          />
        )}
        <ClearValue onClear={() => commit([])} />
      </div>
    </EditPopover>
  )
}
