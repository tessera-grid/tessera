import { ArgTypes, InputType } from 'storybook/internal/csf'

import { DEFAULT_ROW_ACTIONS_OPTIONS } from '../../../plugins/rowActions'
import { DEFAULT_SKELETON_OPTIONS } from '../../../core/skeletonOverlay/options'

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
