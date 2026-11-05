/**
 * Поле быстрого поиска в тулбаре (ADR 0045, §6): ввод применяется через
 * `debounceMs`, кнопка очистки сбрасывает поиск сразу. Внешняя смена среза
 * `globalFilter` (сброс фильтров, контролируемое состояние) переносится в поле.
 * Иконка «и» с тултипом и описание поля называют колонки поиска; без них поле
 * недоступно (ADR 0053), а пока колонки не пришли с сервера — скелет (ADR 0122, TF2).
 */
import { useEffect, useId, useRef, useState } from 'react'

import { Toolbar } from '@base-ui/react/toolbar'

import type { ToolbarComponentProps } from '../../core/createSlots'
import { cancelPending, cancelSourceOf } from '../../core/cancellation'
import { setSearchByUser } from '../../shared/filtering/filtering'
import { useLocalization } from '../../core/localization'
import { useTableState } from '../../core/reactivity'
import {
  searchColumnLabel,
  searchColumnsOf,
} from '../../shared/filtering/searchColumns'
import { isWaitingForColumns } from '../../core/skeletonOptions'
import { ToolbarSkeleton } from '../../ui/ToolbarButton'
import { Field, SearchField as KitSearchField } from '../../ui/Field/Field'
import { useDebouncedCallback } from '../../util/useDebouncedCallback'
import { useIcons } from '../../ui/icons'
import { DEFAULT_SEARCH_DEBOUNCE_MS } from '../quickSearchModel/search'

import styles from './SearchField.module.css'
import hidden from '../../ui/visuallyHidden.module.css'
import { quickSearchLabels } from './labels'
import { optionsLabels } from '../../shared/options/labels'

interface SearchTable {
  options: { quickSearchDebounceMs?: number }
}

export const SearchField = ({ table }: ToolbarComponentProps) => {
  const labels = useLocalization()
  const { search: SearchIcon, info: InfoIcon } = useIcons()
  const searchTable = table as unknown as SearchTable
  const applied = useTableState(table, state =>
    typeof state.globalFilter === 'string' ? state.globalFilter : '',
  )
  const [text, setText] = useState(applied)
  const lastApplied = useRef(applied)
  const inputRef = useRef<HTMLInputElement>(null)
  const hintId = useId()

  // Набор колонок поиска зависит от видимости, пиннинга и порядка колонок.
  useTableState(table, state => {
    const s = state as unknown as Record<string, unknown>
    return {
      visibility: s.columnVisibility,
      pinning: s.columnPinning,
      order: s.columnOrder,
    }
  })
  const columns = searchColumnsOf(table)
  const hint =
    columns.length > 0
      ? quickSearchLabels(labels).searchColumnsHint(
          columns.map(searchColumnLabel),
        )
      : quickSearchLabels(labels).searchNoColumns

  const apply = useDebouncedCallback((value: string) => {
    lastApplied.current = value
    setSearchByUser(table, value)
  }, searchTable.options.quickSearchDebounceMs ?? DEFAULT_SEARCH_DEBOUNCE_MS)

  useEffect(() => {
    if (applied !== lastApplied.current) {
      lastApplied.current = applied
      apply.cancel()
      setText(applied)
    }
  }, [applied, apply])

  const clear = () => {
    setText('')
    apply.schedule('')
    apply.flush()
    inputRef.current?.focus()
  }

  if (isWaitingForColumns(table)) {
    return <ToolbarSkeleton kind="field" data-testid="quick-search-skeleton" />
  }

  return (
    <KitSearchField
      className={styles.field}
      icon={<SearchIcon width={16} height={16} />}
      hint={{
        label: hint,
        icon: <InfoIcon width={14} height={14} />,
        render: <Toolbar.Button />,
        'data-testid': 'quick-search-hint',
      }}
      clear={
        text === ''
          ? undefined
          : {
              label: optionsLabels(labels).clearSearch,
              onClick: clear,
              render: <Toolbar.Button />,
              'data-testid': 'quick-search-clear',
            }
      }
    >
      <Field
        ref={inputRef}
        render={<Toolbar.Input />}
        type="search"
        aria-label={quickSearchLabels(labels).search}
        aria-describedby={hintId}
        placeholder={quickSearchLabels(labels).search}
        disabled={columns.length === 0}
        value={text}
        onChange={event => {
          setText(event.target.value)
          apply.schedule(event.target.value)
        }}
        // Escape отменяет ждущее серверное действие (ADR 0153, §5) вместо очистки поля:
        // срез поиска вернётся к прежнему запросу, а с ним и поле.
        onKeyDown={event => {
          if (event.key !== 'Escape') return
          if (
            cancelPending(table, { kind: 'server' }, cancelSourceOf(event)) > 0
          ) {
            apply.cancel()
            event.preventDefault()
          }
        }}
        data-testid="quick-search"
      />
      <span
        id={hintId}
        className={hidden['visually-hidden']}
        data-visually-hidden=""
      >
        {hint}
      </span>
    </KitSearchField>
  )
}
