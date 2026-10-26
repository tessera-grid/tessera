import { type CSSProperties, type ReactNode, useRef } from 'react'
import { serverRowModelReason } from '../core/pluginDiagnostics'

import clsx from 'clsx'
import type { VirtualItem } from '../../vendor/tanstack-virtual/react-virtual'

import {
  isTreeGrid,
  type KeyboardNavigationGrid,
} from '../core/keyboardNavigation'
import { getDisplayColumns } from '../core/displayColumns'
import { getFooterPosition } from '../core/footer'
import { getRowWindow } from '../core/pagination'
import type { RowSource } from '../core/rowSource'
import { RenderSlot } from '../core/renderSlots'
import { useTableState } from '../core/reactivity'
import type { Column, HeaderGroup, Row, Table } from '../types'
import { ColumnMotion } from './columnMotion/ColumnMotion'
import { BodyDndBoundary } from './DndBodyWrapper'
import { type DropPreview, MemoizedBody } from './Body'
import type { RowDragOverlayState } from '../plugins/rowDragging/types'
import { MemoizedFooter } from './Footer'
import { HeadDndBoundary } from './DndHeadWrapper'
import { MemoizedHead } from './Head'
import { SkeletonBody } from './SkeletonBody'
import { SkeletonModeContext } from './skeletonMode'
import { TableEndRow } from './TableEndRow'

import dataGridStyles from '../grid/DataGrid/DataGrid.module.css'

interface DataGridTableProps {
  table: Table<any, any>
  layout: 'grid' | 'flex'
  headStyles?: CSSProperties
  headerGroups: HeaderGroup<any, any>[]
  rows: Row<any, any>[]
  /** Строки тела по индексу (ADR 0138); `rows` — весь список, если он загружен целиком. */
  rowSource: RowSource<Row<any, any>>
  leafColumns: Column<any, any, unknown>[]
  virtualRows: VirtualItem[]
  virtualColumns: VirtualItem[]
  isVirtualColumns: boolean
  isResizingColumns: false | string
  keyboardNavigation: KeyboardNavigationGrid | null
  label: string
  busy: boolean
  /** Скелет первой загрузки (ADR 0060): та же шапка, лёгкие тело и футер. */
  skeleton: boolean
  /** Статус «Loading» скелета. */
  loadingLabel: string
  /** Заглушка пустой таблицы перед футером (ADR 0118, §3). */
  endContent?: ReactNode
  style: CSSProperties
}

/**
 * Таблица грида: роль и aria-атрибуты корня, шапка, тело и футер в DnD-обёртках.
 * Флаги плагинов и слоты читает из опций таблицы.
 */
export const DataGridTable = ({
  table,
  layout,
  headStyles,
  headerGroups,
  rows,
  rowSource,
  leafColumns,
  virtualRows,
  virtualColumns,
  isVirtualColumns,
  isResizingColumns,
  keyboardNavigation,
  label,
  busy,
  skeleton,
  loadingLabel,
  endContent,
  style,
}: DataGridTableProps) => {
  const options = table.options as any
  // В серверной модели строк перетаскивание инертно: массива строк для dnd-kit нет (ADR 0138).
  const enableRowDragging =
    !!options.enableRowDragging && !serverRowModelReason(table)
  const enableColumnDragging = !!options.enableColumnDragging
  // rowSelection даёт функциональный enableRowSelection (гейт группировки), выкл — false.
  const enableRowSelection = !!options.enableRowSelection
  // Иерархия строк (rowExpanding / rowGrouping) — с клавиатурной навигацией грид
  // становится treegrid (ADR 0032, W10).
  const hierarchical = isTreeGrid(table)
  // Страница — окно полного набора: число строк и индексы сквозные (ADR 0038, PG15).
  // Превью броска строки (ADR 0108): меняется на каждую смену места, только пока тащат.
  const dropPreview = useTableState(table as never, (state: unknown) => {
    const drag = (state as { rowDragging?: RowDragOverlayState }).rowDragging
    return drag?.activeId != null &&
      drag.fromIndex != null &&
      drag.overIndex != null
      ? {
          activeId: String(drag.activeId),
          from: drag.fromIndex,
          to: drag.overIndex,
          depth: drag.depth,
          acceptable: drag.acceptable,
        }
      : null
  }) as DropPreview | null

  const rowWindow = getRowWindow(table, rows)
  const rootRef = useRef<HTMLDivElement>(null)

  const {
    leftHeaderSlot,
    rightHeaderSlot,
    leftCellSlot,
    rightCellSlot,
    cellSlot,
    actionRowSlot,
    bodyEndSlot,
    tableEndSlot,
  } = table.getRenderSlots() ?? {}
  // Плагин, у которого строк больше, чем в data, задаёт итог сам (ADR 0081); источник
  // строк серверной модели знает его лучше опций плагинов (ADR 0138, §8).
  const totalRowCount = (rowSource.total?.() ??
    options.getTotalRowCount?.(table)) as number | undefined
  const ariaRowCount =
    totalRowCount === -1
      ? -1
      : headerGroups.length + Math.max(totalRowCount ?? 0, rowWindow.total)
  const bodyBusy = !!options.getBodyBusy?.(table.store.get())

  // Скелет — не таблица с данными: без роли и aria таблицы, загрузку объявляет статус.
  const tableAria = skeleton
    ? undefined
    : {
        role: keyboardNavigation
          ? hierarchical
            ? 'treegrid'
            : 'grid'
          : 'table',
        'aria-label': label,
        'aria-busy': busy || bodyBusy || undefined,
        'aria-rowcount': ariaRowCount,
        'aria-colcount': leafColumns.length,
        'aria-multiselectable':
          keyboardNavigation &&
          (enableRowSelection || !!options.enableCellSelection)
            ? true
            : undefined,
        onKeyDown: keyboardNavigation?.onKeyDown,
        onFocusCapture: keyboardNavigation?.onFocusCapture,
        onPointerDownCapture: keyboardNavigation?.onPointerDownCapture,
      }

  // Футер у низа области или за последней строкой (ADR 0118); скелет — всегда у низа.
  const footer = !!options.enableFooter
  const footerPosition = getFooterPosition(table)
  const footerInline = footer && footerPosition === 'inline' && !skeleton
  const endContext = {
    table,
    layout,
    leafColumns,
    virtualColumns,
    isVirtualColumns,
    nextAriaRowIndex:
      headerGroups.length + rowWindow.offset + rowSource.count() + 1,
  }
  // Конец таблицы — до закреплённого футера и после незакреплённого, заглушка — всегда
  // перед футером (ADR 0118, §3).
  const tableEnd = skeleton ? null : (
    <RenderSlot slot={tableEndSlot} context={endContext} />
  )
  const stubRow =
    skeleton || endContent == null ? null : (
      <TableEndRow
        navigable={!!keyboardNavigation}
        columnCount={leafColumns.length}
      >
        {endContent}
      </TableEndRow>
    )

  return (
    <div
      {...tableAria}
      ref={rootRef}
      className={clsx('data-grid__table', dataGridStyles.table)}
      data-footer-position={
        footer ? (skeleton ? 'pinned' : footerPosition) : undefined
      }
      style={style}
    >
      <ColumnMotion
        enabled={options.enableColumnAnimation !== false && !skeleton}
        columns={
          getDisplayColumns<Column<any, any, unknown>>(table as never).columns
        }
        pinning={
          (table.store.get() as { columnPinning?: unknown }).columnPinning
        }
        isVirtualColumns={isVirtualColumns}
        rootRef={rootRef}
      >
        {skeleton && (
          <span role="status" className={dataGridStyles['visually-hidden']}>
            {loadingLabel}
          </span>
        )}
        <SkeletonModeContext.Provider value={skeleton}>
          <HeadDndBoundary
            table={table}
            leftHeaderSlot={leftHeaderSlot}
            rightHeaderSlot={rightHeaderSlot}
            enableColumnDragging={enableColumnDragging}
          >
            <MemoizedHead
              layout={layout}
              style={headStyles}
              headerGroups={headerGroups}
              virtualColumns={virtualColumns}
              leftHeaderSlot={leftHeaderSlot}
              rightHeaderSlot={rightHeaderSlot}
              isResizingColumns={isResizingColumns}
              isVirtualColumns={isVirtualColumns}
              enableColumnDragging={enableColumnDragging}
              skeleton={skeleton}
            />
          </HeadDndBoundary>
        </SkeletonModeContext.Provider>
        {skeleton ? (
          <SkeletonBody
            table={table}
            layout={layout}
            leafColumns={leafColumns}
            virtualColumns={virtualColumns}
            isVirtualColumns={isVirtualColumns}
          />
        ) : (
          <BodyDndBoundary
            table={table}
            enableRowDragging={enableRowDragging}
            virtualRows={virtualRows}
          >
            <MemoizedBody
              dropPreview={dropPreview}
              layout={layout}
              table={table}
              rows={rows}
              rowSource={rowSource}
              virtualRows={virtualRows}
              virtualColumns={virtualColumns}
              leafColumns={leafColumns}
              leftCellSlot={leftCellSlot}
              rightCellSlot={rightCellSlot}
              cellSlot={cellSlot}
              actionRowSlot={actionRowSlot}
              ariaRowIndexBase={headerGroups.length + rowWindow.offset}
              selectableRows={!!keyboardNavigation && enableRowSelection}
              treeRows={!!keyboardNavigation && hierarchical}
              treeLines={
                (table.options as { enableTreeLines?: boolean }).enableTreeLines
              }
              isResizingColumns={isResizingColumns}
              isVirtualColumns={isVirtualColumns}
              enableRowDragging={enableRowDragging}
              rowAnimation={
                options.enableRowAnimation !== false && !!rowSource.rows
              }
            />
          </BodyDndBoundary>
        )}
        {!skeleton && <RenderSlot slot={bodyEndSlot} context={endContext} />}
        {!footerInline && tableEnd}
        {stubRow}
        {footer && !skeleton && (
          <MemoizedFooter
            layout={layout}
            position={footerPosition}
            footerGroup={table.getFooterGroups().at(0)}
            virtualColumns={virtualColumns}
            isVirtualColumns={isVirtualColumns}
            isResizingColumns={isResizingColumns}
          />
        )}
        {footerInline && tableEnd}
      </ColumnMotion>
    </div>
  )
}
