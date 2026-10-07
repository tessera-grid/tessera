import { ArgTypes, InputType } from 'storybook/internal/csf'

import { DEFAULT_ROW_ACTIONS_OPTIONS } from '../../../../lib/plugins/rowActions'
import { DEFAULT_SKELETON_OPTIONS } from '../../../../lib/core/skeletonOptions'

export const columnCountType: ArgTypes = {
  control: { type: 'number', min: 1, max: 1000, step: 5 },
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  description: 'Количество колонок',
  table: {
    defaultValue: { summary: 'Storybook-параметр' },
  },
}

export const dataCountType: ArgTypes = {
  control: { type: 'number', min: 1, max: 1000, step: 10 },
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  description: 'Количество строк',
  table: {
    defaultValue: { summary: 'Storybook-параметр' },
  },
}

export const containerHeightType: ArgTypes = {
  control: { type: 'number', min: 100, max: 1000, step: 100 },
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  description: 'Высота контейнера таблицы',
  table: {
    defaultValue: { summary: 'Storybook-параметр' },
  },
}

export const numberHeightType: ArgTypes = {
  control: { type: 'number', min: 100, max: 1000, step: 100 },
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  description: 'Высота таблицы',
  table: {
    defaultValue: { summary: '100%' },
  },
}

export const numberMaxHeightType: ArgTypes = {
  control: { type: 'number', min: 100, max: 1000, step: 100 },
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  description: 'Максимальная высота таблицы',
  table: {
    defaultValue: { summary: '100%' },
  },
}

export const enableSkeletonType: ArgTypes = {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  control: 'boolean',
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  description: 'Включить отображение скелетонов',
  table: {
    defaultValue: { summary: false },
  },
}

export const skeletonOptionsType: ArgTypes = {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  control: 'object',
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  description: 'Задать количество колонок и строк для отображения скелетонов',
  table: {
    defaultValue: {
      summary: DEFAULT_SKELETON_OPTIONS,
    },
    type: {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      summary: 'SkeletonOptions',
    },
  },
}

export const enableLoadingType: ArgTypes = {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  control: 'boolean',
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  description: 'Включить отображение прогресс-бара',
  table: {
    defaultValue: { summary: false },
  },
}

export const showStubType: ArgTypes = {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  control: 'boolean',
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  description: 'Включить отображение заглушки',
  table: {
    defaultValue: { summary: 'Storybook-параметр' },
  },
}

export const showHeaderGroupsType: ArgTypes = {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  control: 'boolean',
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  description: 'Включить режим сгруппированных заголовков',
  table: {
    defaultValue: { summary: 'Storybook-параметр' },
  },
}

export const enableColumnSortingType: ArgTypes = {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  control: 'boolean',
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  description: 'Включить сортировку DESC/ASC',
  table: {
    defaultValue: { summary: false },
  },
}

export const enableSortingRemovalType: ArgTypes = {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  control: 'boolean',
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  description: 'Включить сброс сортировки DESC/ASC',
  table: {
    defaultValue: { summary: true },
  },
}

export const enableMultiSortType: ArgTypes = {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  control: 'boolean',
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  description: 'Мультисортировка по нескольким столбцам (жест Shift+клик)',
  table: {
    defaultValue: { summary: true },
  },
}

export const serverColumnSortingType: ArgTypes = {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  control: 'boolean',
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  description:
    'Включить сортировку DESC/ASC только на сервере [моки не реализованы]',
  table: {
    defaultValue: { summary: false },
  },
}

export const enableColumnResizingType: ArgTypes = {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  control: 'boolean',
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  description: 'Включить изменение ширины колонок',
  table: {
    defaultValue: { summary: false },
  },
}

export const enableColumnDraggingType: ArgTypes = {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  control: 'boolean',
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  description: 'Включить перетаскивание колонок',
  table: {
    defaultValue: { summary: false },
  },
}

export const enableColumnPinningType: ArgTypes = {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  control: 'boolean',
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  description: 'Включить закрепление колонок к левому краю',
  table: {
    defaultValue: { summary: false },
  },
}

export const enableGroupingType: ArgTypes = {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  control: 'boolean',
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  description: 'Включить группировку данных',
  table: {
    defaultValue: { summary: false },
  },
}

export const enableRowSelectionType: ArgTypes = {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  control: 'boolean',
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  description: 'Включить выбор строк',
  table: {
    defaultValue: { summary: false },
  },
}

export const enableSubRowSelectionType: ArgTypes = {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  control: 'boolean',
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  description: 'Включить выбор подстрок',
  table: {
    defaultValue: { summary: false },
  },
}

export const enableRowExpandingType: ArgTypes = {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  control: 'boolean',
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  description: 'Включить разворачивание строк',
  table: {
    defaultValue: { summary: false },
  },
}

export const enableRowDraggingType: ArgTypes = {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  control: 'boolean',
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  description: 'Включить перетаскивание строк',
  table: {
    defaultValue: { summary: false },
  },
}

export const enableRowActionsType: ArgTypes = {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  control: 'boolean',
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  description: 'Включить отображение действий в каждой строке',
  table: {
    defaultValue: { summary: false },
  },
}

export const rowActionsOptionsType: ArgTypes = {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  control: 'object',
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  description: 'Задать ширину колонки действий над строкой',
  table: {
    defaultValue: {
      summary: DEFAULT_ROW_ACTIONS_OPTIONS,
    },
    type: {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      summary: 'RowActionsOptions',
    },
  },
}

export const enableCellEditingType: ArgTypes = {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  control: 'boolean',
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  description: 'Включить инлайн-редактирование ячейки (кнопка по hover)',
  table: {
    defaultValue: { summary: false },
  },
}

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

export const enableToolbarType = panelFlag(
  'Верхний тулбар: auto — по наличию кнопок плагинов, on — всегда (и пустой), off — никогда',
)
export const enableStatusBarType = panelFlag(
  'Нижняя панель: auto — по наличию её слотов, on — всегда (и пустая), off — никогда',
)

export const enableFooterType: ArgTypes = {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  control: 'boolean',
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  description: 'Включить отображение футера агрегированных значений',
  table: {
    defaultValue: { summary: false },
  },
}

/** Булев тумблер фичи: контрол `boolean`, по умолчанию выключен. */
const featureToggle = (description: string): ArgTypes => ({
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  control: 'boolean',
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  description,
  table: { defaultValue: { summary: false } },
})

export const enableLeafPinningType = featureToggle(
  'Закрепление отдельных листьев под вложенной шапкой (нужен enableColumnPinning)',
)
export const showSelectedCountType = featureToggle(
  'Счётчик выбранных строк в нижней панели (нужен enableRowSelection)',
)
export const enableHeaderActionMenuType = featureToggle(
  'Схлопывать кнопки заголовка в кебаб-меню',
)
export const enableRowActionMenuType = featureToggle(
  'Схлопывать действия строки в кебаб-меню (нужен enableRowActions)',
)
export const enableCellSelectionType = featureToggle(
  'Выделение диапазона ячеек мышью и копирование (Ctrl/Cmd+C)',
)
export const enableContextMenuType = featureToggle(
  'Контекстное меню по правому клику',
)
export const enableKeyboardNavigationType = featureToggle(
  'Клавиатурная навигация по ячейкам (role=grid, roving tabindex)',
)
export const enableColumnVisibilityType = featureToggle(
  'Кнопка «Колонки» в тулбаре: скрытие и показ колонок',
)
export const enablePaginationType = featureToggle('Пагинация в нижней панели')
export const enableColumnFilteringType = featureToggle(
  'Фильтры колонок: кнопка в заголовке колонки с полем filter (Country, имена — текст; Age, Visits, Total — число)',
)
export const enableQuickSearchType = featureToggle(
  'Быстрый поиск в тулбаре по видимым колонкам',
)
export const enableExportType = featureToggle(
  'Кнопка «Экспорт» в тулбаре: панель настроек и выгрузка в CSV',
)

export const disabledType: InputType = {
  control: 'boolean',
  description: 'Заблокировать кнопки?',
  table: {
    defaultValue: { summary: 'false' },
  },
}

export const activeType: InputType = {
  control: 'boolean',
  description: 'Включить активное состояние кнопок?',
  table: {
    defaultValue: { summary: 'false' },
  },
}

export const rowExpandingMaxDepthType: InputType = {
  control: { type: 'number', min: 1, max: 10, step: 1 },
  description:
    'Сколько уровней раскрываемы от корня (rowExpanding({ maxDepth }), нужен enableRowExpanding)',
  table: { defaultValue: { summary: '1' } },
}

export const rowExpandingColumnType: InputType = {
  control: 'inline-radio',
  options: ['auto', 'always'],
  description:
    'Колонка тоггла раскрытия: auto — по данным, always — всегда (нужен enableRowExpanding)',
  table: { defaultValue: { summary: 'auto' } },
}

export const rowExpandingTreeLinesType: InputType = {
  control: 'boolean',
  description:
    'Линии дерева по уровням (rowExpanding({ treeLines }), нужен enableRowExpanding)',
  table: { defaultValue: { summary: 'false' } },
}

export const rowActionsColumnType: InputType = {
  control: 'inline-radio',
  options: ['auto', 'always'],
  description:
    'Колонка действий строки: auto — по наличию действий, always — всегда (нужен enableRowActions)',
  table: { defaultValue: { summary: 'auto' } },
}

export const paginationPageSizeType: InputType = {
  control: { type: 'number', min: 1, max: 1000, step: 5 },
  description: 'Начальный размер страницы (нужен enablePagination)',
  table: { defaultValue: { summary: '25' } },
}
