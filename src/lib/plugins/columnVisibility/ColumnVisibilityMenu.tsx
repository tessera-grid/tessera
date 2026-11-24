/**
 * Содержимое меню колонок (ADR 0035, CV3–CV11; ADR 0133): поиск, корень «Все колонки»,
 * дерево колонок с трёхсостоянными галочками групп и линиями дерева, подвал «Выбрано N
 * колонок» и «Сбросить». Дерево разворачивается в плоский список и виртуализируется:
 * при тысячах колонок рисуются только видимые строки (I4–I5).
 */
import { reportAction, sourceOf } from '../../core/debugActions'
import {
  type ReactNode,
  type RefObject,
  useMemo,
  useRef,
  useState,
} from 'react'

import { useVirtualizer } from '../../../vendor/tanstack-virtual/react-virtual'

import {
  describeColumnTransforms,
  type ShownColumnTransform,
} from '../../core/columnTransforms'
import { type TableLabels, useLocalization } from '../../core/localization'
import { ItemButton } from '../../ui/Popup/ItemButton'
import { useIcons } from '../../ui/icons'
import { TreeLines } from '../../ui/TreeLines/TreeLinesLayer'
import { useTableState } from '../../core/reactivity'
import type { Table } from '../../types'
import { optionsLabels } from '../../shared/options/labels'
import { Button } from '../../ui/Button'
import { Field, SearchField } from '../../ui/Field/Field'
import { PopupItem } from '../../ui/Popup/PopupItem'
import { PopupPanel } from '../../ui/Popup/PopupPanel'
import { useScrollFade } from '../../ui/Popup/useScrollFade'
import { Checkbox } from '../../ui/Checkbox/Checkbox'
import { Tooltip } from '../../ui/Tooltip'
import {
  type ColumnTreeNode,
  buildColumnTree,
  countVisibleColumns,
  filterColumnTree,
  getCheckState,
  getRootNode,
  getToggle,
  labelOf,
} from './columnTree'
import {
  type VisibilityControlTable,
  resetColumnsVisibility,
  setColumnsVisible,
} from './applyVisibility'

import styles from './ColumnVisibilityMenu.module.css'
import {
  announceKeptTransforms,
  capitalized,
  clearHiddenTransforms,
} from './hiddenTransforms'
import { columnVisibilityLabels } from './labels'

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
  name = label,
  end,
  onToggle,
}: {
  node: ColumnTreeNode
  label: string
  table: VisibilityControlTable
  action: 'toggleColumn' | 'toggleAll'
  /** Доступное имя флажка; у скрытой колонки — с её преобразованиями (HT3). */
  name?: string
  /** Справа: значки преобразований скрытой колонки и «Снять». */
  end?: ReactNode
  onToggle?: (columnIds: string[], visible: boolean) => void
}) => {
  const state = getCheckState(node)
  const disabled = !node.leaves.some(leaf => leaf.getCanHide())

  return (
    <PopupItem
      render={<label />}
      className={styles.row}
      style={{
        paddingInlineStart: `calc(var(--tsr-comp-popup-item-padding-x) + ${node.depth + 1} * var(--tsr-tree-indent))`,
      }}
      data-disabled={disabled || undefined}
      end={end}
    >
      <Checkbox
        className="row-select-checkbox"
        checked={state === 'checked'}
        indeterminate={state === 'indeterminate'}
        disabled={disabled}
        label={name}
        // Меню — в композите тулбара: без tabIndex галочки выпали бы из порядка Tab.
        tabIndex={disabled ? undefined : 0}
        onCheckedChange={(_, event) => {
          const toggle = getToggle(node)
          if (!toggle) return
          reportAction(table, {
            plugin: 'columnVisibility',
            action,
            detail: { columnIds: toggle.columnIds, visible: toggle.visible },
            source: sourceOf(event),
          })
          setColumnsVisible(table, toggle.columnIds, toggle.visible)
          onToggle?.(toggle.columnIds, toggle.visible)
        }}
      />
      <Tooltip title={label} overflowOnly>
        <span className={styles.label} data-option-label="">
          {label}
        </span>
      </Tooltip>
    </PopupItem>
  )
}

/**
 * Справа у скрытой колонки с преобразованиями (ADR 0204, §3): одна кнопка-ластик в активном
 * цвете — тултип называет, что с колонкой сейчас, нажатие всё снимает; у только что скрытой —
 * перед ней подсказка «остаются».
 */
const HiddenTransforms = ({
  columnId,
  transforms,
  kept,
  table,
  labels,
  onCleared,
}: {
  columnId: string
  transforms: ShownColumnTransform[]
  kept: boolean
  table: VisibilityControlTable
  labels: TableLabels
  onCleared: () => void
}) => {
  const { clearColumnTransforms: EraserIcon } = useIcons()
  const names = transforms.map(t => t.name)
  return (
    <span className={styles.trailing}>
      {kept && (
        <span className={styles.kept} data-transforms-kept="">
          {capitalized(
            columnVisibilityLabels(labels).transformsKept(names, names.length),
          )}
        </span>
      )}
      <ItemButton
        active
        indicator={false}
        label={columnVisibilityLabels(labels).activeTransforms(
          capitalized(transforms.map(t => t.description).join(', ')),
        )}
        data-testid="column-visibility-clear-transforms"
        data-transforms={transforms.map(t => t.kind).join(' ')}
        onClick={event => {
          // Кнопка уходит: фокус — на флажок той же колонки, а не туда, куда его бросит движок.
          event.currentTarget
            .closest('li')
            ?.querySelector<HTMLElement>('.row-select-checkbox')
            ?.focus()
          clearHiddenTransforms(table, columnId, sourceOf(event))
          onCleared()
        }}
      >
        <EraserIcon />
      </ItemButton>
    </span>
  )
}

const ColumnRow = ({
  row: { node, branch },
  table,
  top,
  labels,
  kept,
  onToggle,
  onCleared,
}: {
  row: TreeRow
  table: VisibilityControlTable
  top: number
  labels: TableLabels
  /** Колонку скрыли в этом меню: перед кнопкой — подсказка «остаются» (HT6). */
  kept: boolean
  onToggle: (columnIds: string[], visible: boolean) => void
  onCleared: (columnId: string) => void
}) => {
  // Преобразования — только у скрытого листа: у видимой колонки они видны в шапке.
  const hidden =
    node.children.length === 0 && node.leaves[0]?.getIsVisible() === false
  const transforms = hidden
    ? describeColumnTransforms(table, node.id, labels)
    : []
  const name =
    transforms.length > 0
      ? [
          node.label,
          columnVisibilityLabels(labels).hiddenColumn,
          ...transforms.map(t => t.description),
        ].join(', ')
      : node.label
  return (
    <li
      className={styles.item}
      style={{ transform: `translateY(${top}px)` }}
      data-column-id={node.id}
      data-column-group={node.children.length > 0 || undefined}
    >
      <CheckRow
        node={node}
        label={node.label}
        name={name}
        table={table}
        action="toggleColumn"
        onToggle={onToggle}
        end={
          transforms.length > 0 ? (
            <HiddenTransforms
              columnId={node.id}
              transforms={transforms}
              kept={kept}
              table={table}
              labels={labels}
              onCleared={() => onCleared(node.id)}
            />
          ) : undefined
        }
      />
      {/* После строки: подложка наведения не закрывает линии. */}
      <TreeLines branch={branch} open={node.children.length > 0} />
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
  const scrollerRef = useScrollFade(scrollRef)

  // Перерисовка на смену видимости, порядка, закрепления и преобразований (ADR 0204).
  const { pinning } = useTableState(table, state => ({
    visibility: state.columnVisibility,
    order: state.columnOrder,
    pinning: state.columnPinning,
    sorting: (state as { sorting?: unknown }).sorting,
    columnFilters: (state as { columnFilters?: unknown }).columnFilters,
    grouping: (state as { grouping?: unknown }).grouping,
  }))
  // Колонки, скрытые в этом меню, — у них подсказка «остаются» вместо значков (HT6).
  const [kept, setKept] = useState<ReadonlySet<string>>(() => new Set())
  const onToggle = (columnIds: string[], visible: boolean) => {
    setKept(current => {
      const next = new Set(current)
      for (const id of columnIds) {
        if (visible) next.delete(id)
        else next.add(id)
      }
      return next
    })
    if (!visible) {
      const leaves = table.getAllLeafColumnsById()
      announceKeptTransforms(
        table,
        columnIds.map(id => ({
          id,
          label: leaves[id] ? labelOf(leaves[id]) : id,
        })),
      )
    }
  }
  const onCleared = (columnId: string) =>
    setKept(current => {
      if (!current.has(columnId)) return current
      const next = new Set(current)
      next.delete(columnId)
      return next
    })

  const control = table as unknown as VisibilityControlTable
  const leafColumns = control.getAllLeafColumns()
  // Узлы хранят колонки; галочки читают их текущую видимость отдельно от дерева.
  const tree = useMemo(
    () => buildColumnTree({ getAllLeafColumns: () => leafColumns }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- getIsPinned читает срез внутри колонки
    [leafColumns, pinning],
  )
  const { found, rows } = useMemo(() => {
    const found = filterColumnTree(tree, query)
    return { found, rows: flatten(found) }
  }, [tree, query])

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
    // Первая страница строк — сразу, до измерения поповера.
    initialRect: { width: 0, height: MAX_VISIBLE_ROWS * ROW_HEIGHT },
  })

  return (
    <PopupPanel
      className={styles.menu}
      footerClassName={styles.footer}
      footer={
        <>
          <span className={styles.count} data-testid="column-visibility-count">
            {columnVisibilityLabels(labels).selectedColumns(
              countVisibleColumns(control),
            )}
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
            {columnVisibilityLabels(labels).resetColumns}
          </Button>
        </>
      }
    >
      <SearchField
        className={styles.search}
        clear={
          query === ''
            ? undefined
            : {
                label: optionsLabels(labels).clearSearch,
                onClick: () => {
                  setQuery('')
                  searchRef?.current?.focus()
                },
                'data-testid': 'column-visibility-clear-search',
              }
        }
      >
        <Field
          ref={searchRef}
          type="search"
          value={query}
          placeholder={columnVisibilityLabels(labels).searchColumns}
          aria-label={columnVisibilityLabels(labels).searchColumns}
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
      </SearchField>
      {rows.length > 0 ? (
        <div className={styles.columns}>
          <div className={styles.root} data-testid="column-visibility-all">
            <CheckRow
              node={getRootNode(found)}
              label={columnVisibilityLabels(labels).allColumns}
              table={control}
              action="toggleAll"
              onToggle={onToggle}
            />
            <TreeLines branch="" open />
          </div>
          <div
            ref={scrollerRef}
            className={styles.scroller}
            data-popup-scroller=""
          >
            <ul
              className={styles.tree}
              style={{ height: virtualizer.getTotalSize() }}
              aria-label={columnVisibilityLabels(labels).columns}
            >
              {virtualizer.getVirtualItems().map(item => (
                <ColumnRow
                  key={`${rows[item.index].node.id}-${item.index}`}
                  row={rows[item.index]}
                  table={control}
                  top={item.start}
                  labels={labels}
                  kept={kept.has(rows[item.index].node.id)}
                  onToggle={onToggle}
                  onCleared={onCleared}
                />
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <p className={styles.empty} role="status">
          {columnVisibilityLabels(labels).noColumnsFound}
        </p>
      )}
    </PopupPanel>
  )
}
