/**
 * Редакторы вариантов (ADR 0175, ED8–ED10): `select` и `object` — поле с поиском (Combobox
 * Base UI), `multiSelect` — поповер со списком флажков. Варианты — `options` колонки,
 * справочник — `loadOptions` с ожиданием, отказом и повтором; длинный список виртуализирован.
 * Модуль ленивый — грузится при первой правке варианта.
 */
import {
  type CSSProperties,
  type RefObject,
  useCallback,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { Combobox } from '@base-ui/react/combobox'
import clsx from 'clsx'

import type { ColumnOption, OptionValue } from '../../core/columnOptions'
import { objectKeyOf } from '../../core/dataTypeFormat'
import { useLocalization } from '../../core/localization'
import type { RowSource } from '../../core/rowSource'
import {
  OptionChecklist,
  OptionStatus,
} from '../../shared/options/OptionChecklist'
import { useLoadedOptions } from '../../shared/options/useLoadedOptions'
import { useIcons } from '../../ui/icons'
import { usePortalThemeClass, usePortalThemeData } from '../../ui/theme'
import { POPUP_SIDE_OFFSET } from '../../ui/Popup/offset'
import { useVirtualizer } from '../../../vendor/tanstack-virtual/react-virtual'
import { EditPopover, movedFocus } from './EditPopover'
import type { CellEditorProps } from './types'

import inputStyles from './CellEditInput.module.css'
import checklistStyles from '../../shared/options/OptionChecklist.module.css'
import styles from './OptionEditors.module.css'

const ROW_HEIGHT = 32
const OVERSCAN = 8

type Cell = CellEditorProps['cell']

/** Пункт «очистить значение» — первым в списке. */
const CLEAR = {
  value: '\u0000clear',
  label: '',
} as const satisfies ColumnOption

const loadOptionsOf = (cell: Cell) =>
  cell.column.getDataType()?.definition.loadOptions ??
  cell.column.columnDef.loadOptions

/** Варианты колонки: ответ справочника или `options`, отфильтрованные поиском. */
const useEditOptions = (cell: Cell, query: string) => {
  const loaded = useLoadedOptions(
    cell.table,
    cell.column.id,
    loadOptionsOf(cell),
    query,
  )
  const options = useMemo(() => {
    if (loaded) return loaded.options
    const all = cell.column.columnDef.options ?? []
    const needle = query.trim().toLowerCase()
    return needle === ''
      ? all
      : all.filter(option => option.label.toLowerCase().includes(needle))
  }, [loaded, cell.column.columnDef.options, query])
  return { loaded, options }
}

/** Ключ значения ячейки — у записи `object` по `getKey`, иначе само значение. */
const keyOf = (cell: Cell, value: unknown) =>
  cell.column.getDataType()?.base === 'object'
    ? objectKeyOf(cell.table as never, cell.column as never, value)
    : value

/** Запись с этим ключом среди строк, загруженных в таблицу. */
const recordInData = (cell: Cell, key: unknown) => {
  const source = (
    cell.table as unknown as {
      getRowSource: () => RowSource<{ getValue: (id: string) => unknown }>
    }
  ).getRowSource()
  for (let index = 0; index < source.count(); index++) {
    const value = source.at(index)?.getValue(cell.column.id)
    if (value !== undefined && Object.is(keyOf(cell, value), key)) return value
  }
  return undefined
}

/**
 * Сохранить выбранный вариант: у `object` — `record` варианта, иначе запись с тем же ключом
 * из данных, иначе текст ключа разбирает свой `parseValue` (ED8).
 */
const saveOption = (props: CellEditorProps, option: ColumnOption) => {
  if (option.value === CLEAR.value) return props.commit(null)
  if (props.cell.column.getDataType()?.base !== 'object')
    return props.commit(option.value)
  const record = option.record ?? recordInData(props.cell, option.value)
  if (record !== undefined) props.commit(record)
  else props.commitText(String(option.value))
}

type Virtualizer = ReturnType<typeof useVirtualizer<HTMLDivElement, Element>>

const VirtualOptions = ({
  virtualizerRef,
}: {
  virtualizerRef: RefObject<Virtualizer | null>
}) => {
  const items = Combobox.useFilteredItems<ColumnOption>()
  const labels = useLocalization()
  const { checkboxChecked: CheckIcon } = useIcons()
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  })
  useImperativeHandle(virtualizerRef, () => virtualizer)
  const onScrollRef = useCallback(
    (element: HTMLDivElement | null) => {
      scrollRef.current = element
      if (element) virtualizer.measure()
    },
    [virtualizer],
  )
  if (items.length === 0) return null
  const total = virtualizer.getTotalSize()
  return (
    <div
      role="presentation"
      ref={onScrollRef}
      className={styles.scroller}
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
            <Combobox.Item
              key={String(item.value)}
              index={row.index}
              value={item}
              className={styles.item}
              aria-setsize={items.length}
              aria-posinset={row.index + 1}
              data-value={String(item.value)}
              data-clear={item === CLEAR || undefined}
              style={{
                height: row.size,
                transform: `translateY(${row.start}px)`,
              }}
            >
              <Combobox.ItemIndicator keepMounted className={styles.indicator}>
                <CheckIcon width={14} height={14} aria-hidden />
              </Combobox.ItemIndicator>
              <span className={styles.label}>
                {item.value === CLEAR.value ? labels.editClear : item.label}
              </span>
            </Combobox.Item>
          )
        })}
      </div>
    </div>
  )
}

/** `select` и `object`: поле с поиском; выбор сохраняет, Escape и уход отменяют (ED8). */
export const SelectEditor = (props: CellEditorProps) => {
  const { cell, label, cancel, value, error } = props
  const labels = useLocalization()
  const themeClass = usePortalThemeClass()
  const themeData = usePortalThemeData()
  const input = useRef<HTMLInputElement>(null)
  const virtualizerRef = useRef<Virtualizer | null>(null)
  const [query, setQuery] = useState('')
  const { loaded, options } = useEditOptions(cell, query)
  // «Очистить» — без поиска: с поиском первым подсвечивается найденный вариант.
  const items = useMemo(
    () => (query.trim() === '' ? [CLEAR, ...options] : options),
    [options, query],
  )
  const currentKey = keyOf(cell, value)
  const selected =
    options.find(option => Object.is(option.value, currentKey)) ?? null

  useLayoutEffect(() => {
    input.current?.focus({ preventScroll: true })
  }, [])

  const status =
    loaded?.status === 'error'
      ? 'error'
      : options.length > 0
        ? undefined
        : loaded?.status === 'loading'
          ? 'loading'
          : 'empty'

  return (
    <span className={inputStyles.field}>
      <Combobox.Root
        open
        virtualized
        autoHighlight
        items={items}
        filteredItems={items}
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
        <Combobox.Input
          ref={input}
          className={inputStyles.input}
          aria-label={label}
          placeholder={selected?.label || labels.filterSearchOptions}
          aria-invalid={error ? true : undefined}
          data-testid="edit-select"
          // Клавиши поля — его, а не навигации грида.
          onKeyDown={event => event.stopPropagation()}
        />
        <span role="alert" className={inputStyles.error}>
          {error}
        </span>
        <Combobox.Portal>
          <Combobox.Positioner
            side="bottom"
            align="start"
            sideOffset={POPUP_SIDE_OFFSET}
            className={clsx(themeClass, styles.positioner)}
            {...themeData}
          >
            <Combobox.Popup
              className={clsx(themeClass, styles.popup)}
              data-testid="edit-options"
            >
              {status && (
                <OptionStatus
                  status={status}
                  onRetry={loaded?.retry}
                  retryTestId="edit-options-retry"
                />
              )}
              <Combobox.List>
                <VirtualOptions virtualizerRef={virtualizerRef} />
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    </span>
  )
}

/** `multiSelect`: поповер со списком флажков; Enter и уход сохраняют, Escape отменяет (ED9). */
export const MultiSelectEditor = (props: CellEditorProps) => {
  const { cell, label, text, commit, cancel, setDraft, value } = props
  const labels = useLocalization()
  const listId = useId()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<OptionValue[]>(() =>
    Array.isArray(value) ? (value as OptionValue[]) : [],
  )
  const { loaded, options } = useEditOptions(cell, query)

  const toggle = (option: OptionValue, checked: boolean) => {
    const next = checked
      ? [...selected, option]
      : selected.filter(item => item !== option)
    setSelected(next)
    setDraft(next)
  }
  const status =
    loaded?.status === 'error'
      ? 'error'
      : options.length > 0
        ? undefined
        : loaded?.status === 'loading'
          ? 'loading'
          : 'empty'

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
        <input
          className={checklistStyles.search}
          type="text"
          value={query}
          placeholder={labels.filterSearchOptions}
          aria-label={labels.filterSearchOptions}
          aria-controls={options.length > 0 ? listId : undefined}
          onChange={event => setQuery(event.target.value)}
          data-testid="edit-options-search"
        />
        {status ? (
          <OptionStatus
            status={status}
            onRetry={loaded?.retry}
            retryTestId="edit-options-retry"
          />
        ) : (
          <OptionChecklist
            id={listId}
            options={options}
            isSelected={option => selected.includes(option)}
            onToggle={toggle}
            label={label}
            busy={loaded?.status === 'loading'}
            testId="edit-options"
          />
        )}
      </div>
    </EditPopover>
  )
}
