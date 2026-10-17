/**
 * Содержимое меню колонок (ADR 0035, CV3–CV11): поиск, дерево колонок с
 * трёхсостоянными галочками групп и кнопки «Показать все» / «Сбросить». Дерево
 * разворачивается в плоский список и виртуализируется: при тысячах колонок
 * рисуются только видимые строки (I4–I5).
 */
import { reportAction, sourceOf } from '../../core/debugActions'
import { type RefObject, useRef, useState } from 'react'

import { useVirtualizer } from '@tanstack/react-virtual'

import { useLocalization } from '../../core/localization'
import { useTableState } from '../../core/reactivity'
import type { Table } from '../../types'
import { Button } from '../../ui/Button'
import { SelectCheckbox } from '../../ui/SelectCheckbox/SelectCheckbox'
import { Tooltip } from '../../ui/Tooltip'
import {
  type ColumnTreeNode,
  buildColumnTree,
  filterColumnTree,
  getCheckState,
  getShowAll,
  getToggle,
} from './columnTree'
import {
  type VisibilityControlTable,
  resetColumnsVisibility,
  setColumnsVisible,
} from './applyVisibility'

import styles from './ColumnVisibilityMenu.module.css'

const ROW_HEIGHT = 32
const OVERSCAN = 8
const MAX_VISIBLE_ROWS = 10

interface ColumnVisibilityMenuProps {
  table: Table<any, any>
  /** Поле поиска получает фокус при открытии меню. */
  searchRef?: RefObject<HTMLInputElement | null>
}

const flatten = (nodes: ColumnTreeNode[]): ColumnTreeNode[] =>
  nodes.flatMap(node => [node, ...flatten(node.children)])

const ColumnRow = ({
  node,
  table,
  top,
}: {
  node: ColumnTreeNode
  table: VisibilityControlTable
  top: number
}) => {
  const state = getCheckState(node)
  const toggle = getToggle(node, table)

  return (
    <li
      className={styles.item}
      style={{ transform: `translateY(${top}px)` }}
      data-column-id={node.id}
      data-column-group={node.children.length > 0 || undefined}
    >
      <label
        className={styles.row}
        style={{ paddingInlineStart: `calc(8px + ${node.depth} * 16px)` }}
        data-disabled={toggle === null || undefined}
      >
        <SelectCheckbox
          selected={state === 'checked'}
          indeterminate={state === 'indeterminate'}
          disabled={toggle === null}
          label={node.label}
          onClick={event => {
            if (!toggle) return
            reportAction(table, {
              plugin: 'columnVisibility',
              action: 'toggleColumn',
              detail: { columnIds: toggle.columnIds, visible: toggle.visible },
              source: sourceOf(event),
            })
            setColumnsVisible(table, toggle.columnIds, toggle.visible)
          }}
        />
        <Tooltip title={node.label} overflowOnly>
          <span className={styles.label}>{node.label}</span>
        </Tooltip>
      </label>
    </li>
  )
}

export const ColumnVisibilityMenu = ({
  table,
  searchRef,
}: ColumnVisibilityMenuProps) => {
  const labels = useLocalization()
  const [query, setQuery] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  // Перерисовка на смену видимости, порядка и закрепления.
  useTableState(table, state => ({
    visibility: state.columnVisibility,
    order: state.columnOrder,
    pinning: state.columnPinning,
  }))

  const control = table as unknown as VisibilityControlTable
  const rows = flatten(filterColumnTree(buildColumnTree(control), query))
  const hiddenCount = getShowAll(control).length

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
    // Первая страница строк — сразу, до измерения поповера.
    initialRect: { width: 0, height: MAX_VISIBLE_ROWS * ROW_HEIGHT },
  })

  return (
    <div className={styles.menu}>
      <input
        ref={searchRef}
        className={styles.search}
        type="search"
        value={query}
        placeholder={labels.searchColumns}
        aria-label={labels.searchColumns}
        onChange={event => {
          reportAction(table, {
            plugin: 'columnVisibility',
            action: 'searchColumns',
            detail: { query: event.target.value },
            source: 'keyboard',
          })
          setQuery(event.target.value)
        }}
      />
      {rows.length > 0 ? (
        <div ref={scrollRef} className={styles.scroller}>
          <ul
            className={styles.tree}
            style={{ height: virtualizer.getTotalSize() }}
            aria-label={labels.columns}
          >
            {virtualizer.getVirtualItems().map(item => (
              <ColumnRow
                key={`${rows[item.index].id}-${item.index}`}
                node={rows[item.index]}
                table={control}
                top={item.start}
              />
            ))}
          </ul>
        </div>
      ) : (
        <p className={styles.empty} role="status">
          {labels.noColumnsFound}
        </p>
      )}
      <div className={styles.footer}>
        <Button
          variant="ghost"
          disabled={hiddenCount === 0}
          onClick={event => {
            reportAction(table, {
              plugin: 'columnVisibility',
              action: 'showAll',
              source: sourceOf(event),
            })
            setColumnsVisible(control, getShowAll(control), true)
          }}
        >
          {labels.showAllColumns}
        </Button>
        <Button
          variant="ghost"
          onClick={event => {
            reportAction(table, {
              plugin: 'columnVisibility',
              action: 'reset',
              source: sourceOf(event),
            })
            resetColumnsVisibility(control)
          }}
        >
          {labels.resetColumns}
        </Button>
      </div>
    </div>
  )
}
