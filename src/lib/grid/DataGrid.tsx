// Корневой DataGrid: реактивность через table.atoms/store (useTableState/useSlice
// в компонентах). Стейт-снимки (isResizingColumns/rowDragging) читаются реактивно
// из общего store.
import {
  type ClipboardEvent as ReactClipboardEvent,
  type CSSProperties,
  useCallback,
  useMemo,
  useRef,
} from 'react'

import clsx from 'clsx'

import { FastScrollProvider, useFastScroll } from '../core/fastScroll'
import {
  cellRangesToHtml,
  cellRangesToTsv,
  hasSelectedCells,
} from '../core/clipboard'
import { useCellSelectionAutoScroll } from '../core/cellSelectionAutoScroll'
import { DATA_GRID_THEME_CLASS } from '../core/themeVariables'
import { DEFAULT_LABELS, LocalizationProvider } from '../core/localization'
import { IconsProvider } from '../ui/icons'
import { LinearProgress } from '../ui/LinearProgress'
import type { Column } from '../types'
import { useTableState } from '../core/reactivity'
import { useSkeletonOverlayState } from '../core/skeletonOverlay'
import {
  useColumnVirtualizer,
  useColumnVirtualizerScroll,
  useRowVirtualizer,
} from '../core/virtualization'
import { getRowDraggableStyles } from '../plugins/rowDragging'
import { useCalculateColumnSizes } from './useCalculateColumnSizes'
import { BodyDndBoundary } from './DndBodyWrapper'
import { MemoizedBody } from './Body'
import { MemoizedFooter } from './Footer'
import { HeadDndBoundary } from './DndHeadWrapper'
import { MemoizedHead } from './Head'
import { SkeletonOverlay } from './SkeletonOverlay'
import { getTableHeight } from './getTableHeight'
import { getGridLayout } from './layout'
import { useScrollbarWidthVar } from './useScrollbarWidthVar'
import type { DataGridProps } from './dataGridTypes'

import dataGridStyles from '../grid/DataGrid/DataGrid.module.css'
// Токены темы (`.data-grid-theme`: --tsr-ref/sys/comp, light/dark) как ГЛОБАЛЬНЫЙ
// (не-модульный) CSS side-effect отсюда — чтобы классы шиппились не захешированными.
import '../core/themeVariables/theme.css'

/**
 * Основной компонент таблицы. Ожидает инстанс таблицы (useCreateTable), высоту и
 * ReactNode-заглушку при отсутствии данных.
 */
export const DataGrid = ({
  table,
  height = '100%',
  maxHeight = '100%',
  stub,
  colorMode = 'light',
  icons,
  localization,
  className,
  style,
}: DataGridProps) => {
  // Реактивная подписка корня на СТРУКТУРНЫЕ срезы (всё, кроме rowSelection): смена
  // выбора строк не перестраивает раскладку/модель — её несут сами строки и чекбоксы
  // (useSelector в компонентах), поэтому корню на неё ре-рендериться незачем. Прочие
  // срезы (пиннинг/порядок/сортировка/группировка/раскрытие/размеры…) меняют шапку/
  // тело/модель — на них корень ре-рендерится (shallow по top-level ключам).
  const state = useTableState(table, s => {
    const {
      rowSelection: _rowSelection,
      cellSelection: _cellSelection,
      ...rest
    } = s as unknown as Record<string, unknown>
    return rest
  }) as Record<string, any>

  const headerGroups = table.getHeaderGroups()
  const leafColumns: Column<any, any, unknown>[] = table.getVisibleLeafColumns()

  const { rows } = table.getRowModel()

  const isResizingColumns: false | string =
    state.columnResizing?.isResizingColumn ?? false
  const rowDragging = state.rowDragging as
    | { activeId: string | null; acceptable: boolean; offsetLeft: number }
    | undefined

  const enableRowDragging = !!(table.options as any).enableRowDragging
  const enableColumnDragging = !!(table.options as any).enableColumnDragging

  const scrollableNodeRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const getScrollElement = useCallback(() => scrollableNodeRef.current, [])

  // Авто-прокрутка при drag-выделении ячеек у края/за пределами таблицы (инертно
  // без плагина cellSelection). См. core/cellSelectionAutoScroll.
  useCellSelectionAutoScroll(table, getScrollElement)

  // Копирование выделения ячеек в буфер. Инертно без плагина cellSelection:
  // getSelectedCellRangesData есть только когда зарегистрирована stock-фича
  // (ядро плагин не импортит — читаем duck-typed, ADR 0029). Нативное copy-событие
  // всплывает от сфокусированной ячейки; текстовое выделение пользователя не трогаем.
  const getRanges = (table as any).getSelectedCellRangesData as
    | (() => unknown[][][])
    | undefined
  const handleCopy = useCallback(
    (event: ReactClipboardEvent<HTMLDivElement>) => {
      if (typeof getRanges !== 'function') {
        return
      }
      const textSelection = window.getSelection?.()
      if (textSelection && !textSelection.isCollapsed && textSelection.toString()) {
        return
      }
      const regions = getRanges()
      if (!hasSelectedCells(regions)) {
        return
      }
      event.preventDefault()
      event.clipboardData.setData('text/plain', cellRangesToTsv(regions))
      event.clipboardData.setData('text/html', cellRangesToHtml(regions))
    },
    [getRanges],
  )

  const columnSizes = useCalculateColumnSizes({ table })

  const headerGroupsDepth = headerGroups.length
  const hasNestedGroups = headerGroupsDepth > 1

  const tableLabel = localization?.table ?? DEFAULT_LABELS.table

  const layout = hasNestedGroups ? 'grid' : 'flex'
  const headStyles = getGridLayout({
    layout,
    headerGroups,
    leafColumns,
  })

  const { virtualColumns, bodyWidth } = useColumnVirtualizer({
    table,
    getScrollElement,
    enabled: !hasNestedGroups,
  })

  const { virtualRows, bodyHeight } = useRowVirtualizer({
    table,
    getScrollElement,
  })

  const fastScrollStore = useFastScroll({ getScrollElement })

  const virtualPaddingStyles = useColumnVirtualizerScroll({
    table,
    virtualColumns,
    columnsTotalSize: bodyWidth,
  })

  // rowDragging — uncontrolled слайс плагина rowDragging: при отсутствии
  // плагина его нет в store, читаем через ?. с дефолтами.
  const draggableCssVariables = useMemo(
    () =>
      getRowDraggableStyles({
        activeId: rowDragging?.activeId ?? null,
        acceptable: rowDragging?.acceptable ?? true,
        offsetLeft: rowDragging?.offsetLeft ?? 0,
      }),
    [rowDragging?.activeId, rowDragging?.acceptable, rowDragging?.offsetLeft],
  )

  const {
    leftHeaderSlot,
    rightHeaderSlot,
    leftCellSlot,
    rightCellSlot,
    cellSlot,
    actionRowSlot,
  } = table.getRenderSlots() ?? {}

  const { showSkeletonOverlay } = useSkeletonOverlayState(
    (table.options as any).enableSkeleton,
  )

  const noData = !showSkeletonOverlay && rows.length === 0
  const showStub = noData && !!stub

  const showLinearProgress =
    (table.options as any).enableLoading && !showSkeletonOverlay

  // Реальная ширина скроллбара в CSS-var — чтобы лоадер совпадал с краем контента.
  useScrollbarWidthVar(getScrollElement, wrapperRef, !showStub)

  const containerStyles = getTableHeight({ height, maxHeight })
  // Инлайн — только РАНТАЙМ-переменные (высоты шапки/тела, drag-офсеты) и
  // переданный потребителем style. Дефолты токенов темы объявлены в theme.css.
  const wrapperStyles = {
    ...({
      '--tsr-comp-head-height': `${headerGroupsDepth * 50 + headerGroupsDepth}px`,
      '--tsr-comp-body-height': `${bodyHeight}px`,
    } as CSSProperties),
    ...draggableCssVariables,
    ...containerStyles,
    ...style,
  }

  const themeClassName = clsx(DATA_GRID_THEME_CLASS, className, {
    dark: colorMode === 'dark',
  })

  if (showStub) {
    return (
      <div
        className={clsx(
          'MuiPaper-root',
          'MuiTableContainer-root',
          'MuiPaper-rounded',
          themeClassName,
        )}
        ref={scrollableNodeRef}
        style={{ ...containerStyles, ...style }}
      >
        <div className={dataGridStyles.table__stub}>{stub}</div>
      </div>
    )
  }

  return (
    <IconsProvider icons={icons}>
      <LocalizationProvider localization={localization}>
        <FastScrollProvider store={fastScrollStore}>
          <div
            ref={wrapperRef}
            className={clsx(
              dataGridStyles['table__theme-wrapper'],
              themeClassName,
            )}
            style={wrapperStyles}
          >
            {showLinearProgress && <LinearProgress />}
            <div
              className={clsx(
                'MuiPaper-root',
                'MuiTableContainer-root',
                dataGridStyles.table__container,
                {
                  [dataGridStyles['table__container--skeleton']]:
                    showSkeletonOverlay,
                },
              )}
              ref={scrollableNodeRef}
              data-resizing={isResizingColumns !== false}
              onCopy={handleCopy}
            >
              {showSkeletonOverlay ? (
                <SkeletonOverlay table={table} columnSizes={columnSizes} />
              ) : (
                <div
                  role="table"
                  aria-label={tableLabel}
                  aria-rowcount={headerGroupsDepth + rows.length}
                  aria-colcount={leafColumns.length}
                  className={clsx('MuiTable-root', dataGridStyles.table)}
                  style={{
                    ...columnSizes,
                    ...virtualPaddingStyles,
                  }}
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
                      isVirtualColumns={!hasNestedGroups}
                      enableColumnDragging={enableColumnDragging}
                    />
                  </HeadDndBoundary>
                  <BodyDndBoundary
                    table={table}
                    enableRowDragging={enableRowDragging}
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
                      headerRowCount={headerGroupsDepth}
                      isResizingColumns={isResizingColumns}
                      isVirtualColumns={!hasNestedGroups}
                      enableRowDragging={enableRowDragging}
                    />
                  </BodyDndBoundary>
                  {(table.options as any).enableFooter && (
                    <MemoizedFooter
                      layout={layout}
                      footerGroup={table.getFooterGroups().at(0)}
                      virtualColumns={virtualColumns}
                      isVirtualColumns={!hasNestedGroups}
                      isResizingColumns={isResizingColumns}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </FastScrollProvider>
      </LocalizationProvider>
    </IconsProvider>
  )
}
