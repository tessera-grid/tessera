import type { CSSProperties } from 'react'

import clsx from 'clsx'
import type { VirtualItem } from '@tanstack/react-virtual'

import {
  isTreeGrid,
  type KeyboardNavigationGrid,
} from '../core/keyboardNavigation'
import { getRowWindow } from '../core/pagination'
import { RenderSlot } from '../core/renderSlots'
import type { Column, HeaderGroup, Row, Table } from '../types'
import { BodyDndBoundary } from './DndBodyWrapper'
import { MemoizedBody } from './Body'
import { MemoizedFooter } from './Footer'
import { HeadDndBoundary } from './DndHeadWrapper'
import { MemoizedHead } from './Head'
import { SkeletonBody } from './SkeletonBody'
import { SkeletonModeContext } from './skeletonMode'

import dataGridStyles from '../grid/DataGrid/DataGrid.module.css'

interface DataGridTableProps {
  table: Table<any, any>
  layout: 'grid' | 'flex'
  headStyles?: CSSProperties
  headerGroups: HeaderGroup<any, any>[]
  rows: Row<any, any>[]
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
  style,
}: DataGridTableProps) => {
  const options = table.options as any
  const enableRowDragging = !!options.enableRowDragging
  const enableColumnDragging = !!options.enableColumnDragging
  // rowSelection даёт функциональный enableRowSelection (гейт группировки), выкл — false.
  const enableRowSelection = !!options.enableRowSelection
  // Иерархия строк (rowExpanding / rowGrouping) — с клавиатурной навигацией грид
  // становится treegrid (ADR 0032, W10).
  const hierarchical = isTreeGrid(table)
  // Страница — окно полного набора: число строк и индексы сквозные (ADR 0038, PG15).
  const rowWindow = getRowWindow(table, rows)

  const {
    leftHeaderSlot,
    rightHeaderSlot,
    leftCellSlot,
    rightCellSlot,
    cellSlot,
    actionRowSlot,
    bodyEndSlot,
  } = table.getRenderSlots() ?? {}
  // Плагин, у которого строк больше, чем в data, задаёт итог сам (ADR 0081).
  const totalRowCount = options.getTotalRowCount?.(table) as number | undefined
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

  return (
    <div
      {...tableAria}
      className={clsx('data-grid__table', dataGridStyles.table)}
      style={style}
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
            layout={layout}
            rows={rows}
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
          />
        </BodyDndBoundary>
      )}
      {!skeleton && (
        <RenderSlot
          slot={bodyEndSlot}
          context={{
            table,
            layout,
            leafColumns,
            virtualColumns,
            isVirtualColumns,
            nextAriaRowIndex:
              headerGroups.length + rowWindow.offset + rows.length + 1,
          }}
        />
      )}
      {options.enableFooter && !skeleton && (
        <MemoizedFooter
          layout={layout}
          footerGroup={table.getFooterGroups().at(0)}
          virtualColumns={virtualColumns}
          isVirtualColumns={isVirtualColumns}
          isResizingColumns={isResizingColumns}
        />
      )}
    </div>
  )
}
