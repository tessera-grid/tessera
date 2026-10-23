/**
 * Содержимое меню колонок (ADR 0035, CV3–CV11; ADR 0133): поиск, корень «Все колонки»,
 * дерево колонок с трёхсостоянными галочками групп и линиями дерева, подвал «Выбрано N
 * колонок» и «Сбросить». Дерево разворачивается в плоский список и виртуализируется:
 * при тысячах колонок рисуются только видимые строки (I4–I5).
 */
import { reportAction, sourceOf } from '../../core/debugActions'
import { type RefObject, useRef, useState } from 'react'

import { useVirtualizer } from '@tanstack/react-virtual'

import { useLocalization } from '../../core/localization'
import { TreeLines } from '../../grid/TreeLinesLayer'
import { useTableState } from '../../core/reactivity'
import type { Table } from '../../types'
import { Button } from '../../ui/Button'
import { SelectCheckbox } from '../../ui/SelectCheckbox/SelectCheckbox'
import { Tooltip } from '../../ui/Tooltip'
import {
  type ColumnTreeNode,
  buildColumnTree,
  countVisibleColumns,
  filterColumnTree,
  getCheckState,
  getRootNode,
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

/** Строка дерева: узел и его линии — `1` на уровне, где ветка предка идёт дальше. */
interface TreeRow {
  node: ColumnTreeNode
  branch: string
}

/** Плоский список под корнем «Все колонки»: уровень узла — его глубина + 1. */
const flatten = (nodes: ColumnTreeNode[], prefix = ''): TreeRow[] =>
  nodes.flatMap((node, index) => {
    const branch = prefix + (index < nodes.length - 1 ? '1' : '0')
    return [{ node, branch }, ...flatten(node.children, branch)]
  })

/** Строка-флажок дерева: колонка, группа или корень «Все колонки» (глубина −1). */
const CheckRow = ({
  node,
  label,
  table,
  action,
}: {
  node: ColumnTreeNode
  label: string
  table: VisibilityControlTable
  action: 'toggleColumn' | 'toggleAll'
}) => {
  const state = getCheckState(node)
  const toggle = getToggle(node)

  return (
    <label
      className={styles.row}
      style={{
        paddingInlineStart: `calc(8px + ${node.depth + 1} * var(--tsr-tree-indent))`,
      }}
      data-disabled={toggle === null || undefined}
    >
      <SelectCheckbox
        selected={state === 'checked'}
        indeterminate={state === 'indeterminate'}
        disabled={toggle === null}
        label={label}
        // Меню — в композите тулбара: без tabIndex галочки выпали бы из порядка Tab.
        tabIndex={toggle === null ? undefined : 0}
        onClick={event => {
          if (!toggle) return
          reportAction(table, {
            plugin: 'columnVisibility',
            action,
            detail: { columnIds: toggle.columnIds, visible: toggle.visible },
            source: sourceOf(event),
          })
          setColumnsVisible(table, toggle.columnIds, toggle.visible)
        }}
      />
      <Tooltip title={label} overflowOnly>
        <span className={styles.label}>{label}</span>
      </Tooltip>
    </label>
  )
}

const ColumnRow = ({
  row: { node, branch },
  table,
  top,
}: {
  row: TreeRow
  table: VisibilityControlTable
  top: number
}) => (
  <li
    className={styles.item}
    style={{ transform: `translateY(${top}px)` }}
    data-column-id={node.id}
    data-column-group={node.children.length > 0 || undefined}
  >
    <CheckRow
      node={node}
      label={node.label}
      table={table}
      action="toggleColumn"
    />
    {/* После строки: подложка наведения не закрывает линии. */}
    <TreeLines branch={branch} open={node.children.length > 0} />
  </li>
)

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
  const found = filterColumnTree(buildColumnTree(control), query)
  const rows = flatten(found)

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
        <div className={styles.columns}>
          <div className={styles.root} data-testid="column-visibility-all">
            <CheckRow
              node={getRootNode(found)}
              label={labels.allColumns}
              table={control}
              action="toggleAll"
            />
            <TreeLines branch="" open />
          </div>
          <div ref={scrollRef} className={styles.scroller}>
            <ul
              className={styles.tree}
              style={{ height: virtualizer.getTotalSize() }}
              aria-label={labels.columns}
            >
              {virtualizer.getVirtualItems().map(item => (
                <ColumnRow
                  key={`${rows[item.index].node.id}-${item.index}`}
                  row={rows[item.index]}
                  table={control}
                  top={item.start}
                />
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <p className={styles.empty} role="status">
          {labels.noColumnsFound}
        </p>
      )}
      <div className={styles.footer}>
        <span className={styles.count} data-testid="column-visibility-count">
          {labels.selectedColumns(countVisibleColumns(control))}
        </span>
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
