import { CSSProperties, memo, useLayoutEffect, useRef, useState } from 'react'

import { Meta, StoryObj } from '@storybook/react'
import {
  type ColumnPinningState,
  type Updater,
  functionalUpdate,
} from '@tanstack/react-table'

import { Grid } from './_shims'
import { DATA_GRID_THEME_CLASS } from '../ui/theme'
import type { TesseraFeatureEntry } from '../core/features'
import type { RowSelectionValue } from '../../lib/core/rowSelectionAll'
import { useCreateTable } from '../../lib/core/useCreateTable'
import { DataGrid } from '../../lib/grid/DataGrid'
import {
  columnPinning,
  columnSizing,
  columnSorting,
  columnVisibility,
  rowActions,
  rowDragging,
  rowSelection,
} from '../../lib/plugins'
import { useColumns } from './__mocks__/columns'
import { getData, useData } from './__mocks__/data'
import { rowActionsDemo } from './__mocks__/plugins/rowActionsDemo/rowActionsDemo'
import { expect, userEvent } from 'storybook/test'
import { guideNext, settle, until } from './__mocks__/catalogPlay'
import { guideControls } from './__mocks__/utils/dataGridControls'
import type { StoryProps } from './DataGridStory.types'
import { DemoStory, type DemoStoryStep, guideArgs } from './demos/DemoStory'
import { type StoryText, textOf } from './__mocks__/storyText'
import { useStoryText } from './__mocks__/storyLocale'

// История витрины темизации: контролы Storybook меняют цвет токена, значение
// прокидывается в грид инлайн-`style` обёртки (бьёт дефолты слоя из theme.css).
// Три поверхности переопределения по уровням токенов, от общего к частному:
//   • «shadcn — мост (broad)» — апстрим-токены (`--primary`/`--foreground`/…):
//     интеграция с дизайн-системой приложения; каскадит во всё.
//   • «Semantic (--tsr-sys-*)» — роли грида (fg/surface/accent/overlay…): средний
//     рычаг, меняет всю группу; тема-зависимый уровень (флипается в dark).
//   • «Component (--tsr-comp-*)» — прямые токены части: точечный оверрайд
//     конкретного элемента, не трогая уровни выше.
// Primitive (`--tsr-ref-*`) в витрину не выносим — это не поверхность
// переопределения.

interface TokenControl {
  /** CSS-переменная, в которую пишется значение. */
  token: string
  /** Имя arg в Storybook. */
  arg: string
  /** Читаемая подпись контрола. */
  label: string
  /** Описание для колонки Description в панели контролов; палитра рисует его на языке истории. */
  desc: StoryText | string
}

// Апстрим-палитра shadcn — верхний рычаг: правка влияет на все токены грида.
const PALETTE: TokenControl[] = [
  {
    token: '--background',
    arg: 'background',
    label: 'background',
    desc: {
      ru: 'Базовый фон холста. Задаёт фон нечётных строк, их закреплённых ячеек и drag-клона.',
      en: 'Base canvas background. Sets the background of odd rows, their pinned cells, and the drag clone.',
    },
  },
  {
    token: '--foreground',
    arg: 'foreground',
    label: 'foreground',
    desc: {
      ru: 'Основные «чернила» (текст/иконки). База для hover/selected-фонов, цвета контролов, скелетона, фокус-ринга.',
      en: 'Main “ink” (text/icons). The base for hover/selected backgrounds, control colors, the skeleton, and the focus ring.',
    },
  },
  {
    token: '--card',
    arg: 'card',
    label: 'card',
    desc: {
      ru: 'Фон карточки. Задаёт фон чётных строк, их закреплённых ячеек, кнопок действий и thumb переключателя.',
      en: 'Card background. Sets the background of even rows, their pinned cells, action buttons, and the switch thumb.',
    },
  },
  {
    token: '--muted',
    arg: 'muted',
    label: 'muted',
    desc: {
      ru: 'Приглушённый фон. Задаёт фон шапки и футера, включая закреплённые ячейки шапки.',
      en: 'Muted background. Sets the background of the header and footer, including pinned header cells.',
    },
  },
  {
    token: '--primary',
    arg: 'primary',
    label: 'primary',
    desc: {
      ru: 'Акцент/чернила. Задаёт аутлайн ячейки, заливку чекбокса, включённый трек switch, accent.',
      en: 'Accent/ink. Sets the cell outline, checkbox fill, the switch track when on, and accent.',
    },
  },
  {
    token: '--primary-foreground',
    arg: 'primaryForeground',
    label: 'primary-foreground',
    desc: {
      ru: 'Контраст к primary. Задаёт цвет галочки чекбокса.',
      en: 'Contrast color for primary. Sets the checkbox check mark color.',
    },
  },
  {
    token: '--border',
    arg: 'border',
    label: 'border',
    desc: {
      ru: 'Цвет hairline-границ. Задаёт границы контролов и разделитель закреплённых колонок.',
      en: 'Hairline border color. Sets control borders and the pinned column divider.',
    },
  },
  {
    token: '--destructive',
    arg: 'destructive',
    label: 'destructive',
    desc: {
      ru: 'Цвет ошибки/опасности. Свет и плашка ошибки загрузки, отказ действия, полоски слота при недопустимом drop.',
      en: 'Error/danger color. The load error glow and banner, action refusal, and slot bars on an invalid drop.',
    },
  },
  {
    token: '--info',
    arg: 'info',
    label: 'info (loader)',
    desc: {
      ru: 'Семантический синий (статус). По умолчанию — цвет бегущей полосы прогресс-бара.',
      en: 'Semantic blue (status). By default, the color of the moving progress bar.',
    },
  },
]

// Semantic-уровень грида (--tsr-sys-*) — средний рычаг: роли, из которых выводятся
// component-токены. Тема-зависим (флипается в dark). Правка роли меняет всю группу.
const SEMANTIC: TokenControl[] = [
  {
    token: '--tsr-sys-fg',
    arg: 'sysFg',
    label: 'sys-fg',
    desc: {
      ru: 'Роль «чернил». База для текста, hover/selected-оверлеев, контролов, скелетона.',
      en: 'The “ink” role. The base for text, hover/selected overlays, controls, and the skeleton.',
    },
  },
  {
    token: '--tsr-sys-bg',
    arg: 'sysBg',
    label: 'sys-bg',
    desc: {
      ru: 'Роль базового фона. Фон нечётных строк, их закреплённых ячеек и drag-клона.',
      en: 'The base background role. The background of odd rows, their pinned cells, and the drag clone.',
    },
  },
  {
    token: '--tsr-sys-surface',
    arg: 'sysSurface',
    label: 'sys-surface',
    desc: {
      ru: 'Роль поверхности. Фон чётных строк, их закреплённых ячеек, кнопок действий, thumb переключателя.',
      en: 'The surface role. The background of even rows, their pinned cells, action buttons, and the switch thumb.',
    },
  },
  {
    token: '--tsr-sys-muted',
    arg: 'sysMuted',
    label: 'sys-muted',
    desc: {
      ru: 'Роль приглушённого фона. Шапка и футер, включая закреплённые ячейки шапки.',
      en: 'The muted background role. The header and footer, including pinned header cells.',
    },
  },
  {
    token: '--tsr-sys-accent',
    arg: 'sysAccent',
    label: 'sys-accent',
    desc: {
      ru: 'Роль акцента. Аутлайн ячейки, чекбокс, трек switch, accept-drop.',
      en: 'The accent role. The cell outline, checkbox, switch track, and accept-drop.',
    },
  },
  {
    token: '--tsr-sys-accent-fg',
    arg: 'sysAccentFg',
    label: 'sys-accent-fg',
    desc: {
      ru: 'Контраст к accent. Цвет галочки чекбокса.',
      en: 'Contrast color for accent. The checkbox check mark color.',
    },
  },
  {
    token: '--tsr-sys-border',
    arg: 'sysBorder',
    label: 'sys-border',
    desc: {
      ru: 'Роль границы. Границы контролов, разделитель закреплённых колонок.',
      en: 'The border role. Control borders and the pinned column divider.',
    },
  },
  {
    token: '--tsr-sys-ring',
    arg: 'sysRing',
    label: 'sys-ring',
    desc: {
      ru: 'База кольца фокуса контролов.',
      en: 'The base of the control focus ring.',
    },
  },
  {
    token: '--tsr-sys-danger',
    arg: 'sysDanger',
    label: 'sys-danger',
    desc: {
      ru: 'Роль опасности. Свет и плашка ошибки загрузки, отказ действия, полоски слота при недопустимом drop.',
      en: 'The danger role. The load error glow and banner, action refusal, and slot bars on an invalid drop.',
    },
  },
  {
    token: '--tsr-sys-info',
    arg: 'sysInfo',
    label: 'sys-info',
    desc: {
      ru: 'Роль статуса. По умолчанию — цвет полосы прогресс-бара.',
      en: 'The status role. By default, the progress bar color.',
    },
  },
  {
    token: '--tsr-sys-success',
    arg: 'sysSuccess',
    label: 'sys-success',
    desc: {
      ru: 'Роль успеха. Тон подсветки и вспышки «успех» — в демо вторая строка.',
      en: 'The success role. The tone of the “success” highlight and flash; the second row in the demo.',
    },
  },
  {
    token: '--tsr-sys-warning',
    arg: 'sysWarning',
    label: 'sys-warning',
    desc: {
      ru: 'Роль предупреждения. Тон подсветки и вспышки «предупреждение» — в демо третья строка.',
      en: 'The warning role. The tone of the “warning” highlight and flash; the third row in the demo.',
    },
  },
  {
    token: '--tsr-sys-overlay-hover',
    arg: 'sysOverlayHover',
    label: 'sys-overlay-hover',
    desc: {
      ru: 'Слой наведения строк и ячеек целиком. Силу тона без смены цвета задаёт tint-hover.',
      en: 'The hover layer of rows and cells as a whole. tint-hover sets its strength without changing the color.',
    },
  },
  {
    token: '--tsr-sys-overlay-selected',
    arg: 'sysOverlaySelected',
    label: 'sys-overlay-selected',
    desc: {
      ru: 'Слой выбранной строки целиком. Силу тона без смены цвета задаёт tint-selected.',
      en: 'The selected row layer as a whole. tint-selected sets its strength without changing the color.',
    },
  },
]

// Component-уровень (--tsr-comp-*) — точечный оверрайд конкретного элемента.
const GRID_TOKENS: TokenControl[] = [
  {
    token: '--tsr-comp-head-bg',
    arg: 'headBg',
    label: 'head-bg',
    desc: {
      ru: 'Фон ячеек шапки.',
      en: 'Header cell background.',
    },
  },
  {
    token: '--tsr-comp-head-cell-hovered-bg',
    arg: 'headHoverBg',
    label: 'head-cell-hovered-bg',
    desc: {
      ru: 'Фон ячейки шапки при наведении.',
      en: 'Header cell background on hover.',
    },
  },
  {
    token: '--tsr-comp-head-cell-pinned-bg',
    arg: 'headPinnedBg',
    label: 'head-cell-pinned-bg',
    desc: {
      ru: 'Фон закреплённой ячейки шапки.',
      en: 'Pinned header cell background.',
    },
  },
  {
    token: '--tsr-comp-row-bg',
    arg: 'rowBg',
    label: 'row-bg',
    desc: {
      ru: 'Фон чётных строк тела.',
      en: 'Background of even body rows.',
    },
  },
  {
    token: '--tsr-comp-row-odd-bg',
    arg: 'rowOddBg',
    label: 'row-odd-bg',
    desc: {
      ru: 'Фон нечётных строк (зебра).',
      en: 'Background of odd rows (zebra).',
    },
  },
  {
    token: '--tsr-comp-row-hovered-bg',
    arg: 'rowHoverBg',
    label: 'row-hovered-bg',
    desc: {
      ru: 'Слой строки при наведении курсора — поверх её фона.',
      en: 'The row layer on hover, over its background.',
    },
  },
  {
    token: '--tsr-comp-row-selected-bg',
    arg: 'rowSelectedBg',
    label: 'row-selected-bg',
    desc: {
      ru: 'Слой выбранной (отмеченной) строки — поверх её фона.',
      en: 'The layer of a selected (checked) row, over its background.',
    },
  },
  {
    token: '--tsr-comp-row-selected-hovered-bg',
    arg: 'rowSelectedHoverBg',
    label: 'row-selected-hovered-bg',
    desc: {
      ru: 'Слой выбранной строки под курсором.',
      en: 'The layer of a selected row under the pointer.',
    },
  },
  {
    token: '--tsr-comp-cell-divider-color',
    arg: 'cellDivider',
    label: 'cell-divider-color',
    desc: {
      ru: 'Разделители строк и ячеек.',
      en: 'Row and cell dividers.',
    },
  },
  {
    token: '--tsr-comp-frame-border-color',
    arg: 'frameBorder',
    label: 'frame-border-color',
    desc: {
      ru: 'Рамка вокруг таблицы с тулбаром и нижней панелью.',
      en: 'The frame around the table with the toolbar and status bar.',
    },
  },
  {
    token: '--tsr-comp-toolbar-bg',
    arg: 'toolbarBg',
    label: 'toolbar-bg',
    desc: {
      ru: 'Фон тулбара над таблицей.',
      en: 'Background of the toolbar above the table.',
    },
  },
  {
    token: '--tsr-comp-status-bar-bg',
    arg: 'statusBarBg',
    label: 'status-bar-bg',
    desc: {
      ru: 'Фон нижней панели со счётчиком выбранных строк.',
      en: 'Background of the status bar with the selected rows counter.',
    },
  },
  {
    token: '--tsr-comp-cell-outline-color',
    arg: 'cellOutline',
    label: 'cell-outline-color',
    desc: {
      ru: 'Обводка ячейки тела при наведении и рамка поля правки в фокусе.',
      en: 'Body cell outline on hover and the frame of a focused edit field.',
    },
  },
  {
    token: '--tsr-comp-cell-pinned-left-bg',
    arg: 'pinnedBg',
    label: 'cell-pinned-left-bg',
    desc: {
      ru: 'Фон закреплённой ячейки чётной строки; у закреплённых справа — он же. Наведение и выбор ложатся слоем строки поверх.',
      en: 'Background of a pinned cell in an even row; the same for cells pinned on the right. Hover and selection are applied on top as the row layer.',
    },
  },
  {
    token: '--tsr-comp-cell-odd-pinned-left-bg',
    arg: 'pinnedOddBg',
    label: 'cell-odd-pinned-left-bg',
    desc: {
      ru: 'Фон закреплённой ячейки нечётной строки (зебра).',
      en: 'Background of a pinned cell in an odd row (zebra).',
    },
  },
  {
    token: '--tsr-comp-cell-pinned-border-color',
    arg: 'pinnedBorder',
    label: 'cell-pinned-border-color',
    desc: {
      ru: 'Цвет границы-разделителя закреплённых колонок.',
      en: 'Color of the pinned column divider.',
    },
  },
  {
    token: '--tsr-comp-control-color',
    arg: 'controlColor',
    label: 'control-color',
    desc: {
      ru: 'Цвет кнопок-иконок в покое: шапка, ячейки, строки, тулбар, меню, пагинация, поиск.',
      en: 'Color of icon buttons at rest: header, cells, rows, toolbar, menus, pagination, search.',
    },
  },
  {
    token: '--tsr-comp-control-active-color',
    arg: 'controlActive',
    label: 'control-active-color',
    desc: {
      ru: 'Цвет активного контрола (напр. включённой сортировки).',
      en: 'Color of an active control (e.g., active sorting).',
    },
  },
  {
    token: '--tsr-comp-focus-ring',
    arg: 'focusRing',
    label: 'focus-ring',
    desc: {
      ru: 'Цвет кольца фокуса на чекбоксе/переключателе/кнопке.',
      en: 'Focus ring color on a checkbox/switch/button.',
    },
  },
  {
    token: '--tsr-comp-checkbox-checked-bg',
    arg: 'checkboxBg',
    label: 'checkbox-checked-bg',
    desc: {
      ru: 'Фон отмеченного чекбокса выбора строки.',
      en: 'Background of a checked row selection checkbox.',
    },
  },
  {
    token: '--tsr-comp-checkbox-check-color',
    arg: 'checkboxCheck',
    label: 'checkbox-check-color',
    desc: {
      ru: 'Цвет галочки внутри чекбокса.',
      en: 'Color of the check mark inside the checkbox.',
    },
  },
  {
    token: '--tsr-comp-action-button-bg',
    arg: 'actionBg',
    label: 'action-button-bg',
    desc: {
      ru: 'Непрозрачный фон кнопок действий строки поверх содержимого; тень — `shadow-action`.',
      en: 'Opaque background of row action buttons over the content; the shadow is `shadow-action`.',
    },
  },
  {
    token: '--tsr-comp-accent',
    arg: 'accent',
    label: 'accent',
    desc: {
      ru: 'Акцент интерфейса: отметка выбранного пункта меню, панель фильтра, текущая страница пагинации.',
      en: 'Interface accent: the selected menu item mark, the filter panel, and the current pagination page.',
    },
  },
  {
    token: '--tsr-comp-skeleton-bg',
    arg: 'skeletonBg',
    label: 'skeleton-bg',
    desc: {
      ru: 'Базовый цвет скелетон-заглушки при загрузке.',
      en: 'Base color of the loading skeleton.',
    },
  },
  {
    token: '--tsr-comp-loader-bar',
    arg: 'loaderBar',
    label: 'loader-bar',
    desc: {
      ru: 'Основной цвет свечения обновления под шапкой и индикатора включённой кнопки; три других оттенка свечения — свои токены `sys-info-sky/-indigo/-violet`.',
      en: 'Main color of the refresh glow under the header and of the active button indicator; the three other glow shades have their own tokens `sys-info-sky/-indigo/-violet`.',
    },
  },
  {
    token: '--tsr-comp-scrollbar-thumb',
    arg: 'scrollbarThumb',
    label: 'scrollbar-thumb',
    desc: {
      ru: 'Цвет ползунка тонкого скроллбара.',
      en: 'Color of the thin scrollbar thumb.',
    },
  },
]

// Цвет основных теней — единый рычаг (color-контрол).
const SHADOW_COLOR: TokenControl = {
  token: '--tsr-comp-shadow-color',
  arg: 'shadowColor',
  label: 'shadow-color',
  desc: 'Color of the main shadows (header, footer, drag overlays). A single lever for the shadow tone.',
}

// Полные значения теней по поверхностям — text-контролы (box-shadow целиком).
interface ShadowControl extends TokenControl {
  default: string
}
const SHADOW_TOKENS: ShadowControl[] = [
  {
    token: '--tsr-comp-shadow-head',
    arg: 'shadowHead',
    label: 'shadow-head',
    desc: 'Shadow under the header while scrolling (the whole box-shadow).',
    default: '0 4px 8px var(--tsr-comp-shadow-color)',
  },
  {
    token: '--tsr-comp-shadow-footer',
    arg: 'shadowFooter',
    label: 'shadow-footer',
    desc: 'Shadow above the footer (the whole box-shadow).',
    default: '0 -4px 8px var(--tsr-comp-shadow-color)',
  },
  {
    token: '--tsr-comp-shadow-drag',
    arg: 'shadowDrag',
    label: 'shadow-drag',
    desc: 'Shadow of the row/column clone while dragging.',
    default: 'var(--tsr-comp-shadow-color) 0 2px 4px 2px',
  },
  {
    token: '--tsr-comp-shadow-drop-bubble',
    arg: 'shadowBubble',
    label: 'shadow-drop-bubble',
    desc: 'Shadow of the counter badge when dragging several rows.',
    default: '0 1px 2px 0 rgba(0, 0, 0, 0.08)',
  },
  {
    token: '--tsr-comp-shadow-action',
    arg: 'shadowAction',
    label: 'shadow-action',
    desc: 'Shadow of the pop-up action buttons over a row.',
    default: '0px 0px 4px 2px var(--tsr-sys-shadow-elevated)',
  },
]

// Числовые токены — ползунки: значение пишется в токен с единицей.
interface NumberControl extends TokenControl {
  default: number
  unit: '%' | 'px'
  min: number
  max: number
}

// Рычаги тонов (--tsr-sys-tint-*): доля цвета текста в слое, значения светлой темы.
const TINT_TOKENS: NumberControl[] = [
  {
    token: '--tsr-sys-tint-hover',
    arg: 'tintHover',
    label: 'tint-hover',
    desc: 'Strength of the row and cell hover layer, % of the text color.',
    default: 4,
    unit: '%',
    min: 0,
    max: 30,
  },
  {
    token: '--tsr-sys-tint-selected',
    arg: 'tintSelected',
    label: 'tint-selected',
    desc: 'Strength of the selected row layer, % of the text color.',
    default: 6,
    unit: '%',
    min: 0,
    max: 30,
  },
  {
    token: '--tsr-sys-tint-pinned',
    arg: 'tintPinned',
    label: 'tint-pinned',
    desc: 'Pinned column backdrop, % of the text color.',
    default: 3,
    unit: '%',
    min: 0,
    max: 30,
  },
  {
    token: '--tsr-sys-tint-fill',
    arg: 'tintFill',
    label: 'tint-fill',
    desc: 'Fills without text: skeleton, scrollbar thumb, % of the text color.',
    default: 10,
    unit: '%',
    min: 0,
    max: 40,
  },
]

// Размеры: строки, шапка, кнопки, отступ, кегль и скругление.
const SIZE_TOKENS: NumberControl[] = [
  {
    token: '--tsr-comp-row-height',
    arg: 'rowHeight',
    label: 'row-height',
    desc: 'Body row height, px.',
    default: 50,
    unit: 'px',
    min: 32,
    max: 72,
  },
  {
    token: '--tsr-comp-head-row-height',
    arg: 'headRowHeight',
    label: 'head-row-height',
    desc: 'Header row height, px. When not set, matches the body rows.',
    default: 50,
    unit: 'px',
    min: 32,
    max: 80,
  },
  {
    token: '--tsr-comp-grid-button-size',
    arg: 'gridButtonSize',
    label: 'grid-button-size',
    desc: 'Buttons in the header, cells, and rows, px; the selection column follows them. Toolbar buttons do not change.',
    default: 28,
    unit: 'px',
    min: 20,
    max: 40,
  },
  {
    token: '--tsr-comp-cell-content-padding-x',
    arg: 'cellPaddingX',
    label: 'cell-content-padding-x',
    desc: 'Content padding from the cell edges, px.',
    default: 12,
    unit: 'px',
    min: 4,
    max: 24,
  },
  {
    token: '--tsr-comp-cell-font-size',
    arg: 'cellFontSize',
    label: 'cell-font-size',
    desc: 'Font size of cell and header text, px.',
    default: 13,
    unit: 'px',
    min: 11,
    max: 18,
  },
  {
    token: '--tsr-sys-radius',
    arg: 'radius',
    label: 'sys-radius',
    desc: 'Corner radius of the table frame, buttons, menus, and tooltips, px.',
    default: 8,
    unit: 'px',
    min: 0,
    max: 16,
  },
]

const NUMBER_TOKENS = [...TINT_TOKENS, ...SIZE_TOKENS]

// Шрифт — строка CSS `font-family`; пусто — шрифт темы.
const FONT_FAMILY: TokenControl = {
  token: '--tsr-comp-font-family',
  arg: 'fontFamily',
  label: 'font-family',
  desc: 'Table font (CSS font-family); empty means the theme font.',
}

// Цветовые токены (резолвятся в rgb для свотчей); тени-строки — отдельно.
const ALL_TOKENS = [...PALETTE, ...SEMANTIC, ...GRID_TOKENS, SHADOW_COLOR]

// Резолв цвета в чистый rgb(a): скрытый пробник с классом темы наследует и
// апстрим-палитру shadcn, и дефолты theme.css, поэтому `var(--token)`
// вычисляется ровно как в гриде. Результат `color-mix()` Chromium сериализует
// как `oklch(...)` (без свотча в контроле), поэтому дополнительно прогоняем
// значение через canvas 1×1 → байты rgba. Нужен, чтобы (а) заполнить контролы
// Storybook стартовыми значениями и (б) отличать «пользователь изменил» от
// дефолта (обе стороны нормализованы одинаково).
let probe: HTMLElement | null = null
let ctx: CanvasRenderingContext2D | null = null
const toRgb = (value: string): string => {
  if (typeof document === 'undefined') {
    return value
  }

  if (!probe) {
    probe = document.createElement('div')
    probe.className = DATA_GRID_THEME_CLASS
    probe.style.cssText =
      'position:absolute;left:-9999px;visibility:hidden;pointer-events:none'
    document.body.appendChild(probe)
    ctx = document.createElement('canvas').getContext('2d')
  }

  probe.style.color = ''
  probe.style.color = value
  const computed = getComputedStyle(probe).color

  if (!ctx) {
    return computed || value
  }

  ctx.clearRect(0, 0, 1, 1)
  ctx.fillStyle = '#000'
  ctx.fillStyle = computed
  ctx.fillRect(0, 0, 1, 1)
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
  const alpha = a / 255

  return alpha === 1
    ? `rgb(${r}, ${g}, ${b})`
    : `rgba(${r}, ${g}, ${b}, ${Number(alpha.toFixed(3))})`
}

// Стартовые значения контролов = резолв дефолта каждого токена в light-теме.
const RESOLVED_DEFAULTS: Record<string, string> = Object.fromEntries(
  ALL_TOKENS.map(({ token, arg }) => [arg, toRgb(`var(${token})`)]),
)

interface ThemingArgs {
  colorMode: 'light' | 'dark'
  loading: 'off' | 'initial' | 'refresh'
  loadError: boolean
  [arg: string]: string | number | boolean
}

/**
 * Собрать инлайн-`style` из значений контролов. Инжектим ТОЛЬКО реально
 * изменённые токены (значение ≠ дефолт) — иначе форсированный инлайн маскировал
 * бы дефолты слоя и ломал бы тёмный режим и влияние палитры на нетронутые токены.
 */
const buildThemeStyle = (args: ThemingArgs): CSSProperties => {
  const style: Record<string, string> = {}

  ALL_TOKENS.forEach(({ token, arg }) => {
    const value = args[arg]
    if (
      typeof value === 'string' &&
      value &&
      toRgb(value) !== RESOLVED_DEFAULTS[arg]
    ) {
      style[token] = value
    }
  })

  // Тени — text-токены: сравниваем строку с дефолтом напрямую.
  SHADOW_TOKENS.forEach(({ token, arg, default: def }) => {
    const value = args[arg]
    if (typeof value === 'string' && value && value !== def) {
      style[token] = value
    }
  })

  NUMBER_TOKENS.forEach(({ token, arg, default: def, unit }) => {
    const value = args[arg]
    if (typeof value === 'number' && value !== def) {
      style[token] = `${value}${unit}`
    }
  })

  const font = args[FONT_FAMILY.arg]
  if (typeof font === 'string' && font.trim()) {
    style[FONT_FAMILY.token] = font
  }

  return style as CSSProperties
}

/** Смена размеров открывает таблицу заново: высоту строк и колонок она читает при открытии. */
const sizeKey = (args: ThemingArgs) =>
  SIZE_TOKENS.map(({ arg }) => args[arg]).join('|')

const numberArgTypes = (
  tokens: NumberControl[],
  category: string,
): Meta<ThemingArgs>['argTypes'] =>
  Object.fromEntries(
    tokens.map(({ arg, label, desc, min, max }) => [
      arg,
      {
        name: label,
        description: textOf(desc, 'en'),
        control: { type: 'range', min, max, step: 1 },
        table: { category },
      },
    ]),
  )

interface DemoTable {
  getCoreRowModel: () => { rows: unknown[] }
  setRowSelection: (value: Record<string, boolean>) => void
  highlight: (
    target: { row: string },
    options: { tone: 'success' | 'warning' },
  ) => { clear: () => void }
}

/**
 * Состояния строк с первого кадра, как только пришли строки: выбранная строка (слои
 * выбора и счётчик нижней панели) и подсветка тонами «успех» и «предупреждение».
 */
const rowStatesDemo: TesseraFeatureEntry = {
  id: 'themingRowStatesDemo',
  setup: table => {
    const t = table as unknown as DemoTable
    let frame = 0
    let handles: { clear: () => void }[] = []
    const apply = () => {
      if (t.getCoreRowModel().rows.length === 0) {
        frame = requestAnimationFrame(apply)
        return
      }
      t.setRowSelection({ 'item-id-4': true })
      handles = [
        t.highlight({ row: 'item-id-1' }, { tone: 'success' }),
        t.highlight({ row: 'item-id-2' }, { tone: 'warning' }),
      ]
    }
    apply()
    return () => {
      cancelAnimationFrame(frame)
      handles.forEach(handle => handle.clear())
    }
  },
}

const ThemingDemo = memo((args: ThemingArgs) => {
  const columns = useColumns(6)
  // Строк больше окна: видна прокрутка и её ползунок.
  const { data, setData } = useData({ count: 40, showStub: false })

  const [selection, onRowSelectionChange] = useState<RowSelectionValue>({})
  // Закреплённая колонка с первого кадра: токены закреплённых ячеек видны сразу.
  const [pinning, setPinning] = useState<ColumnPinningState>({
    start: ['country'],
    end: [],
  })

  const table = useCreateTable({
    enableKeyboardNavigation: true,
    // Демо-колонки строятся отдельным хелпером (мок) с иной вариантностью типов,
    // чем у таблицы: касты на границе снимают расхождение (рантайм совпадает,
    // покрыт визуал-тестами).
    columns: columns as never,
    data,
    loading: args.loading === 'off' ? false : args.loading,
    loadError: args.loadError ? new Error('Demo load error') : undefined,
    enableFooter: true,
    enableStatusBar: true,
    state: { columnPinning: pinning },
    handlers: {
      onColumnPinningChange: (updater: Updater<ColumnPinningState>) =>
        setPinning(prev => functionalUpdate(updater, prev)),
    },
    // Набор фич подобран так, чтобы витрина задействовала как можно больше
    // токенов: чекбоксы (rowSelection), кнопки шапки (sorting/pinning/sizing),
    // кнопки действий строки (rowActions), клон и счётчик перетаскивания
    // (rowDragging), тулбар (columnVisibility), кольцо фокуса ячейки
    // (enableKeyboardNavigation).
    plugins: [
      columnVisibility(),
      rowSelection({
        rowSelection: selection,
        onRowSelectionChange,
        selectedCount: true,
      }),
      columnSorting(),
      columnPinning(),
      columnSizing(),
      rowDragging({
        onRowOrderChange: (updater: Updater<any[]>) =>
          setData(prev => functionalUpdate(updater, prev)),
      }),
      rowActions(),
      { id: 'rowActionsDemo', slotActions: rowActionsDemo },
      rowStatesDemo,
    ],
  })

  return (
    <Grid
      style={{
        padding: 16,
        height: 560,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <DataGrid
          key={sizeKey(args)}
          table={table as never}
          height={480}
          maxHeight={480}
          colorMode={args.colorMode}
          style={buildThemeStyle(args)}
        />
      </div>
    </Grid>
  )
})

ThemingDemo.displayName = 'ThemingDemo'

const colorArgTypes = (
  tokens: TokenControl[],
  category: string,
): Meta<ThemingArgs>['argTypes'] =>
  Object.fromEntries(
    tokens.map(({ arg, label, desc }) => [
      arg,
      {
        name: label,
        description: textOf(desc, 'en'),
        control: { type: 'color' },
        table: { category },
      },
    ]),
  )

const meta = {
  title: 'Tessera/Theming',
  component: ThemingDemo,
  args: {
    loading: 'off',
    loadError: false,
    ...RESOLVED_DEFAULTS,
    ...Object.fromEntries(
      SHADOW_TOKENS.map(({ arg, default: def }) => [arg, def]),
    ),
    ...Object.fromEntries(
      NUMBER_TOKENS.map(({ arg, default: def }) => [arg, def]),
    ),
    fontFamily: '',
  },
  argTypes: {
    // colorMode (light/dark) переключается ГЛОБАЛЬНЫМ тумблером «Theme» в
    // тулбаре Storybook (preview.tsx синхронит его с гридом), поэтому отдельного
    // arg-контрола здесь нет — иначе он молча перезаписывался бы декоратором.
    loading: {
      name: 'loading (loader)',
      description:
        'Data loading: `refresh` shows a glow under the header (loader-* tokens), and hover highlighting is off while it lasts; `initial` shows the first-load skeleton (skeleton-bg).',
      control: 'inline-radio',
      options: ['off', 'refresh', 'initial'],
      table: { category: 'Mode' },
    },
    loadError: {
      name: 'loadError',
      description:
        'Load failure: a red glow under the header and a banner, to preview destructive/sys-danger.',
      control: 'boolean',
      table: { category: 'Mode' },
    },
    ...colorArgTypes(PALETTE, 'shadcn bridge (broad)'),
    ...colorArgTypes(SEMANTIC, 'Semantic (--tsr-sys-*)'),
    ...colorArgTypes(GRID_TOKENS, 'Component (--tsr-comp-*)'),
    ...colorArgTypes([SHADOW_COLOR], 'Shadows'),
    ...numberArgTypes(TINT_TOKENS, 'Tints (--tsr-sys-tint-*)'),
    ...numberArgTypes(SIZE_TOKENS, 'Sizes'),
    fontFamily: {
      name: FONT_FAMILY.label,
      description: textOf(FONT_FAMILY.desc, 'en'),
      control: { type: 'text' },
      table: { category: 'Sizes' },
    },
    ...Object.fromEntries(
      SHADOW_TOKENS.map(({ arg, label, desc }) => [
        arg,
        {
          name: label,
          description: textOf(desc, 'en'),
          control: { type: 'text' },
          table: { category: 'Shadows' },
        },
      ]),
    ),
  },
  parameters: {
    backgrounds: { disable: true },
    layout: 'fullscreen',
    controls: { expanded: true },
  },
} satisfies Meta<ThemingArgs>

export default meta

export const Playground: StoryObj<ThemingArgs> = {
  name: 'Playground',
}

// ============================================================================
// Палитра — свотч-борд токенов в обеих темах. Отдельная история: закруглённые
// квадраты на нейтральном фоне (`--tsr-sys-bg`), под каждым — русская подпись
// (роль токена), имя переменной и вычисленное значение цвета. Светлая и тёмная
// колонки рендерятся рядом (каждая — свой скоуп `.data-grid-theme[.dark]`),
// поэтому один и тот же токен резолвится в цвет своей темы.
// ============================================================================

// Группы палитры = те же массивы, что питают контролы Playground (от общего
// уровня к частному). Overlay-токены полупрозрачны, поэтому свотчам
// даём рамку `--tsr-sys-border` — иначе на нейтральном фоне их не видно.
const PALETTE_GROUPS: { title: StoryText | string; tokens: TokenControl[] }[] =
  [
    {
      title: { ru: 'Мост shadcn (broad)', en: 'shadcn bridge (broad)' },
      tokens: PALETTE,
    },
    { title: 'Semantic (--tsr-sys-*)', tokens: SEMANTIC },
    { title: 'Component (--tsr-comp-*)', tokens: GRID_TOKENS },
  ]

// Один свотч: цвет читаем со смонтированного элемента (getComputedStyle внутри
// тематизированной колонки → значение именно этой темы, включая раскрытый
// color-mix, который браузер отдаёт готовым rgb/rgba).
const Swatch = ({ token, label, desc }: TokenControl) => {
  const t = useStoryText()
  const ref = useRef<HTMLDivElement>(null)
  const [value, setValue] = useState('')

  useLayoutEffect(() => {
    if (ref.current) {
      setValue(getComputedStyle(ref.current).backgroundColor)
    }
  }, [])

  return (
    <figure style={{ margin: 0, width: 168 }}>
      <div
        ref={ref}
        style={{
          height: 56,
          borderRadius: 12,
          background: `var(${token})`,
          border: '1px solid var(--tsr-sys-border)',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.08)',
        }}
      />
      <figcaption
        style={{ marginTop: 8, fontSize: 12, lineHeight: 1.45, minWidth: 0 }}
      >
        <div style={{ fontWeight: 600 }}>{t(desc)}</div>
        <code
          style={{
            display: 'block',
            marginTop: 2,
            fontSize: 11,
            opacity: 0.7,
            wordBreak: 'break-all',
          }}
        >
          {token}
        </code>
        <div style={{ fontSize: 11, opacity: 0.6 }}>
          {label} · {value}
        </div>
      </figcaption>
    </figure>
  )
}

// Одна колонка = одна тема. Класс `.data-grid-theme[.dark]` открывает скоуп
// токенов (dark-класс заодно активирует .dark-палитру shadcn из global.css).
const PaletteColumn = ({ mode }: { mode: 'light' | 'dark' }) => {
  const t = useStoryText()
  return (
    <div
      className={
        mode === 'dark'
          ? `${DATA_GRID_THEME_CLASS} dark`
          : DATA_GRID_THEME_CLASS
      }
      style={{
        flex: '1 1 380px',
        minWidth: 340,
        padding: 24,
        borderRadius: 16,
        background: 'var(--tsr-sys-bg)',
        color: 'var(--tsr-sys-fg)',
        border: '1px solid var(--tsr-sys-border)',
      }}
    >
      <h3 style={{ margin: '0 0 20px', fontSize: 15 }}>
        {mode === 'dark'
          ? t({ ru: 'Тёмная тема', en: 'Dark theme' })
          : t({ ru: 'Светлая тема', en: 'Light theme' })}
      </h3>
      {PALETTE_GROUPS.map(({ title, tokens }) => (
        <section key={textOf(title, 'en')} style={{ marginBottom: 24 }}>
          <div
            style={{
              marginBottom: 12,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              opacity: 0.6,
            }}
          >
            {t(title)}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            {tokens.map(t => (
              <Swatch key={t.token} {...t} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

const PaletteBoard = memo(() => (
  <div
    style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: 24,
      alignItems: 'flex-start',
      padding: 24,
    }}
  >
    <PaletteColumn mode="light" />
    <PaletteColumn mode="dark" />
  </div>
))

PaletteBoard.displayName = 'PaletteBoard'

export const Palette: StoryObj<ThemingArgs> = {
  name: 'Palette (swatches)',
  render: () => <PaletteBoard />,
  // Контролы токенов относятся к Playground; для статичного борда прячем панель.
  parameters: { controls: { disable: true } },
}

// --- ADR 0090 S1 ---------------------------------------------------------------------

const THEME_WRAPPER = '[data-tsr-grid]'
const wrapperOf = (root: ParentNode) =>
  root.querySelector<HTMLElement>(THEME_WRAPPER)
/** Тема, в которой таблица нарисована сейчас. */
const schemeOf = (root: ParentNode) => {
  const wrapper = wrapperOf(root)
  if (!wrapper) return ''
  const style = getComputedStyle(wrapper)
  // В forced-colors Chromium задаёт нативную схему «light dark» независимо от темы приложения.
  return matchMedia('(forced-colors: active)').matches
    ? style.getPropertyValue('--tsr-sys-scheme').trim()
    : style.colorScheme
}

/** Контейнер приложения с темой: его фон из палитры приложения виден вокруг таблицы. */
const SOURCE_CONTAINER = 'theming-source-container'
const SOURCE_CONTAINER_CSS = `.${SOURCE_CONTAINER} {
  padding: 16px;
  border-radius: var(--radius-md, 8px);
  background: var(--background);
}`

/**
 * Контейнер таблицы в тёмной теме приложения на время шага: класс `.dark` у предка,
 * при уходе с шага — снят.
 */
const darkContainer = (root: HTMLElement) => {
  let container: HTMLElement | null = null
  let frame = 0
  const apply = () => {
    container = wrapperOf(root)?.parentElement ?? null
    if (container) container.classList.add('dark', SOURCE_CONTAINER)
    else frame = requestAnimationFrame(apply)
  }
  apply()
  return () => {
    cancelAnimationFrame(frame)
    container?.classList.remove('dark', SOURCE_CONTAINER)
  }
}

const SOURCES: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Тема по странице', en: 'Theme from the page' },
    hint: {
      ru: 'Таблица не задаёт себе тему, а следует теме страницы.',
      en: 'The table does not set its own theme; it follows the page theme.',
    },
    props: () => ({ colorMode: 'auto' }),
  },
  {
    title: {
      ru: 'Приложение затемнило контейнер',
      en: 'The app made the container dark',
    },
    hint: {
      ru: 'У контейнера таблицы тёмная тема. Таблица следует ближайшему предку и становится тёмной, цвета берёт из тёмной палитры приложения.',
      en: "The table container has a dark theme. The table follows its nearest ancestor and turns dark, taking its colors from the app's dark palette.",
    },
    enter: darkContainer,
  },
  {
    title: {
      ru: 'Таблице задана светлая тема',
      en: 'The table is set to the light theme',
    },
    hint: {
      ru: 'Приложение задало таблице светлую тему внутри тёмного контейнера. Таблица светлая на своих светлых значениях, тёмный предок на неё не действует.',
      en: 'The app set the light theme on the table inside a dark container. The table is light, using its own light values, and the dark ancestor has no effect on it.',
    },
    props: () => ({ colorMode: 'light' }),
    enter: darkContainer,
  },
  {
    title: {
      ru: 'Таблице задана тёмная тема',
      en: 'The table is set to the dark theme',
    },
    hint: {
      ru: 'Контейнер снова светлый, а приложение задало таблице тёмную тему. Таблица тёмная на светлой странице.',
      en: 'The container is light again, and the app set the dark theme on the table. The table is dark on a light page.',
    },
    props: () => ({ colorMode: 'dark' }),
  },
]

/** ADR 0090, S1: таблица берёт тему со страницы, с предка или из своего пропа. */
export const ThemeSources: StoryObj<ThemingArgs> = {
  name: 'Theme sources',
  args: { locale: 'en' },
  parameters: {
    scenario: '0090/S1',
    requirements: ['TM12'],
    ...guideControls(),
  },
  render: storyArgs => (
    <>
      <style>{SOURCE_CONTAINER_CSS}</style>
      <DemoStory
        title={{ ru: 'Источник темы', en: 'Theme source' }}
        steps={SOURCES}
        args={guideArgs(
          {
            enableRowSelection: true,
            enableColumnSorting: true,
            columnCount: 5,
            dataCount: 20,
            containerHeight: '460',
            height: '360',
            maxHeight: '360',
          },
          storyArgs as Pick<StoryProps, 'colorMode' | 'locale'>,
        )}
      />
    </>
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const page = globals.theme === 'dark' ? 'dark' : 'light'
    await step(SOURCES[0]!.title.ru, async () => {
      await until(() => expect(schemeOf(canvas)).toBe(page))
    })
    await step(SOURCES[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(schemeOf(canvas)).toBe('dark'))
      await until(() =>
        expect(wrapperOf(canvas)!.parentElement!.classList).toContain('dark'),
      )
    })
    await step(SOURCES[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(schemeOf(canvas)).toBe('light'))
      await until(() =>
        expect(wrapperOf(canvas)!.parentElement!.classList).toContain('dark'),
      )
    })
    await step(SOURCES[3]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(schemeOf(canvas)).toBe('dark'))
      await until(() =>
        expect(wrapperOf(canvas)!.parentElement!.classList).not.toContain(
          'dark',
        ),
      )
    })
    await settle()
  },
}

// --- ADR 0191 -------------------------------------------------------------------------

/** Роли приложения с мостом: история снимает их, чтобы таблица осталась без палитры. */
const APP_ROLES = [
  '--foreground',
  '--background',
  '--card',
  '--muted',
  '--primary',
  '--primary-foreground',
  '--border',
  '--destructive',
  '--info',
]
const APP_PRIMARY = 'oklch(0.42 0.16 262)'
const APP_RING = 'rgb(255, 0, 200)'
const APP_UNSAVED = 'rgb(0, 95, 115)'

const setRoles = (root: HTMLElement, roles: Record<string, string>) => {
  for (const [role, value] of Object.entries(roles)) {
    root.style.setProperty(role, value)
  }
  return () => {
    for (const role of Object.keys(roles)) root.style.removeProperty(role)
  }
}
/** Приложение без своих цветов: роли палитры приложения не заданы. */
const WITHOUT_PALETTE = Object.fromEntries(
  APP_ROLES.map(role => [role, 'initial']),
) as CSSProperties
const rawToken = (canvas: HTMLElement, token: string) =>
  getComputedStyle(wrapperOf(canvas)!).getPropertyValue(token).trim()

const PALETTE_GRID = {
  enableRowSelection: true,
  enableColumnSorting: true,
  columnCount: 5,
  dataCount: 20,
  containerHeight: '460',
  height: '360',
  maxHeight: '360',
} satisfies Partial<StoryProps>

const DEFAULT_PALETTE: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Приложение без палитры', en: 'An app without a palette' },
    hint: {
      ru: 'Приложение не задаёт свои цвета. Таблица берёт встроенную палитру: нейтральные поверхности и линии, акцент выбора и загрузки.',
      en: 'The app does not set its own colors. The table uses its built-in palette: neutral surfaces and lines, and an accent for selection and loading.',
    },
  },
  {
    title: { ru: 'Тёмная тема', en: 'Dark theme' },
    hint: {
      ru: 'Приложение включило таблице тёмную тему. Встроенная палитра сменила все цвета разом, текст и линии остались читаемыми.',
      en: 'The app turned on the dark theme for the table. The built-in palette changed all colors at once, and the text and lines stayed readable.',
    },
    props: () => ({ colorMode: 'dark' }),
  },
]

/** ADR 0191, S1: приложение без shadcn получает готовую палитру. */
export const ThemingDefaultPalette: StoryObj<ThemingArgs> = {
  name: 'Default palette',
  args: { locale: 'en' },
  parameters: { scenario: '0191/S1', ...guideControls() },
  render: storyArgs => (
    <div style={WITHOUT_PALETTE}>
      <DemoStory
        title={{ ru: 'Палитра по умолчанию', en: 'Default palette' }}
        steps={DEFAULT_PALETTE}
        args={guideArgs(
          PALETTE_GRID,
          storyArgs as Pick<StoryProps, 'colorMode' | 'locale'>,
        )}
      />
    </div>
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(DEFAULT_PALETTE[0]!.title.ru, async () => {
      await until(() => expect(wrapperOf(canvas)).not.toBeNull())
      const shade = globals.theme === 'dark' ? 'oklch(70.7%' : 'oklch(54.6%'
      await until(() =>
        expect(rawToken(canvas, '--tsr-sys-info')).toContain(shade),
      )
      await settle()
    })
    await step(DEFAULT_PALETTE[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(schemeOf(canvas)).toBe('dark'))
      await until(() =>
        expect(rawToken(canvas, '--tsr-sys-info')).toContain('oklch(70.7%'),
      )
      await settle()
    })
  },
}

const quickSearchField = (root: ParentNode) =>
  root.querySelector<HTMLInputElement>('input[data-testid="quick-search"]')

const SHADCN_PALETTE: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Палитра приложения', en: 'The app palette' },
    hint: {
      ru: 'Приложение использует стандартную тему shadcn. Таблица берёт из неё текст, поверхности, линии и цвет ошибки и выглядит частью приложения.',
      en: 'The app uses the standard shadcn theme. The table takes the text, surfaces, lines, and error color from it and looks like part of the app.',
    },
  },
  {
    title: {
      ru: 'Приложение сменило акцент',
      en: 'The app changed the accent',
    },
    hint: {
      ru: 'Приложение задало свой основной цвет. Флажки выбора и включённые кнопки таблицы приняли его без настройки самой таблицы.',
      en: 'The app set its own primary color. The selection checkboxes and active table buttons picked it up without configuring the table itself.',
    },
    enter: root => setRoles(root, { '--primary': APP_PRIMARY }),
  },
  {
    title: { ru: 'Кольцо фокуса таблицы', en: 'The table focus ring' },
    hint: {
      ru: 'Приложение задало и свой цвет кольца фокуса, но таблица оставила своё: его выводит цвет текста, поэтому оно заметно на любом фоне. Пользователь перешёл к полю поиска.',
      en: 'The app also set its own focus ring color, but the table kept its own: it is derived from the text color, so it stands out on any background. The user moved to the search field.',
    },
    keyboard: true,
    enter: root => {
      const undo = setRoles(root, {
        '--primary': APP_PRIMARY,
        '--ring': APP_RING,
      })
      quickSearchField(root)?.focus()
      return undo
    },
  },
]

/** ADR 0191, S2: таблица берёт цвета приложения, контраст и кольцо фокуса держатся. */
export const ThemingShadcnPalette: StoryObj<ThemingArgs> = {
  name: 'App palette',
  args: { locale: 'en' },
  parameters: { scenario: '0191/S2', ...guideControls() },
  render: storyArgs => (
    <DemoStory
      title={{ ru: 'Палитра приложения', en: 'The app palette' }}
      steps={SHADCN_PALETTE}
      args={guideArgs(
        { ...PALETTE_GRID, enableQuickSearch: true },
        storyArgs as Pick<StoryProps, 'colorMode' | 'locale'>,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(SHADCN_PALETTE[0]!.title.ru, async () => {
      await until(() => expect(wrapperOf(canvas)).not.toBeNull())
      await settle()
    })
    await step(SHADCN_PALETTE[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(rawToken(canvas, '--tsr-sys-accent')).toBe(APP_PRIMARY),
      )
      await settle()
    })
    await step(SHADCN_PALETTE[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(document.activeElement).toBe(quickSearchField(canvas)),
      )
      expect(rawToken(canvas, '--tsr-sys-ring')).not.toContain(APP_RING)
      await settle()
    })
  },
}

/** Тема приложения: свой цвет несохранённого. */
const OWN_UNSAVED = 'theming-own-unsaved'
const OWN_UNSAVED_CSS = `
.${OWN_UNSAVED}.${DATA_GRID_THEME_CLASS} { --tsr-sys-unsaved: ${APP_UNSAVED}; }
`
const UNSAVED_ROW = getData(PALETTE_GRID.dataCount)[1]!.id as string

const UNSAVED_ROLE: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Несохранённая правка', en: 'An unsaved edit' },
    hint: {
      ru: 'В таблице есть правка, которую ещё не сохранили. Уголок ячейки и счётчик на кнопке показывают её своим цветом, отдельным от цвета ошибок.',
      en: 'The table has an edit that is not saved yet. The cell corner and the counter on the button show it in its own color, separate from the error color.',
    },
  },
  {
    title: {
      ru: 'Приложение задало свой цвет',
      en: 'The app set its own color',
    },
    hint: {
      ru: 'Приложение переопределило роль несохранённого в своей теме. Уголок ячейки и счётчик сменили цвет вместе.',
      en: 'The app overrode the unsaved-changes role in its theme. The cell corner and the counter changed color together.',
    },
    props: () => ({ gridClassName: OWN_UNSAVED }),
  },
]

/** ADR 0191, S3: приложение меняет цвет несохранённого своей ролью. */
export const ThemingUnsavedRole: StoryObj<ThemingArgs> = {
  name: 'Unsaved role',
  args: { locale: 'en' },
  parameters: { scenario: '0191/S3', ...guideControls() },
  render: storyArgs => (
    <>
      <style>{OWN_UNSAVED_CSS}</style>
      <DemoStory
        title={{ ru: 'Цвет несохранённого', en: 'Unsaved changes color' }}
        steps={UNSAVED_ROLE}
        args={guideArgs(
          {
            ...PALETTE_GRID,
            enableCellEditing: true,
            cellEditingSaveMode: 'manual',
            enableUnsavedChanges: true,
            editableColumns: ['firstName'],
            initialDrafts: [
              {
                kind: 'cellValue',
                target: { cell: [UNSAVED_ROW, 'firstName'] },
                value: { value: 'Ada', text: 'Ada' },
              },
            ],
          },
          storyArgs as Pick<StoryProps, 'colorMode' | 'locale'>,
        )}
      />
    </>
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(UNSAVED_ROLE[0]!.title.ru, async () => {
      await until(() =>
        expect(
          canvas.querySelector(
            '[data-testid="unsaved-changes-button"] [data-active-indicator]',
          ),
        ).not.toBeNull(),
      )
      await settle()
    })
    await step(UNSAVED_ROLE[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(rawToken(canvas, '--tsr-sys-unsaved')).toBe(APP_UNSAVED),
      )
      await settle()
    })
  },
}

// --- ADR 0135 S1 ---------------------------------------------------------------------

/** Тема приложения: свой размер кнопок таблицы поверх темы грида. */
const LARGE_BUTTONS = 'theming-large-grid-buttons'
/** Пример держит кнопки ячеек и строк на виду, как при наведении: их размер видно сразу. */
const BUTTONS_SHOWN = 'theming-grid-buttons-shown'
const GRID_BUTTONS_CSS = `
.${LARGE_BUTTONS}.${DATA_GRID_THEME_CLASS} { --tsr-comp-grid-button-size: 32px; }
.${BUTTONS_SHOWN}.${BUTTONS_SHOWN} :is(.data-grid__head-cell, .data-grid__body-cell) .cell__button--hidden {
  opacity: 1;
  grid-template-columns: minmax(0, 1fr);
  overflow: unset;
  min-width: 0;
}
.${BUTTONS_SHOWN}.${BUTTONS_SHOWN} .row__button--hidden {
  opacity: 1;
  --tsr-comp-button-color: inherit;
  --tsr-comp-control-active-color: inherit;
  --tsr-comp-control-disabled-color: inherit;
  --tsr-comp-shadow-action: inherit;
  --tsr-comp-action-button-bg: inherit;
}
`

const GRID_BUTTON_ARGS: Partial<StoryProps> = {
  dataNesting: 'nested',
  enableRowExpanding: true,
  enableRowSelection: true,
  enableColumnSorting: true,
  enableHeaderActionMenu: true,
  enableCellEditing: true,
  enableRowActions: true,
  enableColumnVisibility: true,
  columnCount: 5,
  dataCount: 30,
  containerHeight: '520',
  height: '420',
}

const GRID_BUTTONS: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Кнопки по умолчанию', en: 'Default buttons' },
    hint: {
      ru: 'Тема приложения размер кнопок не задаёт. Кнопки в заголовке, ячейках и строках — 28px, колонки выбора и раскрытия строк — 36px. Кнопки панели над таблицей — 32px. В примере кнопки ячеек и строк показаны сразу, обычно они появляются при наведении.',
      en: 'The app theme does not set the button size. Buttons in the header, cells, and rows are 28px, and the row selection and expand columns are 36px. Toolbar buttons above the table are 32px. In this example, cell and row buttons are shown right away; normally they appear on hover.',
    },
  },
  {
    title: {
      ru: 'Тема задала крупные кнопки',
      en: 'The theme set larger buttons',
    },
    hint: {
      ru: 'Приложение указало в своей теме размер кнопок таблицы 32px. Кнопки в заголовке, ячейках и строках — 32px, колонки выбора и раскрытия — 40px. Кнопки панели над таблицей по-прежнему 32px.',
      en: 'The app set the table button size to 32px in its theme. Buttons in the header, cells, and rows are 32px, and the row selection and expand columns are 40px. Toolbar buttons above the table are still 32px.',
    },
    props: () => ({ gridClassName: LARGE_BUTTONS }),
  },
]

/** ADR 0135, S1: размер кнопок таблицы задаёт тема приложения одним токеном. */
export const ThemingGridButtonSize: StoryObj<ThemingArgs> = {
  name: 'Grid button size',
  args: { locale: 'en' },
  parameters: {
    scenario: '0135/S1',
    ...guideControls(),
  },
  render: storyArgs => (
    <div className={BUTTONS_SHOWN}>
      <style>{GRID_BUTTONS_CSS}</style>
      <DemoStory
        title={{
          ru: 'Размер кнопок таблицы из темы',
          en: 'Table button size from the theme',
        }}
        steps={GRID_BUTTONS}
        args={guideArgs(
          GRID_BUTTON_ARGS,
          storyArgs as Pick<StoryProps, 'colorMode' | 'locale'>,
        )}
      />
    </div>
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const width = (selector: string) => {
      const el = canvas.querySelector(selector)
      return el ? Math.round(el.getBoundingClientRect().width) : 0
    }
    const sizes = () => ({
      header: width('.data-grid__head-cell [data-action-menu]'),
      cell: width('.data-grid__body-cell .cell__button button'),
      row: width('.data-grid__body-row .row__button button'),
      toggle: width('button.row-expand-button'),
      service: [...canvas.querySelectorAll('.data-grid__head-cell')]
        .slice(0, 2)
        .map(cell => Math.round(cell.getBoundingClientRect().width)),
      toolbar: width('[role="toolbar"] button'),
    })
    const expectSizes = (button: number, column: number) =>
      until(() =>
        expect(sizes()).toEqual({
          header: button,
          cell: button,
          row: button,
          toggle: button,
          service: [column, column],
          toolbar: 32,
        }),
      )
    await step(GRID_BUTTONS[0].title.ru, async () => {
      await expectSizes(28, 36)
      // Кнопки ячеек и строк видны без наведения: подсказка шага это обещает.
      for (const selector of [
        '.data-grid__body-cell .cell__button button',
        '.data-grid__body-row .row__button button',
      ]) {
        const button = canvas.querySelector<HTMLElement>(selector)!
        expect(getComputedStyle(button.parentElement!).opacity, selector).toBe(
          '1',
        )
        expect(getComputedStyle(button).color, selector).not.toBe(
          'rgba(0, 0, 0, 0)',
        )
      }
    })
    await step(GRID_BUTTONS[1].title.ru, async () => {
      await guideNext(canvas)
      await expectSizes(32, 40)
    })
    await settle()
  },
}

// --- ADR 0207 S2 ---------------------------------------------------------------------

/** Тема приложения: линии между колонками. */
const COLUMN_DIVIDERS = 'theming-column-dividers'
const COLUMN_DIVIDERS_CSS = `
.${COLUMN_DIVIDERS}.${DATA_GRID_THEME_CLASS} { --tsr-comp-column-divider-width: 1px; }
`
const dividerOf = (root: ParentNode) =>
  getComputedStyle(
    root.querySelector(
      ".data-grid__body-row[data-index='1'] .data-grid__body-cell[data-cell-pinned='false']",
    )!,
  ).borderRightWidth

const DIVIDERS: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Без линий между колонками', en: 'No lines between columns' },
    hint: {
      ru: 'Колонки таблицы разделяет только расстояние между ними, строки — горизонтальные линии.',
      en: 'The table columns are separated only by the space between them, and the rows by horizontal lines.',
    },
  },
  {
    title: {
      ru: 'Приложение включило линии',
      en: 'The app turned on the lines',
    },
    hint: {
      ru: 'Приложение задало в своей теме толщину линии между колонками. Шапку и тело разделили вертикальные линии — таблица выглядит как сетка, ширины колонок прежние.',
      en: 'The app set the width of the line between columns in its theme. Vertical lines now divide the header and body, so the table looks like a grid, and the column widths are unchanged.',
    },
    props: () => ({ gridClassName: COLUMN_DIVIDERS }),
  },
]

/** ADR 0207, S2: приложение включает линии между колонками токеном темы. */
export const ThemingColumnDividers: StoryObj<ThemingArgs> = {
  name: 'Column dividers',
  args: { locale: 'en' },
  parameters: { scenario: '0207/S2', ...guideControls() },
  render: storyArgs => (
    <>
      <style>{COLUMN_DIVIDERS_CSS}</style>
      <DemoStory
        title={{ ru: 'Линии между колонками', en: 'Lines between columns' }}
        steps={DIVIDERS}
        args={guideArgs(
          PALETTE_GRID,
          storyArgs as Pick<StoryProps, 'colorMode' | 'locale'>,
        )}
      />
    </>
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(DIVIDERS[0]!.title.ru, async () => {
      await until(() => expect(dividerOf(canvas)).toBe('0px'))
      await settle()
    })
    await step(DIVIDERS[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(dividerOf(canvas)).toBe('1px'))
      await settle()
    })
  },
}
