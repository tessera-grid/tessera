import type { InputType } from 'storybook/internal/csf'

import { DEFAULT_ROW_ACTIONS_OPTIONS } from '../../../../lib/plugins/rowActions'
import { DEFAULT_HEADER_ACTION_MENU } from '../../../../lib/plugins/headerActionMenu'
import { DEFAULT_ROW_ACTION_MENU } from '../../../../lib/plugins/rowActionMenu'
import { DEFAULT_FILTER_DEBOUNCE_MS } from '../../../../lib/plugins/columnFilteringModel/conditions'
import { DEFAULT_SEARCH_DEBOUNCE_MS } from '../../../../lib/plugins/quickSearchModel/search'
import {
  DEFAULT_PAGE_SIZE,
  DEFAULT_PAGE_SIZES,
} from '../../../../lib/plugins/pagination/registry'
import { DEFAULT_MAX_EXPANDING_DEPTH } from '../../../../lib/plugins/rowExpanding/registry'
import { DEFAULT_ROW_DRAG_EXPAND_DELAY } from '../../../../lib/plugins/rowDragging/getRowDraggingEvents'
import { DEFAULT_SKELETON_OPTIONS } from '../../../../lib/core/skeletonOptions'
import { DEFAULT_REFRESH_OPTIONS } from '../../../../lib/core/loadingDisplay'
import { DEFAULT_COLUMN } from '../../../../lib/core/defaultColumn'
import {
  DEFAULT_ROW_HEIGHT,
  MIN_HEADER_HEIGHT,
  MIN_ROW_HEIGHT,
} from '../../../../lib/core/rowHeights'
import { COLUMN_COUNT, DATA_COUNT } from '../../DataGridStory.types'

/** Умолчания настроек-данных фильтров и поиска — те же, что у фабрик. */
export const DEFAULT_COLUMN_FILTERING_OPTIONS = {
  debounceMs: DEFAULT_FILTER_DEBOUNCE_MS,
  filteredCount: false,
}
export const DEFAULT_QUICK_SEARCH_OPTIONS = {
  debounceMs: DEFAULT_SEARCH_DEBOUNCE_MS,
  filteredCount: false,
}

const numberControl = (
  description: string,
  range: { min: number; max: number; step: number },
  defaultSummary: string,
): InputType => ({
  control: { type: 'number', ...range },
  description,
  table: { defaultValue: { summary: defaultSummary } },
})

/**
 * Размер текстом (ADR 0117, SN9): числовой контрол Storybook пустого значения не
 * принимает. Пусто — умолчание, число — пиксели, иное — CSS-значение.
 */
const sizeControl = (
  description: string,
  defaultSummary: string,
): InputType => ({
  control: 'text',
  description,
  table: { defaultValue: { summary: defaultSummary } },
})

const booleanControl = (
  description: string,
  defaultValue = false,
): InputType => ({
  control: 'boolean',
  description,
  table: { defaultValue: { summary: String(defaultValue) } },
})

const radioControl = (
  description: string,
  options: string[],
  defaultSummary: string,
): InputType => ({
  control: 'inline-radio',
  options,
  description,
  table: { defaultValue: { summary: defaultSummary } },
})

/** Пояс дат таблицы (ADR 0169, §5). */
export const timeZoneType: InputType = {
  control: 'text',
  description:
    'Часовой пояс дат таблицы, IANA (`timeZone`): фильтр дат и выгрузка; по умолчанию — пояс браузера',
}

/** Режим данных (ADR 0169): одна радиокнопка на все операции. */
export const dataModeType = radioControl(
  'Где выполняются операции над строками (`dataMode`): `server` — таблица меняет состояние и вызывает колбэки, а строки не переставляет и не сужает — сервера в истории нет',
  ['client', 'server'],
  'client',
)

const objectControl = (
  description: string,
  typeSummary: string,
  defaultValue: object,
): InputType => ({
  control: 'object',
  description,
  table: {
    type: { summary: typeSummary },
    defaultValue: { summary: JSON.stringify(defaultValue) },
  },
})

/**
 * Флаг панели вне скролла (ADR 0046): «auto» — по наличию слотов плагинов, «on» —
 * всегда, «off» — никогда.
 */
const panelFlag = (description: string): InputType => ({
  control: 'inline-radio',
  options: ['auto', 'on', 'off'],
  mapping: { auto: undefined, on: true, off: false },
  description,
  table: { defaultValue: { summary: 'auto' } },
})

/** Раскладывает контролы истории по группе (и подгруппе) панели Controls. */
export const inCategory = <T extends Record<string, InputType>>(
  category: string,
  types: T,
  subcategory?: string,
): T =>
  Object.fromEntries(
    Object.entries(types).map(([name, type]) => [
      name,
      { ...type, table: { ...type.table, category, subcategory } },
    ]),
  ) as T

// --- Данные и размеры ---------------------------------------------------------

export const columnCountType = numberControl(
  'Число колонок',
  { min: 0, max: 1000, step: 5 },
  String(COLUMN_COUNT),
)
export const dataCountType = numberControl(
  'Число строк',
  { min: 0, max: 100_000, step: 10 },
  String(DATA_COUNT),
)
export const dataNestingType = radioControl(
  'Вложенные строки: flat — без них, nested — дочерние строки у каждой 10-й строки (видны с раскрытием строк)',
  ['flat', 'nested'],
  'flat',
)
/** Язык подписей задаёт переключатель Language в тулбаре: в панели Controls его нет. */
export const localeType: InputType = { table: { disable: true } }
export const heightType = sizeControl('Высота таблицы', '100%')
export const maxHeightType = sizeControl('Максимальная высота таблицы', '100%')
export const containerSizeType = sizeControl(
  'Высота контейнера таблицы',
  'по содержимому',
)
export const expandAllType = booleanControl(
  'Раскрыть все строки (`expanded: true`), выключить — свернуть все; на лету',
)
export const showStubType = booleanControl(
  'Пустые данные: таблица показывает заглушку «нет данных»',
)
export const rowHeightType = numberControl(
  `Высота строки, минимум ${MIN_ROW_HEIGHT}px`,
  { min: MIN_ROW_HEIGHT, max: 120, step: 2 },
  String(DEFAULT_ROW_HEIGHT),
)
export const headerHeightType = numberControl(
  `Высота строки хедера колонок, минимум ${MIN_HEADER_HEIGHT}px`,
  { min: MIN_HEADER_HEIGHT, max: 120, step: 2 },
  'как у строки',
)
export const defaultColumnType = objectControl(
  'Ширина колонок по умолчанию',
  '{ size?: number; minSize?: number; maxSize?: number }',
  { size: 150, ...DEFAULT_COLUMN },
)
export const headerNestingType = radioControl(
  'Вложенность хедера колонок: flat — одна строка, nested — группы колонок',
  ['flat', 'nested'],
  'flat',
)

// --- Ядро: панели и состояния -------------------------------------------------

/**
 * Загрузка (ADR 0106): `off` — нет, `initial` — скелет первой загрузки, `refresh` —
 * свечение обновления. В Controls это строка радио, до истории `mapping` доносит `false`.
 */
export const loadingType: InputType = {
  control: 'inline-radio',
  options: ['off', 'initial', 'refresh'],
  mapping: { off: false },
  description:
    'Загрузка данных (`loading`): `initial` — скелет первой загрузки, `refresh` — свечение под хедером колонок и приглушение тела (ADR 0094)',
  table: { defaultValue: { summary: 'false' } },
}
export const skeletonOptionsType = objectControl(
  'rowsCount — строк: число или `auto` (по высоте); columnsCount — колонок, только когда своих колонок нет',
  'SkeletonOptions',
  DEFAULT_SKELETON_OPTIONS,
)
/** Повышенный контраст (ADR 0088): по системе, всегда или никогда. */
export const contrastType: InputType = {
  control: 'inline-radio',
  options: ['auto', 'more', 'standard'],
  description:
    'Повышенный контраст (`contrast`): `auto` — по `prefers-contrast: more`, `more` — всегда, `standard` — никогда',
  table: { defaultValue: { summary: 'auto' } },
}
export const refreshOptionsType = objectControl(
  'Показ обновления: `delayMs` — задержка, `minDurationMs` — минимум показа, мс',
  'RefreshOptions',
  DEFAULT_REFRESH_OPTIONS,
)
export const enableFooterType = booleanControl('Футер колонок')
/** Положение футера (ADR 0118): у низа области или за последней строкой. */
export const footerPositionType: InputType = {
  control: 'inline-radio',
  options: ['pinned', 'inline'],
  description:
    'Положение футера (`footerPosition`): `pinned` — всегда у низа области, `inline` — за последней строкой, прокручивается с телом',
  table: { defaultValue: { summary: 'pinned' } },
}
export const enableToolbarType = panelFlag(
  'Верхний тулбар: auto — по наличию кнопок плагинов, on — всегда (и пустой), off — никогда',
)
export const enableStatusBarType = panelFlag(
  'Нижняя панель: auto — по наличию её слотов, on — всегда (и пустая), off — никогда',
)
export const enableAnnouncementsType = booleanControl(
  'Объявления скринридеру через live-область: сортировка, выбор, загрузка (`enableAnnouncements`)',
  true,
)

export const enableRowAnimationType = booleanControl(
  'Движение строк при смене модели: раскрытие, сортировка, фильтр, перестановка (`enableRowAnimation`, ADR 0107)',
  true,
)

export const enableColumnAnimationType = booleanControl(
  'Движение колонок при смене порядка: откат, клавиатура, меню ручки (`enableColumnAnimation`, ADR 0115)',
  true,
)

export const enableOverflowTooltipType = booleanControl(
  'Тултип с полным текстом у обрезанного многоточием текста ячейки (`enableOverflowTooltip`)',
  true,
)

// --- Колонки -------------------------------------------------------------------

export const enableColumnSortingType = booleanControl(
  'Сортировка кнопкой в заголовке (плагин `columnSorting`)',
)
export const columnSortingRemovalType = booleanControl(
  'Третий клик снимает сортировку (`removal`); иначе направление только переключается',
  true,
)
export const columnSortingMultiSortType = booleanControl(
  'Мультисортировка по нескольким колонкам жестом Shift+клик (`multiSort`); `max` и `event` — объектом из истории',
  true,
)
export const columnSortingRevertOnRejectType = booleanControl(
  'Откатывать сортировку при отказе промиса `onToggleColumnSort` в серверном режиме (`revertOnReject`, ADR 0116)',
  true,
)
export const enableColumnSortingModelType = booleanControl(
  'Сортировка без кнопок: порядок строк по состоянию `sorting` (плагин `columnSortingModel`)',
)
export const columnSortingModelMultiSortType = booleanControl(
  'Несколько колонок в срезе `sorting` (`multiSort`); иначе действует только первая',
  true,
)
export const enableColumnSizingType = booleanControl(
  'Изменение ширины колонок перетаскиванием границы (плагин `columnSizing`)',
)
export const enableColumnDraggingType = booleanControl(
  'Перестановка колонок перетаскиванием заголовка (плагин `columnDragging`)',
)
export const enableColumnPinningType = booleanControl(
  'Закрепление колонок кнопкой в заголовке (плагин `columnPinning`)',
)
export const retrySucceedsType = booleanControl('Повтор загрузки удаётся')
export const hideAllColumnsType = booleanControl(
  'Все колонки скрыты состоянием приложения (`columnVisibility`): заглушка «все колонки скрыты» (ADR 0123)',
)
export const pinFirstColumnType = booleanControl(
  'Первая колонка закреплена слева сразу при открытии (начальное закрепление, переключается на лету)',
)
export const columnPinningLeafPinningType = booleanControl(
  'Закрепление отдельных листьев под вложенным хедером колонок (`leafPinning`)',
)
export const enableColumnVisibilityType = booleanControl(
  'Кнопка «Колонки» в тулбаре: скрытие и показ колонок (плагин `columnVisibility`)',
)
export const enableHeaderActionMenuType = booleanControl(
  'Схлопывать кнопки заголовка в кебаб-меню (плагин `headerActionMenu`)',
)
const menuModeType = (description: string) =>
  radioControl(description, ['auto', 'always'], 'auto')
export const headerActionMenuModeType = menuModeType(
  'Кебаб заголовка: auto — от порога действий, always — всегда (`mode`)',
)
export const headerActionMenuThresholdType = numberControl(
  'С какого числа действий кнопки заголовка уходят в кебаб (`threshold`)',
  { min: 1, max: 10, step: 1 },
  String(DEFAULT_HEADER_ACTION_MENU.threshold),
)

// --- Строки --------------------------------------------------------------------

export const enableRowSelectionType = booleanControl(
  'Выбор строк чекбоксами (плагин `rowSelection`)',
)
export const enableRowSelectionModelType = booleanControl(
  'Выбор строк без флажков: выбранные строки по состоянию `rowSelection` (плагин `rowSelectionModel`)',
)
/**
 * Выбор вложенных строк (ADR 0162): нет — только строки верхнего уровня, `true` — с
 * потомками, `'self'` — каждая строка сама.
 */
const subRowsControl = (description: string): InputType => ({
  control: {
    type: 'inline-radio',
    labels: { false: 'off', true: 'cascade', self: 'self' },
  },
  options: [false, true, 'self'],
  description,
  table: { defaultValue: { summary: 'false' } },
})
export const rowSelectionModelSubRowsType = subRowsControl(
  'Выбор вложенных строк модели (`subRows`): `true` — с потомками, `self` — каждая строка сама',
)
export const rowSelectionSubRowsType = subRowsControl(
  'Флажки у вложенных строк (`subRows`): `true` — выбор с потомками, `self` — каждая строка сама',
)
export const rowSelectionSelectedCountType = booleanControl(
  'Счётчик выбранных строк в нижней панели (`selectedCount`)',
)
export const enableRowExpandingType = booleanControl(
  'Раскрытие строк с детьми (плагин `rowExpanding`)',
)
export const rowExpandingMaxDepthType = numberControl(
  'Сколько уровней раскрываемы от корня (`maxDepth`)',
  { min: 0, max: 10, step: 1 },
  String(DEFAULT_MAX_EXPANDING_DEPTH),
)
export const rowExpandingExpandAllType = booleanControl(
  'Кнопка «Раскрыть всё / Свернуть всё» в шапке колонки раскрытия (`expandAll`)',
  true,
)
export const rowExpandingStickyRowsType = booleanControl(
  'Строка ветки держится под шапкой, пока видны её дети (`stickyRows`)',
)
export const rowGroupingStickyRowsType = booleanControl(
  'Строка группы держится под шапкой, пока видны её строки (`stickyRows`)',
)
export const rowExpandingColumnType = radioControl(
  'Колонка тоггла раскрытия: auto — если есть строки с детьми, always — всегда (`column`)',
  ['auto', 'always'],
  'auto',
)
export const enableRowExpandingModelType = booleanControl(
  'Дерево без переключателя: подстроки по состоянию `expanded` (плагин `rowExpandingModel`)',
)
export const enableTreeLinesType = booleanControl(
  'Линии дерева у раскрытых строк и групп (плагин `treeLines`)',
)
export const enableRowDraggingType = booleanControl(
  'Перестановка строк перетаскиванием ручки (плагин `rowDragging`)',
)
export const rowDraggingExpandDelayType = numberControl(
  'Пауза над свёрнутой группой до её раскрытия, мс; 0 — не раскрывать (`expandDelay`)',
  { min: 0, max: 2000, step: 100 },
  String(DEFAULT_ROW_DRAG_EXPAND_DELAY),
)
export const rowDraggingRevertOnRejectType = booleanControl(
  'Откатывать перенос строки при отказе промиса `onRowDragEnd` (`revertOnReject`, ADR 0114)',
  true,
)
export const columnDraggingRevertOnRejectType = booleanControl(
  'Откатывать перенос колонки при отказе промиса `onColumnDragEnd` (`revertOnReject`, ADR 0114)',
  true,
)
export const enableRowGroupingType = booleanControl(
  'Группировка строк кнопкой в заголовке (плагин `rowGrouping`)',
)
export const enableRowGroupingModelType = booleanControl(
  'Группировка без кнопок: группы по состоянию `grouping` (плагин `rowGroupingModel`)',
)
export const enableRowActionsType = booleanControl(
  'Колонка действий строки с демо-кнопками (плагин `rowActions`)',
)
export const rowActionsWidthType = numberControl(
  'Ширина колонки действий с кнопками, px (`width`)',
  { min: 40, max: 400, step: 4 },
  String(DEFAULT_ROW_ACTIONS_OPTIONS.width),
)
export const rowActionsCollapsedWidthType = numberControl(
  'Ширина колонки действий, когда они в кебабе, px (`collapsedWidth`)',
  { min: 40, max: 400, step: 4 },
  String(DEFAULT_ROW_ACTIONS_OPTIONS.collapsedWidth),
)
export const rowActionsColumnType = radioControl(
  'Колонка действий: auto — если у строк есть действия, always — всегда (`column`)',
  ['auto', 'always'],
  'auto',
)
export const actionsDemoType = radioControl(
  'Набор действий строки: basic — правка, копия, удаление; async — с ответом сервера; nested — с разделами; none — без действий',
  ['basic', 'async', 'nested', 'none'],
  'basic',
)
export const enableRowActionMenuType = booleanControl(
  'Схлопывать действия строки в кебаб-меню (плагин `rowActionMenu`, нужен enableRowActions)',
)
export const rowActionMenuModeType = menuModeType(
  'Кебаб строки: auto — от порога действий, always — всегда (`mode`)',
)
export const rowActionMenuThresholdType = numberControl(
  'С какого числа действий кнопки строки уходят в кебаб (`threshold`)',
  { min: 1, max: 10, step: 1 },
  String(DEFAULT_ROW_ACTION_MENU.threshold),
)

// --- Ячейки и клавиатура -------------------------------------------------------

export const enableCellEditingType = booleanControl(
  'Правка ячеек Age, Visits, Gender: кнопка по наведению (плагин `cellEditing`)',
)
export const enableCellErrorsType = booleanControl(
  'Ошибки ячеек: красная точка у Visits больше 15 (плагин `cellErrors`)',
)
export const enableCellSelectionType = booleanControl(
  'Выделение диапазона ячеек мышью и копирование Ctrl/Cmd+C (плагин `cellSelection`)',
)
export const enableCellSelectionModelType = booleanControl(
  'Выделение ячеек без мыши: подсветка по состоянию `cellSelection` (плагин `cellSelectionModel`)',
)
export const cellSelectionRangeSelectionType = booleanControl(
  'Диапазон Shift-кликом (`rangeSelection`)',
  true,
)
export const cellSelectionDragSelectionType = booleanControl(
  'Диапазон протяжкой мыши (`dragSelection`)',
  true,
)
export const cellSelectionMultiRangeType = booleanControl(
  'Несколько диапазонов с Ctrl/Cmd (`multiRange`)',
  true,
)
export const cellSelectionMaxCopyRowsType = numberControl(
  'Больше строк выделения копирование не кладёт в буфер (`maxCopyRows`)',
  { min: 1, max: 1_000_000, step: 1 },
  '10000',
)
export const enableContextMenuType = booleanControl(
  'Контекстное меню по правому клику (плагин `contextMenu`)',
)
export const enableKeyboardNavigationType = booleanControl(
  'Навигация по ячейкам стрелками: роль grid, roving tabindex (плагин `keyboardNavigation`)',
)

// --- Поиск, фильтры, страницы, экспорт -----------------------------------------

const debounceType = (description: string, defaultMs: number) =>
  numberControl(description, { min: 0, max: 2000, step: 50 }, String(defaultMs))

export const enableQuickSearchType = booleanControl(
  'Быстрый поиск в тулбаре по видимым колонкам (плагин `quickSearch`)',
)
export const quickSearchDebounceMsType = debounceType(
  'Задержка ввода поиска, мс (`debounceMs`)',
  DEFAULT_SEARCH_DEBOUNCE_MS,
)
export const quickSearchFilteredCountType = booleanControl(
  '«Показано N из M» в нижней панели (`filteredCount`)',
)
export const enableColumnFilteringType = booleanControl(
  'Фильтры колонок с полем filter: Country и имена — текст, Age, Visits, Total — число (плагин `columnFiltering`)',
)
export const columnFilteringDebounceMsType = debounceType(
  'Задержка ввода фильтра, мс (`debounceMs`)',
  DEFAULT_FILTER_DEBOUNCE_MS,
)
export const columnFilteringFilteredCountType = booleanControl(
  '«Показано N из M» в нижней панели (`filteredCount`)',
)
export const enableColumnFilteringModelType = booleanControl(
  'Фильтры без кнопок: строки по состоянию `columnFilters` (плагин `columnFilteringModel`)',
)
export const enableQuickSearchModelType = booleanControl(
  'Поиск без поля: строки по состоянию `globalFilter` (плагин `quickSearchModel`)',
)
export const enableInfiniteScrollType = booleanControl(
  'Бесконечная прокрутка — лента: у края таблица просит блок (плагин `infiniteScroll`); данные дописывает история',
)
export const infiniteScrollThresholdType = numberControl(
  'За сколько строк до края просить блок (`threshold`)',
  { min: 0, max: 200, step: 5 },
  '—',
)
export const infiniteScrollLoadedCountType = booleanControl(
  'Счётчик загруженных строк в нижней панели (`loadedCount`)',
)
export const enableServerRowModelType = booleanControl(
  'Серверная модель строк: строки блоками с сервера по окну прокрутки, кэш у таблицы (плагин `serverRowModel`); загрузчик задаёт история',
)
export const serverRowModelBlockSizeType = numberControl(
  'Строк в блоке (`blockSize`)',
  { min: 10, max: 500, step: 10 },
  '100',
)
export const serverRowModelMaxBlocksType = numberControl(
  'Сколько блоков держать в кэше (`maxBlocks`)',
  { min: 1, max: 200, step: 1 },
  '100',
)
export const enableBackToTopType = booleanControl(
  'Кнопки «наверх» и «к первой колонке» в нижней панели: видны после прокрутки на два экрана, встают только в уже показанную панель (плагин `backToTop`)',
)
export const backToTopThresholdType = numberControl(
  'С какой вертикальной прокрутки видна «наверх», px (`threshold`); по умолчанию — две высоты тела',
  { min: 0, max: 20000, step: 100 },
  '—',
)
export const backToTopHorizontalThresholdType = numberControl(
  'С какой горизонтальной прокрутки видна «к первой колонке», px (`horizontalThreshold`); по умолчанию — две ширины тела',
  { min: 0, max: 20000, step: 100 },
  '—',
)
export const backToTopAxesType = radioControl(
  'Какие кнопки показывать (`axes`)',
  ['vertical', 'horizontal', 'both'],
  'both',
)
export const enablePaginationType = booleanControl(
  'Пагинация в нижней панели (плагин `pagination`)',
)
export const paginationInitialPageSizeType = numberControl(
  'Начальный размер страницы (`initialPageSize`)',
  { min: 1, max: 1000, step: 5 },
  String(DEFAULT_PAGE_SIZE),
)
export const paginationPageSizesType = objectControl(
  'Варианты размера страницы в нижней панели; `false` — без выбора (`pageSizes`)',
  'number[] | false',
  DEFAULT_PAGE_SIZES,
)
export const paginationRevertOnRejectType = booleanControl(
  'Возвращать прежнюю страницу при отказе промиса `onPageChange` в серверном режиме (`revertOnReject`, ADR 0116)',
  true,
)
export const enablePaginationModelType = booleanControl(
  'Страницы без пейджера: строки текущей страницы по состоянию `pagination` (плагин `paginationModel`)',
)
export const paginationModelInitialPageSizeType = numberControl(
  'Начальный размер страницы модели (`initialPageSize`)',
  { min: 1, max: 1000, step: 5 },
  String(DEFAULT_PAGE_SIZE),
)
export const enableDataExportModelType = booleanControl(
  'Выгрузка без кнопки: только `table.exportData` (плагин `dataExportModel`)',
)
export const enableDataExportType = booleanControl(
  'Кнопка «Экспорт» в тулбаре: панель настроек и выгрузка в CSV (плагин `dataExport`)',
)
export const dataExportAllowType = objectControl(
  'Оси экспорта, доступные пользователю (`allow`)',
  'ExportAllow',
  {},
)
export const dataExportFilenameType: InputType = {
  control: 'text',
  description: 'Имя файла без расширения (`filename`); по умолчанию `export`',
  table: { defaultValue: { summary: 'export' } },
}
