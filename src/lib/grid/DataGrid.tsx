// Корневой DataGrid: реактивность через table.atoms/store (useTableState/useSlice
// в компонентах). Стейт-снимки (isResizingColumns/rowDragging) читаются реактивно
// из общего store.
import { reportAction } from '../core/debugActions'
import {
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import clsx from 'clsx'

import { FastScrollProvider, useFastScroll } from '../core/fastScroll'
import { useRowSourceWindow } from '../core/rowSourceWindow'
import { clampBodyHeight } from '../core/scrollHeightLimit'
import { scrollLayer, useScrollStretch } from '../core/scrollStretch'
import {
  bodyEventHandlers,
  RootHooks,
  themeAttrsOf,
} from '../core/bodyContributions'
import {
  KeyboardNavigationContext,
  useKeyboardNavigationGrid,
} from '../core/keyboardNavigation'
import { trackInputModality } from '../core/inputModality'
import { trackStickyGeometry } from '../core/stickyGeometry'
import { trackTouchedCell } from '../core/touchedCell'
import { RowRevealContext, createRowReveal, trackRowReveal } from './rowReveal'
import { OverflowTooltip } from './OverflowTooltip'
import {
  DATA_GRID_THEME_CLASS,
  contrastAttribute,
  ThemeScope,
} from '../ui/theme'
import {
  DEFAULT_LOCALE,
  LocalizationContext,
  resolveLabels,
  unknownLabelKeys,
} from '../core/localization'
import { logWarn } from '../util/logger'
import { LiveRegion } from './LiveRegion'
import { EmptyStub } from './stubs/EmptyStub'
import { type StubContext, resolveStub, stubEntriesOf } from '../core/stubs'
import {
  NO_RENDER_VERSION,
  PluginRenderVersionContext,
} from '../core/renderVersion'
import { usePageChange } from '../core/pagination'
import { IconsProvider } from '../ui/icons'
import { LinearProgress } from '../ui/LinearProgress'
import { LoadErrorBanner } from './loadError/LoadError'
import {
  PendingActionBanner,
  cancelServerPending,
} from './loadError/PendingActionBanner'
import { useLoadError } from './loadError/useLoadError'
import { hasLoadError } from '../core/loadError'
import { isSkeletonShown } from '../core/skeletonOptions'
import {
  dismissServerActionError,
  serverActionReason,
  type ServerActionStatus,
} from '../core/serverActions'
import { useLoadingDisplay } from './useLoadingDisplay'
import type { Column, Row, Table } from '../types'
import { commonOptionsOf } from '../core/commonFeature'
import {
  columnDragActiveIdOf,
  isNearAutoScrollEdge,
  rowDragSessionOf,
} from '../core/dragSession'
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
import { useDragPointerY } from './useDragPointerY'
import { useCalculateColumnSizes } from './useCalculateColumnSizes'
import { columnShiftVars } from './columnSizes'
import { DataGridTable } from './DataGridTable'
import { StatusBar } from './StatusBar/StatusBar'
import { getTableHeight } from './getTableHeight'
import { getGridLayout } from './layout'
import { useScrollbarWidthVar } from './useScrollbarWidthVar'
import { usePendingWave, useSkeletonWave } from './useSkeletonWave'
import {
  dismissTableActionFailure,
  hasWaveTargets,
  tableActionFailure,
  tableActionPending,
} from '../core/headerActions/actionStatus'
import type { ActionStatus } from '../core/headerActions/actionStatusFeature'
import { useRowHeights } from './useRowHeights'
import { useControlColumnSizes } from './useControlColumnSizes'
import { ScrollingAttribute } from './ScrollingAttribute'
import { PinnedEdgesAttribute } from './PinnedEdgesAttribute'
import type { DataGridProps } from './dataGridTypes'

import dataGridStyles from '../grid/DataGrid/DataGrid.module.css'
// Токены темы (`.data-grid-theme`: --tsr-ref/sys/comp, light/dark) как ГЛОБАЛЬНЫЙ
// (не-модульный) CSS side-effect отсюда — чтобы классы шиппились не захешированными.
import '../ui/theme/theme.css'
import { useIsomorphicLayoutEffect } from '../util/useIsomorphicLayoutEffect'

// Base UI Toolbar — около 6.5 KB gzip; грузим, только когда тулбар показывается.
const NO_ROWS: Row<any, any>[] = []

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

const localeOf = (table: unknown): string =>
  commonOptionsOf(table).locale ?? DEFAULT_LOCALE

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
  const options = commonOptionsOf(table)
  // Язык подписей — опция таблицы (ADR 0169, §5).
  const locale = localeOf(table)
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

  // Массив строк — для дерева, линий, движения и места броска в теле, если список загружен
  // целиком; строки тела и их число — у источника (ADR 0138).
  const rowSource = table.getRowSource()
  const rows = (rowSource.rows?.() ?? NO_ROWS) as Row<any, any>[]
  const rowCount = rowSource.count()

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
  const rowDragging = rowDragSessionOf(state)

  const enableOverflowTooltip = options.enableOverflowTooltip !== false
  const renderVersion = options.pluginRenderVersion ?? NO_RENDER_VERSION
  // Панели включают слоты плагинов; флаг их переопределяет (ADR 0046).
  const renderSlots = (table.getRenderSlots as () => RenderSlots | undefined)()
  const statusBarSlot = renderSlots?.statusBarSlot ?? []
  const enableToolbar = resolvePanelVisible(
    options.enableToolbar,
    renderSlots?.toolbarSlot.length ?? 0,
  )
  const hasStatusBar = resolvePanelVisible(
    options.enableStatusBar,
    countPanelSlots(statusBarSlot),
  )

  const scrollableNodeRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const getScrollElement = useCallback(() => scrollableNodeRef.current, [])
  // Ключ перечитывания токенов: тема и появление корня (без строк — ветка заглушки).
  const themeKey = `${colorMode}|${className}|${rowCount > 0}`
  const heights = useRowHeights(table, wrapperRef, themeKey)
  useControlColumnSizes(table, wrapperRef, themeKey)

  // События над телом — вкладчикам корня делегированием (ADR 0170, §3).
  const bodyEvents = bodyEventHandlers(table)

  // Кольцо фокуса по последнему вводу — и в Firefox после мыши (ADR 0084, CB5).
  useEffect(trackInputModality, [])
  useEffect(() => trackStickyGeometry(getScrollElement), [getScrollElement])
  useEffect(() => trackTouchedCell(getScrollElement), [getScrollElement])
  // Значки скрытых кнопок — у строк под указателем, с фокусом и тронутой (ADR 0149, §4).
  const [rowReveal] = useState(createRowReveal)
  useEffect(
    () => trackRowReveal(getScrollElement, rowReveal),
    [getScrollElement, rowReveal],
  )

  // Клавиатурная навигация: роль grid и резолвер клавиш на корне; без опции —
  // `null`, остаётся role=table без обработчиков.
  const keyboardNavigation = useKeyboardNavigationGrid(table, getScrollElement)
  const guardBeforeRef = keyboardNavigation?.guardBeforeRef
  const guardAfterRef = keyboardNavigation?.guardAfterRef

  // Смена страницы: тело к началу, активная ячейка — на первую строку (ADR 0038).
  usePageChange(table, state.pagination, rowCount, getScrollElement)

  const columnSizes = useCalculateColumnSizes({ table })

  const headerGroupsDepth = headerGroups.length
  const hasNestedGroups = headerGroupsDepth > 1
  // Разделитель в 1px — между строками шапки; под последней — тень, а не рамка.
  const headHeight = headerGroupsDepth * heights.head + headerGroupsDepth - 1
  // Над телом шапка, под ним — не больше строки футера.
  const aroundBody = headHeight + heights.row

  const labels = useMemo(
    () => resolveLabels(localization, locale),
    [localization, locale],
  )
  // Опечатка в словаре из JSON молча оставила бы английскую подпись (ADR 0132, LC8).
  useEffect(() => {
    for (const key of localization ? unknownLabelKeys(localization) : []) {
      logWarn(
        table,
        `localization: unknown label key "${key}"`,
        `localization:${key}`,
      )
    }
  }, [table, localization])
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
  // Тело выше границы браузера — растянутая область (ADR 0142).
  const shownBodyHeight = clampBodyHeight(bodyHeight, aroundBody)
  useScrollStretch(getScrollElement, bodyHeight - shownBodyHeight)
  // Окно прокрутки для `table.scrollToRow` (ADR 0104).
  useScrollViewport(table, {
    getScrollElement,
    rows: rowVirtualizer,
    columns: hasNestedGroups ? undefined : columnVirtualizer,
  })

  const dragPointerY = useDragPointerY(rowDragging?.activeId != null)
  // Автопрокрутка перетаскивания строки в растянутой области — 1:1 (ADR 0142, XS6).
  useIsomorphicLayoutEffect(() => {
    const scroller = getScrollElement()
    if (scroller)
      scrollLayer(scroller).followDrag(rowDragging?.activeId != null)
  }, [getScrollElement, rowDragging?.activeId])
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
  useRowSourceWindow(table, rowSource, rowVirtualizer, fastScrollStore)

  const virtualPaddingStyles = useColumnVirtualizerScroll({
    table,
    virtualColumns,
    columnsTotalSize: bodyWidth,
  })

  const loading = options.loading
  const initialLoading = loading === 'initial'
  // Ожидание серверного действия — то же свечение обновления без пропа (ADR 0116, §3); окно
  // новой выборки серверной модели строк — тоже (ADR 0138, §6).
  // Действие меню над всей таблицей (ADR 0155, §2): свечение и плашка, как у серверного.
  const tableAction = useTableState(table, s => {
    const status = (s as { actionStatus?: ActionStatus }).actionStatus
    return {
      pending: tableActionPending(status),
      failure: tableActionFailure(status),
    }
  })
  const refreshLoading =
    loading === 'refresh' ||
    !!serverAction.pending ||
    tableAction.pending ||
    !!rowSource.refreshing?.()
  // Отказ серверного действия — та же плашка; ошибка приложения главнее (ADR 0116, §5).
  const appError = options.loadError
  const appFailed = hasLoadError(appError)
  const { failed } = serverAction
  const actionError = useMemo(
    () => failed && { message: serverActionReason(failed, labels) },
    [failed, labels],
  )
  const menuFailure = tableAction.failure
  const menuError = useMemo(
    () =>
      menuFailure && {
        message:
          menuFailure.entry.reason?.(labels) ?? labels.actionFailedFallback,
      },
    [menuFailure, labels],
  )
  // Отказ источника, когда не загружено ничего (серверная модель, ADR 0138, §11).
  const listError = appFailed ? undefined : rowSource.loadError?.()
  const sourceError = useMemo(
    () => listError && { message: listError.reason },
    [listError],
  )
  // Отказ загрузки (ADR 0096): с данными — плашка и красный свет, без них — заглушка.
  const loadError = useLoadError({
    table,
    error: appFailed ? appError : (sourceError ?? actionError ?? menuError),
    onRetry: appFailed
      ? options.onRetry
      : (listError?.retry ?? failed?.retry ?? menuFailure?.entry.retry),
    loading: initialLoading || refreshLoading,
    // Отказ действия — всегда плашка: прежние данные на месте, пусть их и нет.
    hasRows:
      !listError &&
      (rowCount > 0 || (!appFailed && (!!failed || !!menuFailure))),
    // Отказ копирования — не обновления данных: свой заголовок (ADR 0146, §4).
    title:
      !appFailed && !listError && failed?.kind === 'copy'
        ? labels.serverActionFailedCopy
        : !appFailed && !listError && !failed && menuFailure?.entry.name
          ? labels.actionsFailed(menuFailure.entry.name(labels))
          : undefined,
  })

  // Скелет первой загрузки — строго по флагу приложения (ADR 0060, §5); отказ без строк
  // главнее. Тот же расчёт видят компоненты слотов (SL21).
  const showSkeleton = isSkeletonShown(table)

  // Заглушка пустой таблицы — первая по приоритету запись реестра (ADR 0123); скелет
  // главнее любой. `grid` встаёт вместо таблицы, `body` — под шапкой.
  const stubContext: StubContext = {
    table,
    rowCount,
    loadError: {
      shown: loadError.stubShown,
      error: options.loadError,
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

  // Заглушки под шапкой — перед футером в таблице, без футера — после таблицы (ADR 0118, §3).
  const emptyStubs = bodyStub ? (
    <EmptyStub
      entry={bodyStub}
      context={stubContext}
      render={stubs?.[bodyStub.id]}
      className={dataGridStyles['table__body-stub']}
    />
  ) : null
  const stubsAboveFooter = !!options.enableFooter

  const showLinearProgress = refreshLoading && !showSkeleton
  // Свечение и приглушение — с задержкой и минимумом; aria-busy и объявление — сразу.
  const refreshing = useLoadingDisplay(
    showLinearProgress,
    options.refreshOptions,
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
    reportAction(table, {
      plugin: 'core',
      action: 'dismissLoadError',
      source: 'pointer',
    })
    loadError.dismiss()
    if (!appFailed) dismissServerActionError(table)
    if (menuFailure) dismissTableActionFailure(table, menuFailure.key)
    focusBody()
  }
  // Escape в теле отменяет ждущее серверное действие (ADR 0153, §5); у поля правки и
  // открытого меню Escape свой.
  const cancelOnEscape = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape' || event.defaultPrevented) return
    const target = event.target as HTMLElement
    if (target.closest('input, textarea, select, [contenteditable="true"]')) {
      return
    }
    if (cancelServerPending(table, event) > 0) event.preventDefault()
  }
  const retryLoadFromBanner = loadError.retryFromBanner
    ? (event?: unknown) => {
        loadError.retryFromBanner?.(event)
        focusBody()
      }
    : undefined
  // Реальная ширина скроллбара в CSS-var — чтобы лоадер совпадал с краем контента.
  useScrollbarWidthVar(getScrollElement, wrapperRef, !gridStub)
  useSkeletonWave(wrapperRef, showSkeleton && !gridStub)
  // Волна ожидания на цели действия из контекстного меню (ADR 0155, §1) — пока хоть одно ждёт.
  const menuPending = useTableState(table, s =>
    hasWaveTargets((s as { actionStatus?: ActionStatus }).actionStatus),
  )
  usePendingWave(wrapperRef, menuPending && !gridStub)

  const containerStyles = getTableHeight({ height, maxHeight })
  // Инлайн — только РАНТАЙМ-переменные (высоты шапки/тела, drag-офсеты) и
  // переданный потребителем style. Дефолты токенов темы объявлены в theme.css.
  const wrapperStyles = {
    ...({
      '--tsr-comp-head-height': `${headHeight}px`,
      '--tsr-comp-body-height': `${shownBodyHeight}px`,
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
        rowCount={rowCount}
        stubTitle={stubTitle}
        themeNode={scrollableNodeRef}
      />
      <PluginRenderVersionContext.Provider value={renderVersion}>
        <KeyboardNavigationContext.Provider value={!!keyboardNavigation}>
          <ThemeScope
            colorMode={colorMode}
            contrast={contrast}
            rootRef={wrapperRef}
            host={table as never}
          >
            <IconsProvider icons={icons}>
              <LocalizationContext.Provider value={labels}>
                <FastScrollProvider store={fastScrollStore}>
                  <RowRevealContext.Provider value={rowReveal}>
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
                      {...themeAttrsOf(table)}
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
                        title={loadError.title}
                        retry={retryLoadFromBanner}
                        onDismiss={dismissLoadError}
                      />
                      <PendingActionBanner
                        table={table}
                        themeRef={wrapperRef}
                        blocked={loadError.bannerShown}
                        onCancelled={focusBody}
                      />
                      <RootHooks
                        table={table}
                        getScrollElement={getScrollElement}
                      />
                      <ScrollingAttribute getScrollElement={getScrollElement} />
                      <PinnedEdgesAttribute
                        getScrollElement={getScrollElement}
                      />
                      {enableOverflowTooltip && (
                        <OverflowTooltip getScrollElement={getScrollElement} />
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
                          onKeyDown={cancelOnEscape}
                          onFocus={
                            keyboardNavigation
                              ? releaseContainerFocus
                              : undefined
                          }
                          data-resizing={isResizingColumns !== false}
                          data-column-dragging={
                            columnDragActiveIdOf(state) != null || undefined
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
                            options.enableRowAnimation !== false || undefined
                          }
                          data-empty-stub={bodyStub?.id}
                          {...bodyEvents}
                        >
                          <DataGridTable
                            table={table}
                            layout={layout}
                            headStyles={headStyles}
                            headerGroups={headerGroups}
                            rows={rows}
                            rowSource={rowSource}
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
                            endContent={
                              stubsAboveFooter ? emptyStubs : undefined
                            }
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
                  </RowRevealContext.Provider>
                </FastScrollProvider>
              </LocalizationContext.Provider>
            </IconsProvider>
          </ThemeScope>
        </KeyboardNavigationContext.Provider>
      </PluginRenderVersionContext.Provider>
    </>
  )
}
