import { CSSProperties, useCallback, useMemo, useRef } from 'react'

import { Column } from '@tanstack/react-table'
import clsx from 'clsx'

import { useCalculateColumnSizes } from '../../core/createColumns'
import { FastScrollProvider, useFastScroll } from '../../core/fastScroll'
import { useSkeletonOverlayState } from '../../core/skeletonOverlay/state'
import { SubscriptionStoreProvider } from '../../core/subscribeStore'
import { DATA_GRID_THEME_CLASS } from '../../core/themeVariables'
import {
  useColumnVirtualizer,
  useColumnVirtualizerScroll,
  useRowVirtualizer,
} from '../../core/virtualization'
import { DEFAULT_LABELS, LocalizationProvider } from '../../core/localization'
import { getRowDraggableStyles } from '../../plugins/rowDragging'
import { IconsProvider } from '../../ui/icons'
import { BodyDndBoundary, MemoizedBody } from '../Body'
import { MemoizedFooter } from '../Footer'
import { HeadDndBoundary, MemoizedHead } from '../Head'
import { LinearProgress } from '../../ui/LinearProgress'
import { SkeletonOverlay } from '../SkeletonOverlay'
import { getTableHeight } from './getTableHeight'
import { getGridLayout } from './gridLayout'
import { useScrollbarWidthVar } from './useScrollbarWidthVar'
import { DataGridProps } from './types'

import dataGridStyles from './DataGrid.module.css'
// Токены темы (`:where(.data-grid-theme)`: --tsr-ref/sys/comp, light/dark).
// Импортируем как ГЛОБАЛЬНЫЙ (не-модульный) CSS side-effect отсюда — из
// удерживаемого в графе компонента, — чтобы классы `data-grid-theme`/`dark`
// шиппились НЕ захешированными (через @import в .module.css их скоупит CSS Modules).
import '../../core/themeVariables/theme.css'

/**
 * @description
 * Основной компонент таблицы.
 * Ожидает инстанс таблицы, задаваемую высоту таблицы, а также ReactNode для слота заглушки при отсутствии данных с различным наполнением.
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
  const headerGroups = table.getHeaderGroups()
  const leafColumns: Column<any, unknown>[] = table.getVisibleLeafColumns()

  const { rows } = table.getRowModel()

  const { columnSizingInfo, rowDragging } = table.getState()

  const enableRowDragging = !!table.options.enableRowDragging
  const enableColumnDragging = !!table.options.enableColumnDragging

  const scrollableNodeRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const getScrollElement = useCallback(() => scrollableNodeRef.current, [])

  const columnSizes = useCalculateColumnSizes({ table })
  const isResizingColumns = columnSizingInfo.isResizingColumn

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

  // rowDragging — uncontrolled слайс плагина rowDragging (ADR 0010): при
  // отсутствии плагина его нет в state, поэтому читаем через ?. с дефолтами.
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
    actionRowSlot,
  } = table.getRenderSlots()

  const { showSkeletonOverlay } = useSkeletonOverlayState(
    table.options.enableSkeleton,
  )

  const noData = !showSkeletonOverlay && rows.length === 0
  const showStub = noData && !!stub

  const showLinearProgress = table.options.enableLoading && !showSkeletonOverlay

  // Feed the real scrollbar width into a CSS var so the linear progress bar
  // lines up with the content edge regardless of the browser / consumer's
  // scrollbar. Disabled on the stub path (no scroller wrapper, no loader).
  useScrollbarWidthVar(getScrollElement, wrapperRef, !showStub)

  const containerStyles = getTableHeight({ height, maxHeight })
  // Дефолты токенов темы (`--tsr-comp-*`) объявлены в theme.css на классе
  // `.data-grid-theme` (нулевая специфичность), поэтому здесь инлайн — только
  // РАНТАЙМ-переменные (высоты шапки/тела, drag-офсеты) и переданный потребителем
  // `style`. Инлайн-стиль потребителя бьёт дефолты слоя — так `--tsr-comp-*`
  // переопределяются пер-инстансно, а глобально — обычным CSS-правилом на
  // `.data-grid-theme`.
  const wrapperStyles = {
    ...({
      '--tsr-comp-head-height': `${headerGroupsDepth * 50 + headerGroupsDepth}px`,
      '--tsr-comp-body-height': `${bodyHeight}px`,
    } as CSSProperties),
    ...draggableCssVariables,
    ...containerStyles,
    ...style,
  }

  // Класс `dark` флипает тёмные роли semantic-уровня `--tsr-sys-*` из theme.css
  // (и, если у потребителя shadcn с плоским `.dark {…}`, — заодно его апстрим-
  // токены), из которых выводятся все --tsr-comp-*; `data-grid-theme` несёт дефолты.
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
        <SubscriptionStoreProvider table={table}>
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
                        actionRowSlot={actionRowSlot}
                        headerRowCount={headerGroupsDepth}
                        isResizingColumns={isResizingColumns}
                        isVirtualColumns={!hasNestedGroups}
                        enableRowDragging={enableRowDragging}
                      />
                    </BodyDndBoundary>
                    {table.options.enableFooter && (
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
        </SubscriptionStoreProvider>
      </LocalizationProvider>
    </IconsProvider>
  )
}
