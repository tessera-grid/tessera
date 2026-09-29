// Корневой DataGrid: реактивность через table.atoms/store (useTableState/useSlice
// в компонентах). Стейт-снимки (isResizingColumns/rowDragging) читаются реактивно
// из общего store.
import {
  type CSSProperties,
  lazy,
  Suspense,
  useCallback,
  useMemo,
  useRef,
} from 'react'

import clsx from 'clsx'

import { FastScrollProvider, useFastScroll } from '../core/fastScroll'
import { useCellSelectionAutoScroll } from '../core/cellSelectionAutoScroll'
import { useKeyboardNavigationGrid } from '../core/keyboardNavigation'
import { ContextMenu } from './contextMenu/ContextMenu'
import { DATA_GRID_THEME_CLASS } from '../core/themeVariables'
import { DEFAULT_LABELS, LocalizationProvider } from '../core/localization'
import { LiveRegion } from './LiveRegion'
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
import { useCellSelectionCopy } from './useCellSelectionCopy'
import { DataGridTable } from './DataGridTable'
import { SkeletonOverlay } from './SkeletonOverlay'
import { getTableHeight } from './getTableHeight'
import { getGridLayout } from './layout'
import { useScrollbarWidthVar } from './useScrollbarWidthVar'
import type { DataGridProps } from './dataGridTypes'

import dataGridStyles from '../grid/DataGrid/DataGrid.module.css'
// Токены темы (`.data-grid-theme`: --tsr-ref/sys/comp, light/dark) как ГЛОБАЛЬНЫЙ
// (не-модульный) CSS side-effect отсюда — чтобы классы шиппились не захешированными.
import '../core/themeVariables/theme.css'

// Base UI Toolbar — около 6.5 KB gzip; грузим только при `enableToolbar`.
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
  const rowDragging = state.rowDragging as
    | { activeId: string | null; acceptable: boolean; offsetLeft: number }
    | undefined

  const enableContextMenu = !!(table.options as any).enableContextMenu
  const enableToolbar = !!(table.options as any).enableToolbar

  const scrollableNodeRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const getScrollElement = useCallback(() => scrollableNodeRef.current, [])

  // Авто-прокрутка при drag-выделении ячеек у края/за пределами таблицы (инертно
  // без плагина cellSelection). См. core/cellSelectionAutoScroll.
  useCellSelectionAutoScroll(table, getScrollElement)

  const handleCopy = useCellSelectionCopy(table)

  // Клавиатурная навигация (плагин keyboardNavigation): роль grid + резолвер клавиш
  // на корне. `null` без плагина — остаётся role=table без обработчиков.
  const keyboardNavigation = useKeyboardNavigationGrid(table, getScrollElement)

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
  const loadingLabel = labels.loading

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

  // LiveRegion — первым во фрагменте обеих веток: переживает переход в заглушку
  // и объявляет пустой результат.
  if (showStub) {
    return (
      <>
        <LiveRegion
          table={table}
          labels={labels}
          loading={showLinearProgress || showSkeletonOverlay}
          rowCount={rows.length}
        />
        <IconsProvider icons={icons}>
          <LocalizationProvider localization={localization}>
            <div
              className={clsx(
                dataGridStyles['table__theme-wrapper'],
                themeClassName,
              )}
              data-toolbar={enableToolbar || undefined}
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
            </div>
          </LocalizationProvider>
        </IconsProvider>
      </>
    )
  }

  return (
    <>
      <LiveRegion
        table={table}
        labels={labels}
        loading={showLinearProgress || showSkeletonOverlay}
        rowCount={rows.length}
      />
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
              style={wrapperStyles}
            >
              {toolbar}
              {showLinearProgress && <LinearProgress label={loadingLabel} />}
              {enableContextMenu && (
                <ContextMenu
                  table={table}
                  getScrollElement={getScrollElement}
                />
              )}
              {keyboardNavigation && (
                <div
                  ref={keyboardNavigation.guardBeforeRef}
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
                    style={{ ...columnSizes, ...virtualPaddingStyles }}
                  />
                )}
              </div>
              {keyboardNavigation && (
                <div
                  ref={keyboardNavigation.guardAfterRef}
                  tabIndex={-1}
                  className={dataGridStyles['focus-guard']}
                  data-kn-guard="after"
                />
              )}
            </div>
          </FastScrollProvider>
        </LocalizationProvider>
      </IconsProvider>
    </>
  )
}
