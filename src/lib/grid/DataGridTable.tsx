import type { CSSProperties } from 'react'

import clsx from 'clsx'
import type { VirtualItem } from '@tanstack/react-virtual'

import {
  isTreeGrid,
  type KeyboardNavigationGrid,
} from '../core/keyboardNavigation'
import type { Column, HeaderGroup, Row, Table } from '../types'
import { BodyDndBoundary } from './DndBodyWrapper'
import { MemoizedBody } from './Body'
import { MemoizedFooter } from './Footer'
import { HeadDndBoundary } from './DndHeadWrapper'
import { MemoizedHead } from './Head'

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

  const {
    leftHeaderSlot,
    rightHeaderSlot,
    leftCellSlot,
    rightCellSlot,
    cellSlot,
    actionRowSlot,
  } = table.getRenderSlots() ?? {}

  return (
    <div
      role={keyboardNavigation ? (hierarchical ? 'treegrid' : 'grid') : 'table'}
      aria-label={label}
      aria-busy={busy || undefined}
      aria-rowcount={headerGroups.length + rows.length}
      aria-colcount={leafColumns.length}
      className={clsx('data-grid__table', dataGridStyles.table)}
      aria-multiselectable={
        keyboardNavigation &&
        (enableRowSelection || !!options.enableCellSelection)
          ? true
          : undefined
      }
      onKeyDown={keyboardNavigation?.onKeyDown}
      onFocusCapture={keyboardNavigation?.onFocusCapture}
      onPointerDownCapture={keyboardNavigation?.onPointerDownCapture}
      style={style}
    >
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
        />
      </HeadDndBoundary>
      <BodyDndBoundary table={table} enableRowDragging={enableRowDragging}>
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
          headerRowCount={headerGroups.length}
          selectableRows={!!keyboardNavigation && enableRowSelection}
          treeRows={!!keyboardNavigation && hierarchical}
          isResizingColumns={isResizingColumns}
          isVirtualColumns={isVirtualColumns}
          enableRowDragging={enableRowDragging}
        />
      </BodyDndBoundary>
      {options.enableFooter && (
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
