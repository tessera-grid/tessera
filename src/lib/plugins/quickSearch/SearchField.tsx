/**
 * Поле быстрого поиска в тулбаре (ADR 0045, §6): ввод применяется через
 * `debounceMs`, кнопка очистки сбрасывает поиск сразу. Внешняя смена среза
 * `globalFilter` (сброс фильтров, контролируемое состояние) переносится в поле.
 */
import { useEffect, useRef, useState } from 'react'

import { Toolbar } from '@base-ui/react/toolbar'

import type { ToolbarComponentProps } from '../../core/createSlots'
import { setSearchByUser } from '../../core/filtering'
import { useLocalization } from '../../core/localization'
import { useTableState } from '../../core/reactivity'
import { useDebouncedCallback } from '../../core/useDebouncedCallback'
import { useIcons } from '../../ui/icons'
import { DEFAULT_SEARCH_DEBOUNCE_MS } from './search'

import styles from './SearchField.module.css'

interface SearchTable {
  options: { quickSearchDebounceMs?: number }
}

export const SearchField = ({ table }: ToolbarComponentProps) => {
  const labels = useLocalization()
  const { search: SearchIcon, clear: ClearIcon } = useIcons()
  const searchTable = table as unknown as SearchTable
  const applied = useTableState(table, state =>
    typeof state.globalFilter === 'string' ? state.globalFilter : '',
  )
  const [text, setText] = useState(applied)
  const lastApplied = useRef(applied)
  const inputRef = useRef<HTMLInputElement>(null)

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

  return (
    <div className={styles.field}>
      <span className={styles.icon} aria-hidden>
        <SearchIcon width={16} height={16} />
      </span>
      <Toolbar.Input
        ref={inputRef}
        type="search"
        className={styles.input}
        aria-label={labels.search}
        placeholder={labels.search}
        value={text}
        onChange={event => {
          setText(event.target.value)
          apply.schedule(event.target.value)
        }}
        data-testid="quick-search"
      />
      {text !== '' && (
        <Toolbar.Button
          type="button"
          className={styles.clear}
          aria-label={labels.clearSearch}
          onClick={clear}
          data-testid="quick-search-clear"
        >
          <ClearIcon width={14} height={14} />
        </Toolbar.Button>
      )}
    </div>
  )
}
