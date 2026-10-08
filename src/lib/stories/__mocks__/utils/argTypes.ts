import type { InputType } from 'storybook/internal/csf'

import { DEFAULT_ROW_ACTIONS_OPTIONS } from '../../../../lib/plugins/rowActions'
import { DEFAULT_SKELETON_OPTIONS } from '../../../../lib/core/skeletonOptions'

const STORY_PARAM = 'параметр истории'

const numberControl = (
  description: string,
  range: { min: number; max: number; step: number },
  defaultSummary: string,
): InputType => ({
  control: { type: 'number', ...range },
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
  'Количество колонок мока',
  { min: 1, max: 1000, step: 5 },
  STORY_PARAM,
)
export const dataCountType = numberControl(
  'Количество строк верхнего уровня мока',
  { min: 0, max: 100_000, step: 10 },
  STORY_PARAM,
)
export const dataNestingType = radioControl(
  'Вложенность строк мока: flat — плоские, nested — дети у каждой 10-й строки (видны с раскрытием строк)',
  ['flat', 'nested'],
  'flat',
)
export const containerHeightType = numberControl(
  'Высота контейнера вокруг грида, px',
  { min: 100, max: 1000, step: 100 },
  STORY_PARAM,
)
export const numberHeightType = numberControl(
  'Высота грида (`height`), px',
  { min: 100, max: 1000, step: 100 },
  '100%',
)
export const numberMaxHeightType = numberControl(
  'Максимальная высота грида (`maxHeight`), px',
  { min: 100, max: 1000, step: 100 },
  '100%',
)
export const showStubType = booleanControl(
  'Пустые данные: грид показывает заглушку «нет данных»',
)
export const headerNestingType = radioControl(
  'Вложенность шапки: flat — плоская, nested — группы заголовков',
  ['flat', 'nested'],
  'flat',
)

// --- Ядро: панели и состояния -------------------------------------------------

export const enableSkeletonType = booleanControl(
  'Скелеты вместо содержимого ячеек (`enableSkeleton`)',
)
export const skeletonOptionsType = objectControl(
  'rowsCount — строк: число или `auto` (по высоте); columnsCount — колонок, только когда своих колонок нет',
  'SkeletonOptions',
  DEFAULT_SKELETON_OPTIONS,
)
export const enableLoadingType = booleanControl(
  'Прогресс-бар загрузки над телом грида (`enableLoading`)',
)
export const enableFooterType = booleanControl(
  'Футер с агрегированными значениями колонок (`enableFooter`)',
)
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

// --- Колонки -------------------------------------------------------------------

export const enableColumnSortingType = booleanControl(
  'Сортировка кнопкой в заголовке (плагин `columnSorting`)',
)
export const enableSortingRemovalType = booleanControl(
  'Третий клик снимает сортировку (`removal`); иначе направление только переключается',
  true,
)
export const enableMultiSortType = booleanControl(
  'Мультисортировка по нескольким колонкам жестом Shift+клик (`multiSort`)',
  true,
)
export const serverColumnSortingType = booleanControl(
  'Серверная сортировка (`server`): меняется только состояние и колбэк, порядок строк мока не меняется',
)
export const enableColumnResizingType = booleanControl(
  'Изменение ширины колонок перетаскиванием границы (плагин `columnSizing`)',
)
export const enableColumnDraggingType = booleanControl(
  'Перестановка колонок перетаскиванием заголовка (плагин `columnDragging`)',
)
export const enableColumnPinningType = booleanControl(
  'Закрепление колонок кнопкой в заголовке (плагин `columnPinning`)',
)
export const enableLeafPinningType = booleanControl(
  'Закрепление отдельных листьев под вложенной шапкой (`leafPinning`, нужен enableColumnPinning)',
)
export const enableColumnVisibilityType = booleanControl(
  'Кнопка «Колонки» в тулбаре: скрытие и показ колонок (плагин `columnVisibility`)',
)
export const enableHeaderActionMenuType = booleanControl(
  'Схлопывать кнопки заголовка в кебаб-меню (плагин `headerActionMenu`)',
)

// --- Строки --------------------------------------------------------------------

export const enableRowSelectionType = booleanControl(
  'Выбор строк чекбоксами (плагин `rowSelection`)',
)
export const enableSubRowSelectionType = booleanControl(
  'Выбор строки выбирает её потомков (`subRows`, нужен enableRowSelection)',
)
export const showSelectedCountType = booleanControl(
  'Счётчик выбранных строк в нижней панели (`selectedCount`, нужен enableRowSelection)',
)
export const enableRowExpandingType = booleanControl(
  'Раскрытие строк с детьми (плагин `rowExpanding`)',
)
export const rowExpandingMaxDepthType = numberControl(
  'Сколько уровней раскрываемы от корня (`maxDepth`, нужен enableRowExpanding)',
  { min: 0, max: 10, step: 1 },
  '1',
)
export const rowExpandingColumnType = radioControl(
  'Колонка тоггла раскрытия: auto — если есть строки с детьми, always — всегда (`column`, нужен enableRowExpanding)',
  ['auto', 'always'],
  'auto',
)
export const rowExpandingTreeLinesType = booleanControl(
  'Линии дерева по уровням (`treeLines`, нужен enableRowExpanding)',
)
export const enableRowDraggingType = booleanControl(
  'Перестановка строк перетаскиванием ручки (плагин `rowDragging`)',
)
export const enableGroupingType = booleanControl(
  'Группировка строк кнопкой в заголовке (плагин `rowGrouping`)',
)
export const enableRowActionsType = booleanControl(
  'Колонка действий строки с демо-кнопками (плагин `rowActions`)',
)
export const rowActionsOptionsType = objectControl(
  'Ширина колонки действий: width — с кнопками, collapsedWidth — в кебабе (нужен enableRowActions)',
  'RowActionsOptions',
  DEFAULT_ROW_ACTIONS_OPTIONS,
)
export const rowActionsColumnType = radioControl(
  'Колонка действий: auto — если у строк есть действия, always — всегда (`column`, нужен enableRowActions)',
  ['auto', 'always'],
  'auto',
)
export const enableRowActionMenuType = booleanControl(
  'Схлопывать действия строки в кебаб-меню (плагин `rowActionMenu`, нужен enableRowActions)',
)

// --- Ячейки и клавиатура -------------------------------------------------------

export const enableCellEditingType = booleanControl(
  'Правка ячеек Age, Visits, Gender: кнопка по наведению (плагин `cellEditing`)',
)
export const enableCellSelectionType = booleanControl(
  'Выделение диапазона ячеек мышью и копирование Ctrl/Cmd+C (плагин `cellSelection`)',
)
export const enableContextMenuType = booleanControl(
  'Контекстное меню по правому клику (плагин `contextMenu`)',
)
export const enableKeyboardNavigationType = booleanControl(
  'Навигация по ячейкам стрелками: роль grid, roving tabindex (плагин `keyboardNavigation`)',
)

// --- Поиск, фильтры, страницы, экспорт -----------------------------------------

export const enableQuickSearchType = booleanControl(
  'Быстрый поиск в тулбаре по видимым колонкам (плагин `quickSearch`)',
)
export const enableColumnFilteringType = booleanControl(
  'Фильтры колонок с полем filter: Country и имена — текст, Age, Visits, Total — число (плагин `columnFiltering`)',
)
export const enablePaginationType = booleanControl(
  'Пагинация в нижней панели (плагин `pagination`)',
)
export const paginationPageSizeType = numberControl(
  'Начальный размер страницы (`initialPageSize`, нужен enablePagination)',
  { min: 1, max: 1000, step: 5 },
  '25',
)
export const enableExportType = booleanControl(
  'Кнопка «Экспорт» в тулбаре: панель настроек и выгрузка в CSV (плагин `dataExport`)',
)
