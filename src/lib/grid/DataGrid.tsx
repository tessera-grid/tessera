// Корневой DataGrid: реактивность через table.atoms/store (useTableState/useSlice
// в компонентах). Стейт-снимки (isResizingColumns/rowDragging) читаются реактивно
// из общего store.
import {
  type CSSProperties,
  type FocusEvent,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react'

import clsx from 'clsx'

import { FastScrollProvider, useFastScroll } from '../core/fastScroll'
import { useCellSelectionAutoScroll } from '../core/cellSelectionAutoScroll'
import { useKeyboardNavigationGrid } from '../core/keyboardNavigation'
import { trackInputModality } from '../core/inputModality'
import { trackStickyGeometry } from '../core/stickyGeometry'
import { trackTouchedCell } from '../core/touchedCell'
import { ContextMenu } from './contextMenu/ContextMenu'
import { OverflowTooltip } from './OverflowTooltip'
import {
  DATA_GRID_THEME_CLASS,
  contrastAttribute,
  ThemeScope,
} from '../core/themeVariables'
import { DEFAULT_LABELS, LocalizationProvider } from '../core/localization'
import { LiveRegion } from './LiveRegion'
import { EmptyStub } from './stubs/EmptyStub'
import { type StubContext, resolveStub, stubEntriesOf } from '../core/stubs'
import { getFooterPosition } from '../core/footer'
import { PluginRenderVersionContext } from '../core/renderVersion'
import { usePageChange } from '../core/pagination'
import { IconsProvider } from '../ui/icons'
import { LinearProgress } from '../ui/LinearProgress'
import { LoadErrorBanner } from './loadError/LoadError'
import { useLoadError } from './loadError/useLoadError'
import { hasLoadError } from '../core/loadError'
import { isSkeletonShown } from '../core/skeletonOptions'
import {
  dismissServerActionError,
  serverActionReason,
  type ServerActionStatus,
} from '../core/serverActions'
import { useLoadingDisplay } from './useLoadingDisplay'
import type { Column, Table } from '../types'
import type { RenderSlots } from '../core/createSlots'
import { useTableState } from '../core/reactivity'
import { cancelColumnResize } from '../core/cancelInteraction'
import { countPanelSlots, resolvePanelVisible } from '../core/panels'
import {
  useColumnVirtualizer,
  useColumnVirtualizerScroll,
  useRowVirtualizer,
} from '../core/virtualization'
import { useScrollViewport } from '../core/scrollToRow/viewport'
import { isNearAutoScrollEdge } from './dnd/parameters'
import { useDragPointerY } from './dnd/useDragPointerY'
import { useCalculateColumnSizes } from './useCalculateColumnSizes'
import { columnShiftVars } from './columnSizes'
import { useCellSelectionCopy } from './useCellSelectionCopy'
import { DataGridTable } from './DataGridTable'
import { StatusBar } from './StatusBar/StatusBar'
import { getTableHeight } from './getTableHeight'
import { getGridLayout } from './layout'
import { useScrollbarWidthVar } from './useScrollbarWidthVar'
import { useSkeletonWave } from './useSkeletonWave'
import { useRowHeights } from './useRowHeights'
import { ScrollingAttribute } from './ScrollingAttribute'
import type { DataGridProps } from './dataGridTypes'

import dataGridStyles from '../grid/DataGrid/DataGrid.module.css'
// Токены темы (`.data-grid-theme`: --tsr-ref/sys/comp, light/dark) как ГЛОБАЛЬНЫЙ
// (не-модульный) CSS side-effect отсюда — чтобы классы шиппились не захешированными.
import '../core/themeVariables/theme.css'
import { useIsomorphicLayoutEffect } from '../core/useIsomorphicLayoutEffect'

// Base UI Toolbar — около 6.5 KB gzip; грузим, только когда тулбар показывается.
const Toolbar = lazy(() =>
  import('./Toolbar/Toolbar').then(module => ({ default: module.Toolbar })),
)

/**
 * Контейнер прокрутки при `keyboardNavigation` вне порядка Tab (KN32) и фокус не держит:
 * клик по пустому месту, как и без `tabindex`, оставляет фокус в `body` (IS12).
 */
const releaseContainerFocus = (event: FocusEvent<HTMLDivElement>) => {
  if (event.target === event.currentTarget) event.currentTarget.blur()
}

/**
 * Основной компонент таблицы. Ожидает инстанс таблицы (useCreateTable) и высоту;
 * заглушки пустой таблицы — из реестра причин, свой вид — пропом `stubs` (ADR 0123).
 */
export const DataGrid = ({
  table: tableProp,
  height = '100%',
  maxHeight = '100%',
  stubs,
  colorMode = 'auto',
  contrast = 'auto',
  icons,
  localization,
  className,
  style,
}: DataGridProps) => {
  const table = tableProp as unknown as Table<any, any>
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
      serverAction: _serverAction,
      ...rest
    } = s as unknown as Record<string, unknown>
    return rest
  }) as Record<string, any>
  // Серверное действие (ADR 0116): корню — только ожидание и отказ, не смена причины.
  const serverAction = useTableState(table, s => {
    const status = (s as { serverAction?: ServerActionStatus }).serverAction
    return { pending: !!status?.pending, failed: status?.failed }
  })

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
  useIsomorphicLayoutEffect(() => {
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

  // Кольцо фокуса по последнему вводу — и в Firefox после мыши (ADR 0084, CB5).
  useEffect(trackInputModality, [])
  useEffect(() => trackStickyGeometry(getScrollElement), [getScrollElement])
  useEffect(() => trackTouchedCell(getScrollElement), [getScrollElement])

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

  const {
    virtualColumns,
    bodyWidth,
    columnShifts,
    virtualizer: columnVirtualizer,
  } = useColumnVirtualizer({
    table,
    getScrollElement,
    enabled: !hasNestedGroups,
  })

  const {
    virtualRows,
    bodyHeight,
    virtualizer: rowVirtualizer,
  } = useRowVirtualizer({
    table,
    getScrollElement,
    rowHeight: heights.row,
  })
  // Окно прокрутки для `table.scrollToRow` (ADR 0104).
  useScrollViewport(table, {
    getScrollElement,
    rows: rowVirtualizer,
    columns: hasNestedGroups ? undefined : columnVirtualizer,
  })

  const dragPointerY = useDragPointerY(rowDragging?.activeId != null)
  const fastScrollStore = useFastScroll({
    getScrollElement,
    forceFast: () => {
      const y = dragPointerY.current
      const scroller = scrollableNodeRef.current
      return (
        y !== null &&
        !!scroller &&
        isNearAutoScrollEdge(scroller.getBoundingClientRect(), y)
      )
    },
  })

  const virtualPaddingStyles = useColumnVirtualizerScroll({
    table,
    virtualColumns,
    columnsTotalSize: bodyWidth,
  })

  const loading = (table.options as any).loading as
    'initial' | 'refresh' | false | undefined
  const initialLoading = loading === 'initial'
  // Ожидание серверного действия — то же свечение обновления без пропа (ADR 0116, §3).
  const refreshLoading = loading === 'refresh' || serverAction.pending
  // Отказ серверного действия — та же плашка; ошибка приложения главнее (ADR 0116, §5).
  const appError = (table.options as any).loadError
  const appFailed = hasLoadError(appError)
  const { failed } = serverAction
  const actionError = useMemo(
    () => failed && { message: serverActionReason(failed, labels) },
    [failed, labels],
  )
  // Отказ загрузки (ADR 0096): с данными — плашка и красный свет, без них — заглушка.
  const loadError = useLoadError({
    table,
    error: appFailed ? appError : actionError,
    onRetry: appFailed ? (table.options as any).onRetry : failed?.retry,
    loading: initialLoading || refreshLoading,
    // Отказ действия — всегда плашка: прежние данные на месте, пусть их и нет.
    hasRows: rows.length > 0 || (!appFailed && !!failed),
  })

  // Скелет первой загрузки — строго по флагу приложения (ADR 0060, §5); отказ без строк
  // главнее. Тот же расчёт видят компоненты слотов (SL21).
  const showSkeleton = isSkeletonShown(table)

  // Заглушка пустой таблицы — первая по приоритету запись реестра (ADR 0123); скелет
  // главнее любой. `grid` встаёт вместо таблицы, `body` — под шапкой.
  const stubContext: StubContext = {
    table,
    rowCount: rows.length,
    loadError: {
      shown: loadError.stubShown,
      error: (table.options as any).loadError,
      reason: loadError.reason,
      retry: loadError.retry,
      pending: loadError.pending,
    },
  }
  const activeStub = showSkeleton
    ? undefined
    : resolveStub(stubEntriesOf(table), stubContext)
  const gridStub = activeStub?.placement === 'grid' ? activeStub : undefined
  const bodyStub = activeStub?.placement === 'body' ? activeStub : undefined
  const stubTitle =
    activeStub && activeStub.announce !== false
      ? activeStub.title(labels)
      : undefined

  // Заглушки под шапкой — над закреплённым футером, в таблице; под незакреплённым и без
  // футера — после таблицы (ADR 0118, §3).
  const emptyStubs = bodyStub ? (
    <EmptyStub
      entry={bodyStub}
      context={stubContext}
      render={stubs?.[bodyStub.id]}
      className={dataGridStyles['table__body-stub']}
    />
  ) : null
  const stubsAboveFooter =
    !!(table.options as any).enableFooter &&
    getFooterPosition(table) === 'pinned'

  const showLinearProgress = refreshLoading && !showSkeleton
  // Свечение и приглушение — с задержкой и минимумом; aria-busy и объявление — сразу.
  const refreshing = useLoadingDisplay(
    showLinearProgress,
    (table.options as any).refreshOptions,
  )
  // Отказ снимает приглушение сразу, без минимума показа: старые данные рабочие.
  const refreshingShown = refreshing && (refreshLoading || !loadError.present)
  // Плашка уходит (закрыта или повтор), а фокус — в тело грида, а не в никуда.
  const focusBody = () =>
    scrollableNodeRef.current
      ?.querySelector<HTMLElement>(
        '[tabindex="0"], button:not([disabled]), [href], input:not([disabled])',
      )
      ?.focus()
  const dismissLoadError = () => {
    loadError.dismiss()
    if (!appFailed) dismissServerActionError(table)
    focusBody()
  }
  const retryLoadFromBanner = loadError.retryFromBanner
    ? () => {
        loadError.retryFromBanner?.()
        focusBody()
      }
    : undefined
  // Реальная ширина скроллбара в CSS-var — чтобы лоадер совпадал с краем контента.
  useScrollbarWidthVar(getScrollElement, wrapperRef, !gridStub)
  useSkeletonWave(wrapperRef, showSkeleton && !gridStub)

  const containerStyles = getTableHeight({ height, maxHeight })
  // Инлайн — только РАНТАЙМ-переменные (высоты шапки/тела, drag-офсеты) и
  // переданный потребителем style. Дефолты токенов темы объявлены в theme.css.
  const wrapperStyles = {
    ...({
      '--tsr-comp-head-height': `${headerGroupsDepth * heights.head + headerGroupsDepth}px`,
      '--tsr-comp-body-height': `${bodyHeight}px`,
    } as CSSProperties),
    ...heights.vars,
    ...containerStyles,
    ...style,
  }

  const themeClassName = clsx(DATA_GRID_THEME_CLASS, className, {
    dark: colorMode === 'dark',
  })
  const contrastAttr = contrastAttribute(contrast)
  const colorModeAttr = colorMode === 'light' ? 'light' : undefined

  return (
    <>
      <LiveRegion
        table={table}
        labels={labels}
        loading={showLinearProgress || showSkeleton}
        failed={loadError.present}
        rowCount={rows.length}
        stubTitle={stubTitle}
        themeNode={scrollableNodeRef}
      />
      <PluginRenderVersionContext.Provider value={renderVersion}>
        <ThemeScope
          colorMode={colorMode}
          contrast={contrast}
          rootRef={wrapperRef}
          host={table as never}
        >
          <IconsProvider icons={icons}>
            <LocalizationProvider localization={localization}>
              <FastScrollProvider store={fastScrollStore}>
                <div
                  ref={wrapperRef}
                  className={clsx(
                    dataGridStyles['table__theme-wrapper'],
                    themeClassName,
                  )}
                  data-tsr-contrast={contrastAttr}
                  data-tsr-color-mode={colorModeAttr}
                  data-toolbar={enableToolbar || undefined}
                  data-status-bar={hasStatusBar || undefined}
                  data-refreshing={refreshingShown || undefined}
                  data-skeleton-wave={showSkeleton || undefined}
                  data-tree-lines={
                    (table.options as { enableTreeLines?: boolean })
                      .enableTreeLines || undefined
                  }
                  style={wrapperStyles}
                >
                  {toolbar}
                  <LinearProgress
                    label={loadingLabel}
                    active={refreshingShown}
                    errorFlash={loadError.flashKey}
                  />
                  <LoadErrorBanner
                    shown={loadError.bannerShown}
                    reason={loadError.reason}
                    retry={retryLoadFromBanner}
                    onDismiss={dismissLoadError}
                  />
                  <ScrollingAttribute getScrollElement={getScrollElement} />
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
                  {/* Заглушка вместо таблицы — в том же дереве: тулбар и нижняя панель
                      не перемонтируются при переходе (ADR 0123). */}
                  {gridStub ? (
                    <div
                      className={clsx(
                        'data-grid__container',
                        dataGridStyles['table__stub-container'],
                      )}
                      ref={scrollableNodeRef}
                    >
                      <div className={dataGridStyles.table__stub}>
                        <EmptyStub
                          entry={gridStub}
                          context={stubContext}
                          render={stubs?.[gridStub.id]}
                          className={dataGridStyles['table__grid-stub']}
                        />
                      </div>
                    </div>
                  ) : (
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
                      // Firefox держит прокручиваемую область в порядке Tab (KN32).
                      tabIndex={keyboardNavigation ? -1 : undefined}
                      onFocus={
                        keyboardNavigation ? releaseContainerFocus : undefined
                      }
                      data-resizing={isResizingColumns !== false}
                      data-column-dragging={
                        state.columnDraggingActiveId != null || undefined
                      }
                      data-row-dragging={
                        rowDragging?.activeId != null || undefined
                      }
                      data-row-drop-invalid={
                        (rowDragging?.activeId != null &&
                          rowDragging.acceptable === false) ||
                        undefined
                      }
                      data-row-animation={
                        (table.options as any).enableRowAnimation !== false ||
                        undefined
                      }
                      data-empty-stub={bodyStub?.id}
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
                        endContent={stubsAboveFooter ? emptyStubs : undefined}
                        style={{
                          ...columnSizes,
                          ...columnShiftVars(columnShifts),
                          ...virtualPaddingStyles,
                        }}
                      />
                      {!stubsAboveFooter && emptyStubs}
                    </div>
                  )}
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
        </ThemeScope>
      </PluginRenderVersionContext.Provider>
    </>
  )
}
