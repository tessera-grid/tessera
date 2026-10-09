// Корневой DataGrid: реактивность через table.atoms/store (useTableState/useSlice
// в компонентах). Стейт-снимки (isResizingColumns/rowDragging) читаются реактивно
// из общего store.
import {
  type CSSProperties,
  lazy,
  Suspense,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react'

import clsx from 'clsx'

import { FastScrollProvider, useFastScroll } from '../core/fastScroll'
import { useCellSelectionAutoScroll } from '../core/cellSelectionAutoScroll'
import { useKeyboardNavigationGrid } from '../core/keyboardNavigation'
import { ContextMenu } from './contextMenu/ContextMenu'
import { OverflowTooltip } from './OverflowTooltip'
import {
  DATA_GRID_THEME_CLASS,
  PortalThemeProvider,
  portalThemeClass,
} from '../core/themeVariables'
import { DEFAULT_LABELS, LocalizationProvider } from '../core/localization'
import { LiveRegion } from './LiveRegion'
import { FilterStub } from './filtering/FilterStub'
import { isFilteringActive } from '../core/filtering'
import { PluginRenderVersionContext } from '../core/renderVersion'
import { usePageChange } from '../core/pagination'
import { IconsProvider } from '../ui/icons'
import { LinearProgress } from '../ui/LinearProgress'
import type { Column } from '../types'
import type { RenderSlots } from '../core/createSlots'
import { useTableState } from '../core/reactivity'
import { cancelColumnResize } from '../core/cancelInteraction'
import { countPanelSlots, resolvePanelVisible } from '../core/panels'
import {
  useColumnVirtualizer,
  useColumnVirtualizerScroll,
  useRowVirtualizer,
} from '../core/virtualization'
import { getRowDraggableStyles } from '../plugins/rowDragging'
import { useCalculateColumnSizes } from './useCalculateColumnSizes'
import { columnShiftVars } from './columnSizes'
import { useCellSelectionCopy } from './useCellSelectionCopy'
import { DataGridTable } from './DataGridTable'
import { StatusBar } from './StatusBar/StatusBar'
import { getTableHeight } from './getTableHeight'
import { getGridLayout } from './layout'
import { useScrollbarWidthVar } from './useScrollbarWidthVar'
import { useRowHeights } from './useRowHeights'
import { ScrollingAttribute } from './ScrollingAttribute'
import { ShimmerSync } from './ShimmerSync'
import type { DataGridProps } from './dataGridTypes'

import dataGridStyles from '../grid/DataGrid/DataGrid.module.css'
// Токены темы (`.data-grid-theme`: --tsr-ref/sys/comp, light/dark) как ГЛОБАЛЬНЫЙ
// (не-модульный) CSS side-effect отсюда — чтобы классы шиппились не захешированными.
import '../core/themeVariables/theme.css'

// Base UI Toolbar — около 6.5 KB gzip; грузим, только когда тулбар показывается.
const Toolbar = lazy(() =>
  import('./Toolbar/Toolbar').then(module => ({ default: module.Toolbar })),
)

/**
 * Основной компонент таблицы. Ожидает инстанс таблицы (useCreateTable), высоту и
 * ReactNode-заглушку при отсутствии данных.
 */
export const DataGrid = ({
  table,
  height = '100%',
  maxHeight = '100%',
  stub,
  filterStub,
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
      keyboardNavigation: _keyboardNavigation,
      ...rest
    } = s as unknown as Record<string, unknown>
    return rest
  }) as Record<string, any>

  const headerGroups = table.getHeaderGroups()
  const leafColumns: Column<any, any, unknown>[] = table.getVisibleLeafColumns()

  const { rows } = table.getRowModel()

  const isResizingColumns: false | string =
    state.columnResizing?.isResizingColumn ?? false
  // Колонку убрали или скрыли посреди протяжки — отмена с `unavailable` (ADR 0040,
  // SS15): шапка на время протяжки заморожена и сама этого не увидит.
  const resizeLost =
    isResizingColumns !== false &&
    !leafColumns.some(column => column.id === isResizingColumns)
  useLayoutEffect(() => {
    if (resizeLost) {
      cancelColumnResize(table, 'unavailable')
    }
  }, [resizeLost, table])
  const rowDragging = state.rowDragging as
    | { activeId: string | null; acceptable: boolean; offsetLeft: number }
    | undefined

  const enableContextMenu = !!(table.options as any).enableContextMenu
  const enableOverflowTooltip =
    (table.options as any).enableOverflowTooltip !== false
  const renderVersion = ((table.options as any).pluginRenderVersion ??
    0) as number
  // Панели включают слоты плагинов; флаг их переопределяет (ADR 0046).
  const renderSlots = (table.getRenderSlots as () => RenderSlots | undefined)()
  const statusBarSlot = renderSlots?.statusBarSlot ?? []
  const enableToolbar = resolvePanelVisible(
    (table.options as any).enableToolbar,
    renderSlots?.toolbarSlot.length ?? 0,
  )
  const hasStatusBar = resolvePanelVisible(
    (table.options as any).enableStatusBar,
    countPanelSlots(statusBarSlot),
  )

  const scrollableNodeRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const getScrollElement = useCallback(() => scrollableNodeRef.current, [])
  // Ключ перечитывания токенов: тема и появление корня (без строк — ветка заглушки).
  const heights = useRowHeights(
    table,
    wrapperRef,
    `${colorMode}|${className}|${rows.length > 0}`,
  )

  // Авто-прокрутка при drag-выделении ячеек у края/за пределами таблицы (инертно
  // без плагина cellSelection). См. core/cellSelectionAutoScroll.
  useCellSelectionAutoScroll(table, getScrollElement)

  const handleCopy = useCellSelectionCopy(table)

  // Клавиатурная навигация (плагин keyboardNavigation): роль grid + резолвер клавиш
  // на корне. `null` без плагина — остаётся role=table без обработчиков.
  const keyboardNavigation = useKeyboardNavigationGrid(table, getScrollElement)
  const guardBeforeRef = keyboardNavigation?.guardBeforeRef
  const guardAfterRef = keyboardNavigation?.guardAfterRef

  // Смена страницы: тело к началу, активная ячейка — на первую строку (ADR 0038).
  usePageChange(table, state.pagination, rows.length, getScrollElement)

  const columnSizes = useCalculateColumnSizes({ table })

  const headerGroupsDepth = headerGroups.length
  const hasNestedGroups = headerGroupsDepth > 1

  const labels = useMemo(
    () =>
      localization ? { ...DEFAULT_LABELS, ...localization } : DEFAULT_LABELS,
    [localization],
  )
  const tableLabel = labels.table
  // Заглушка той же высоты, пока грузится чанк: раскладка не прыгает.
  const toolbar = enableToolbar && (
    <Suspense
      fallback={<div className={dataGridStyles['toolbar-placeholder']} />}
    >
      <Toolbar table={table} label={labels.toolbar} />
    </Suspense>
  )
  const statusBar = hasStatusBar && (
    <StatusBar table={table} slot={statusBarSlot} />
  )
  const loadingLabel = labels.loading

  const layout = hasNestedGroups ? 'grid' : 'flex'
  const headStyles = getGridLayout({
    layout,
    headerGroups,
    leafColumns,
  })

  const { virtualColumns, bodyWidth, columnShifts } = useColumnVirtualizer({
    table,
    getScrollElement,
    enabled: !hasNestedGroups,
  })

  const { virtualRows, bodyHeight } = useRowVirtualizer({
    table,
    getScrollElement,
    rowHeight: heights.row,
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

  // Скелет первой загрузки — строго по флагу приложения (ADR 0060, §5).
  const showSkeleton = !!(table.options as any).enableSkeleton

  const noData = !showSkeleton && rows.length === 0
  // Пусто из-за фильтра — своя заглушка поверх тела, шапка с фильтрами остаётся.
  const filtered = isFilteringActive(state)
  const showStub = noData && !!stub && !filtered
  const showFilterStub = noData && filtered

  const showLinearProgress =
    (table.options as any).enableLoading && !showSkeleton

  // Реальная ширина скроллбара в CSS-var — чтобы лоадер совпадал с краем контента.
  useScrollbarWidthVar(getScrollElement, wrapperRef, !showStub)

  const containerStyles = getTableHeight({ height, maxHeight })
  // Инлайн — только РАНТАЙМ-переменные (высоты шапки/тела, drag-офсеты) и
  // переданный потребителем style. Дефолты токенов темы объявлены в theme.css.
  const wrapperStyles = {
    ...({
      '--tsr-comp-head-height': `${headerGroupsDepth * heights.head + headerGroupsDepth}px`,
      '--tsr-comp-body-height': `${bodyHeight}px`,
    } as CSSProperties),
    ...heights.vars,
    ...draggableCssVariables,
    ...containerStyles,
    ...style,
  }

  const themeClassName = clsx(DATA_GRID_THEME_CLASS, className, {
    dark: colorMode === 'dark',
  })

  // LiveRegion — первым во фрагменте обеих веток: переживает переход в заглушку
  // и объявляет пустой результат.
  if (showStub) {
    return (
      <>
        <LiveRegion
          table={table}
          labels={labels}
          loading={showLinearProgress || showSkeleton}
          rowCount={rows.length}
          themeNode={scrollableNodeRef}
        />
        <PluginRenderVersionContext.Provider value={renderVersion}>
          <PortalThemeProvider value={portalThemeClass(colorMode)}>
            <IconsProvider icons={icons}>
              <LocalizationProvider localization={localization}>
                <div
                  className={clsx(
                    dataGridStyles['table__theme-wrapper'],
                    themeClassName,
                  )}
                  data-toolbar={enableToolbar || undefined}
                  data-status-bar={hasStatusBar || undefined}
                  style={{ ...containerStyles, ...style }}
                >
                  {toolbar}
                  <div
                    className={clsx(
                      'data-grid__container',
                      dataGridStyles['table__stub-container'],
                    )}
                    ref={scrollableNodeRef}
                  >
                    <div className={dataGridStyles.table__stub}>{stub}</div>
                  </div>
                  {statusBar}
                </div>
              </LocalizationProvider>
            </IconsProvider>
          </PortalThemeProvider>
        </PluginRenderVersionContext.Provider>
      </>
    )
  }

  return (
    <>
      <LiveRegion
        table={table}
        labels={labels}
        loading={showLinearProgress || showSkeleton}
        rowCount={rows.length}
        themeNode={scrollableNodeRef}
      />
      <PluginRenderVersionContext.Provider value={renderVersion}>
        <PortalThemeProvider value={portalThemeClass(colorMode)}>
          <IconsProvider icons={icons}>
            <LocalizationProvider localization={localization}>
              <FastScrollProvider store={fastScrollStore}>
                <div
                  ref={wrapperRef}
                  className={clsx(
                    dataGridStyles['table__theme-wrapper'],
                    themeClassName,
                  )}
                  data-toolbar={enableToolbar || undefined}
                  data-status-bar={hasStatusBar || undefined}
                  style={wrapperStyles}
                >
                  {toolbar}
                  {showLinearProgress && (
                    <LinearProgress label={loadingLabel} />
                  )}
                  <ScrollingAttribute getScrollElement={getScrollElement} />
                  <ShimmerSync getScrollElement={getScrollElement} />
                  {enableOverflowTooltip && (
                    <OverflowTooltip getScrollElement={getScrollElement} />
                  )}
                  {enableContextMenu && (
                    <ContextMenu
                      table={table}
                      getScrollElement={getScrollElement}
                    />
                  )}
                  {keyboardNavigation && (
                    <div
                      ref={guardBeforeRef}
                      tabIndex={-1}
                      className={dataGridStyles['focus-guard']}
                      data-kn-guard="before"
                    />
                  )}
                  <div
                    className={clsx(
                      'data-grid__container',
                      dataGridStyles.table__container,
                      {
                        [dataGridStyles['table__container--skeleton']]:
                          showSkeleton,
                      },
                    )}
                    ref={scrollableNodeRef}
                    data-resizing={isResizingColumns !== false}
                    onCopy={handleCopy}
                  >
                    <DataGridTable
                      table={table}
                      layout={layout}
                      headStyles={headStyles}
                      headerGroups={headerGroups}
                      rows={rows}
                      leafColumns={leafColumns}
                      virtualRows={virtualRows}
                      virtualColumns={virtualColumns}
                      isVirtualColumns={!hasNestedGroups}
                      isResizingColumns={isResizingColumns}
                      keyboardNavigation={keyboardNavigation}
                      label={tableLabel}
                      busy={showLinearProgress}
                      skeleton={showSkeleton}
                      loadingLabel={loadingLabel}
                      style={{
                        ...columnSizes,
                        ...columnShiftVars(columnShifts),
                        ...virtualPaddingStyles,
                      }}
                    />
                    {showFilterStub && (
                      <FilterStub table={table} render={filterStub} />
                    )}
                  </div>
                  {keyboardNavigation && (
                    <div
                      ref={guardAfterRef}
                      tabIndex={-1}
                      className={dataGridStyles['focus-guard']}
                      data-kn-guard="after"
                    />
                  )}
                  {statusBar}
                </div>
              </FastScrollProvider>
            </LocalizationProvider>
          </IconsProvider>
        </PortalThemeProvider>
      </PluginRenderVersionContext.Provider>
    </>
  )
}
