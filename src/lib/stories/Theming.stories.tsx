import { CSSProperties, memo, useLayoutEffect, useRef, useState } from 'react'

import { Meta, StoryObj } from '@storybook/react'
import {
  type ColumnPinningState,
  type Updater,
  functionalUpdate,
} from '@tanstack/react-table'

import { Grid } from './_shims'
import { DATA_GRID_THEME_CLASS } from '../core/themeVariables'
import type { TesseraFeatureEntry } from '../core/features'
import type { RowSelectionValue } from '../../lib/core/rowSelectionAll'
import { useCreateTable } from '../../lib/core/useCreateTable'
import { DataGrid } from '../../lib/grid/DataGrid'
import {
  columnPinning,
  columnSizing,
  columnSorting,
  columnVisibility,
  keyboardNavigation,
  rowActions,
  rowDragging,
  rowSelection,
} from '../../lib/plugins'
import { useColumns } from './__mocks__/columns'
import { useData } from './__mocks__/data'
import { rowActionsDemo } from './__mocks__/plugins/rowActionsDemo/rowActionsDemo'
import { expect, userEvent } from 'storybook/test'
import { guideNext, settle, until } from './__mocks__/catalogPlay'
import { guideControls } from './__mocks__/utils/dataGridControls'
import type { StoryProps } from './DataGridStory.types'
import { GuideStory, type GuideStoryStep, guideArgs } from './demos/GuideStory'

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
  /** Описание для колонки Description в панели контролов. */
  desc: string
}

// Апстрим-палитра shadcn — верхний рычаг: правка влияет на все токены грида.
const PALETTE: TokenControl[] = [
  {
    token: '--background',
    arg: 'background',
    label: 'background',
    desc: 'Базовый фон холста. Задаёт фон нечётных строк, их закреплённых ячеек и drag-клона.',
  },
  {
    token: '--foreground',
    arg: 'foreground',
    label: 'foreground',
    desc: 'Основные «чернила» (текст/иконки). База для hover/selected-фонов, цвета контролов, скелетона, фокус-ринга.',
  },
  {
    token: '--card',
    arg: 'card',
    label: 'card',
    desc: 'Фон карточки. Задаёт фон чётных строк, их закреплённых ячеек, кнопок действий и thumb переключателя.',
  },
  {
    token: '--muted',
    arg: 'muted',
    label: 'muted',
    desc: 'Приглушённый фон. Задаёт фон шапки и футера, включая закреплённые ячейки шапки.',
  },
  {
    token: '--primary',
    arg: 'primary',
    label: 'primary',
    desc: 'Акцент/чернила. Задаёт аутлайн ячейки, заливку чекбокса, включённый трек switch, accent.',
  },
  {
    token: '--primary-foreground',
    arg: 'primaryForeground',
    label: 'primary-foreground',
    desc: 'Контраст к primary. Задаёт цвет галочки чекбокса.',
  },
  {
    token: '--border',
    arg: 'border',
    label: 'border',
    desc: 'Цвет hairline-границ. Задаёт границы контролов и разделитель закреплённых колонок.',
  },
  {
    token: '--ring',
    arg: 'ring',
    label: 'ring',
    desc: 'База цвета кольца фокуса (клавиатурный фокус контролов).',
  },
  {
    token: '--destructive',
    arg: 'destructive',
    label: 'destructive',
    desc: 'Цвет ошибки/опасности. Свет и плашка ошибки загрузки, отказ действия, полоски слота при недопустимом drop.',
  },
  {
    token: '--info',
    arg: 'info',
    label: 'info (loader)',
    desc: 'Семантический синий (статус). По умолчанию — цвет бегущей полосы прогресс-бара.',
  },
]

// Semantic-уровень грида (--tsr-sys-*) — средний рычаг: роли, из которых выводятся
// component-токены. Тема-зависим (флипается в dark). Правка роли меняет всю группу.
const SEMANTIC: TokenControl[] = [
  {
    token: '--tsr-sys-fg',
    arg: 'sysFg',
    label: 'sys-fg',
    desc: 'Роль «чернил». База для текста, hover/selected-оверлеев, контролов, скелетона.',
  },
  {
    token: '--tsr-sys-bg',
    arg: 'sysBg',
    label: 'sys-bg',
    desc: 'Роль базового фона. Фон нечётных строк, их закреплённых ячеек и drag-клона.',
  },
  {
    token: '--tsr-sys-surface',
    arg: 'sysSurface',
    label: 'sys-surface',
    desc: 'Роль поверхности. Фон чётных строк, их закреплённых ячеек, кнопок действий, thumb переключателя.',
  },
  {
    token: '--tsr-sys-muted',
    arg: 'sysMuted',
    label: 'sys-muted',
    desc: 'Роль приглушённого фона. Шапка и футер, включая закреплённые ячейки шапки.',
  },
  {
    token: '--tsr-sys-accent',
    arg: 'sysAccent',
    label: 'sys-accent',
    desc: 'Роль акцента. Аутлайн ячейки, чекбокс, трек switch, accept-drop.',
  },
  {
    token: '--tsr-sys-accent-fg',
    arg: 'sysAccentFg',
    label: 'sys-accent-fg',
    desc: 'Контраст к accent. Цвет галочки чекбокса.',
  },
  {
    token: '--tsr-sys-border',
    arg: 'sysBorder',
    label: 'sys-border',
    desc: 'Роль границы. Границы контролов, разделитель закреплённых колонок.',
  },
  {
    token: '--tsr-sys-ring',
    arg: 'sysRing',
    label: 'sys-ring',
    desc: 'База кольца фокуса контролов.',
  },
  {
    token: '--tsr-sys-danger',
    arg: 'sysDanger',
    label: 'sys-danger',
    desc: 'Роль опасности. Свет и плашка ошибки загрузки, отказ действия, полоски слота при недопустимом drop.',
  },
  {
    token: '--tsr-sys-info',
    arg: 'sysInfo',
    label: 'sys-info',
    desc: 'Роль статуса. По умолчанию — цвет полосы прогресс-бара.',
  },
  {
    token: '--tsr-sys-success',
    arg: 'sysSuccess',
    label: 'sys-success',
    desc: 'Роль успеха. Тон подсветки и вспышки «успех» — в демо вторая строка.',
  },
  {
    token: '--tsr-sys-warning',
    arg: 'sysWarning',
    label: 'sys-warning',
    desc: 'Роль предупреждения. Тон подсветки и вспышки «предупреждение» — в демо третья строка.',
  },
  {
    token: '--tsr-sys-overlay-hover',
    arg: 'sysOverlayHover',
    label: 'sys-overlay-hover',
    desc: 'Слой наведения строк и ячеек целиком. Силу тона без смены цвета задаёт tint-hover.',
  },
  {
    token: '--tsr-sys-overlay-selected',
    arg: 'sysOverlaySelected',
    label: 'sys-overlay-selected',
    desc: 'Слой выбранной строки целиком. Силу тона без смены цвета задаёт tint-selected.',
  },
]

// Component-уровень (--tsr-comp-*) — точечный оверрайд конкретного элемента.
const GRID_TOKENS: TokenControl[] = [
  {
    token: '--tsr-comp-head-bg',
    arg: 'headBg',
    label: 'head-bg',
    desc: 'Фон ячеек шапки.',
  },
  {
    token: '--tsr-comp-head-cell-hovered-bg',
    arg: 'headHoverBg',
    label: 'head-cell-hovered-bg',
    desc: 'Фон ячейки шапки при наведении.',
  },
  {
    token: '--tsr-comp-head-cell-pinned-bg',
    arg: 'headPinnedBg',
    label: 'head-cell-pinned-bg',
    desc: 'Фон закреплённой ячейки шапки.',
  },
  {
    token: '--tsr-comp-row-bg',
    arg: 'rowBg',
    label: 'row-bg',
    desc: 'Фон чётных строк тела.',
  },
  {
    token: '--tsr-comp-row-odd-bg',
    arg: 'rowOddBg',
    label: 'row-odd-bg',
    desc: 'Фон нечётных строк (зебра).',
  },
  {
    token: '--tsr-comp-row-hovered-bg',
    arg: 'rowHoverBg',
    label: 'row-hovered-bg',
    desc: 'Слой строки при наведении курсора — поверх её фона.',
  },
  {
    token: '--tsr-comp-row-selected-bg',
    arg: 'rowSelectedBg',
    label: 'row-selected-bg',
    desc: 'Слой выбранной (отмеченной) строки — поверх её фона.',
  },
  {
    token: '--tsr-comp-row-selected-hovered-bg',
    arg: 'rowSelectedHoverBg',
    label: 'row-selected-hovered-bg',
    desc: 'Слой выбранной строки под курсором.',
  },
  {
    token: '--tsr-comp-cell-divider-color',
    arg: 'cellDivider',
    label: 'cell-divider-color',
    desc: 'Разделители строк и ячеек.',
  },
  {
    token: '--tsr-comp-frame-border-color',
    arg: 'frameBorder',
    label: 'frame-border-color',
    desc: 'Рамка вокруг таблицы с тулбаром и нижней панелью.',
  },
  {
    token: '--tsr-comp-toolbar-bg',
    arg: 'toolbarBg',
    label: 'toolbar-bg',
    desc: 'Фон тулбара над таблицей.',
  },
  {
    token: '--tsr-comp-status-bar-bg',
    arg: 'statusBarBg',
    label: 'status-bar-bg',
    desc: 'Фон нижней панели со счётчиком выбранных строк.',
  },
  {
    token: '--tsr-comp-cell-outline-color',
    arg: 'cellOutline',
    label: 'cell-outline-color',
    desc: 'Обводка ячейки тела при наведении и рамка поля правки в фокусе.',
  },
  {
    token: '--tsr-comp-cell-pinned-left-bg',
    arg: 'pinnedBg',
    label: 'cell-pinned-left-bg',
    desc: 'Фон закреплённой ячейки чётной строки; у закреплённых справа — он же. Наведение и выбор ложатся слоем строки поверх.',
  },
  {
    token: '--tsr-comp-cell-odd-pinned-left-bg',
    arg: 'pinnedOddBg',
    label: 'cell-odd-pinned-left-bg',
    desc: 'Фон закреплённой ячейки нечётной строки (зебра).',
  },
  {
    token: '--tsr-comp-cell-pinned-border-color',
    arg: 'pinnedBorder',
    label: 'cell-pinned-border-color',
    desc: 'Цвет границы-разделителя закреплённых колонок.',
  },
  {
    token: '--tsr-comp-control-color',
    arg: 'controlColor',
    label: 'control-color',
    desc: 'Цвет кнопок-иконок в покое: шапка, ячейки, строки, тулбар, меню, пагинация, поиск.',
  },
  {
    token: '--tsr-comp-control-active-color',
    arg: 'controlActive',
    label: 'control-active-color',
    desc: 'Цвет активного контрола (напр. включённой сортировки).',
  },
  {
    token: '--tsr-comp-focus-ring',
    arg: 'focusRing',
    label: 'focus-ring',
    desc: 'Цвет кольца фокуса на чекбоксе/переключателе/кнопке.',
  },
  {
    token: '--tsr-comp-checkbox-checked-bg',
    arg: 'checkboxBg',
    label: 'checkbox-checked-bg',
    desc: 'Фон отмеченного чекбокса выбора строки.',
  },
  {
    token: '--tsr-comp-checkbox-check-color',
    arg: 'checkboxCheck',
    label: 'checkbox-check-color',
    desc: 'Цвет галочки внутри чекбокса.',
  },
  {
    token: '--tsr-comp-action-button-bg',
    arg: 'actionBg',
    label: 'action-button-bg',
    desc: 'Непрозрачный фон кнопок действий строки поверх содержимого; тень — `shadow-action`.',
  },
  {
    token: '--tsr-comp-accent',
    arg: 'accent',
    label: 'accent',
    desc: 'Акцент интерфейса: отметка выбранного пункта меню, панель фильтра, текущая страница пагинации.',
  },
  {
    token: '--tsr-comp-skeleton-bg',
    arg: 'skeletonBg',
    label: 'skeleton-bg',
    desc: 'Базовый цвет скелетон-заглушки при загрузке.',
  },
  {
    token: '--tsr-comp-loader-bar',
    arg: 'loaderBar',
    label: 'loader-bar',
    desc: 'Основной цвет свечения обновления под шапкой и индикатора включённой кнопки; три других оттенка свечения — свои токены `sys-info-sky/-indigo/-violet`.',
  },
  {
    token: '--tsr-comp-scrollbar-thumb',
    arg: 'scrollbarThumb',
    label: 'scrollbar-thumb',
    desc: 'Цвет ползунка тонкого скроллбара.',
  },
]

// Цвет основных теней — единый рычаг (color-контрол).
const SHADOW_COLOR: TokenControl = {
  token: '--tsr-comp-shadow-color',
  arg: 'shadowColor',
  label: 'shadow-color',
  desc: 'Цвет основных теней (шапка, футер, drag-оверлеи). Единый рычаг тональности теней.',
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
    desc: 'Тень под шапкой при скролле (box-shadow целиком).',
    default: '0 4px 8px var(--tsr-comp-shadow-color)',
  },
  {
    token: '--tsr-comp-shadow-footer',
    arg: 'shadowFooter',
    label: 'shadow-footer',
    desc: 'Тень над футером (box-shadow целиком).',
    default: '0 -4px 8px var(--tsr-comp-shadow-color)',
  },
  {
    token: '--tsr-comp-shadow-drag',
    arg: 'shadowDrag',
    label: 'shadow-drag',
    desc: 'Тень клона строки/колонки при перетаскивании.',
    default: 'var(--tsr-comp-shadow-color) 0 2px 4px 2px',
  },
  {
    token: '--tsr-comp-shadow-drop-bubble',
    arg: 'shadowBubble',
    label: 'shadow-drop-bubble',
    desc: 'Тень бейджа-счётчика при перетаскивании нескольких строк.',
    default: '0 1px 2px 0 rgba(0, 0, 0, 0.08)',
  },
  {
    token: '--tsr-comp-shadow-action',
    arg: 'shadowAction',
    label: 'shadow-action',
    desc: 'Тень всплывающих кнопок действий над строкой.',
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
    desc: 'Сила слоя наведения строк и ячеек, % цвета текста.',
    default: 4,
    unit: '%',
    min: 0,
    max: 30,
  },
  {
    token: '--tsr-sys-tint-selected',
    arg: 'tintSelected',
    label: 'tint-selected',
    desc: 'Сила слоя выбранной строки, % цвета текста.',
    default: 6,
    unit: '%',
    min: 0,
    max: 30,
  },
  {
    token: '--tsr-sys-tint-pinned',
    arg: 'tintPinned',
    label: 'tint-pinned',
    desc: 'Подложка закреплённых колонок, % цвета текста.',
    default: 3,
    unit: '%',
    min: 0,
    max: 30,
  },
  {
    token: '--tsr-sys-tint-fill',
    arg: 'tintFill',
    label: 'tint-fill',
    desc: 'Заливки без текста: скелет, ползунок прокрутки, % цвета текста.',
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
    desc: 'Высота строки тела, px.',
    default: 50,
    unit: 'px',
    min: 32,
    max: 72,
  },
  {
    token: '--tsr-comp-head-row-height',
    arg: 'headRowHeight',
    label: 'head-row-height',
    desc: 'Высота строки шапки, px. Пока не задана — как у строк тела.',
    default: 50,
    unit: 'px',
    min: 32,
    max: 80,
  },
  {
    token: '--tsr-comp-grid-button-size',
    arg: 'gridButtonSize',
    label: 'grid-button-size',
    desc: 'Кнопки в шапке, ячейках и строках, px; колонка выбора — по ним же. Кнопки тулбара не меняются.',
    default: 28,
    unit: 'px',
    min: 20,
    max: 40,
  },
  {
    token: '--tsr-comp-cell-content-padding-x',
    arg: 'cellPaddingX',
    label: 'cell-content-padding-x',
    desc: 'Отступ содержимого от краёв ячейки, px.',
    default: 12,
    unit: 'px',
    min: 4,
    max: 24,
  },
  {
    token: '--tsr-comp-cell-font-size',
    arg: 'cellFontSize',
    label: 'cell-font-size',
    desc: 'Кегль текста ячеек и шапки, px.',
    default: 13,
    unit: 'px',
    min: 11,
    max: 18,
  },
  {
    token: '--tsr-sys-radius',
    arg: 'radius',
    label: 'sys-radius',
    desc: 'Скругление рамки таблицы, кнопок, меню и тултипов, px.',
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
  desc: 'Шрифт таблицы (CSS font-family); пусто — шрифт темы.',
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
        description: desc,
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
    // (keyboardNavigation).
    plugins: [
      keyboardNavigation(),
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
        description: desc,
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
        'Загрузка данных: `refresh` — свечение под шапкой (токены loader-*), наведение на время гаснет; `initial` — скелет первой загрузки (skeleton-bg).',
      control: 'inline-radio',
      options: ['off', 'refresh', 'initial'],
      table: { category: 'Режим' },
    },
    loadError: {
      name: 'loadError',
      description:
        'Отказ загрузки: красный свет под шапкой и плашка — чтобы увидеть destructive/sys-danger.',
      control: 'boolean',
      table: { category: 'Режим' },
    },
    ...colorArgTypes(PALETTE, 'shadcn — мост (broad)'),
    ...colorArgTypes(SEMANTIC, 'Semantic (--tsr-sys-*)'),
    ...colorArgTypes(GRID_TOKENS, 'Component (--tsr-comp-*)'),
    ...colorArgTypes([SHADOW_COLOR], 'Тени'),
    ...numberArgTypes(TINT_TOKENS, 'Тона (--tsr-sys-tint-*)'),
    ...numberArgTypes(SIZE_TOKENS, 'Размеры'),
    fontFamily: {
      name: FONT_FAMILY.label,
      description: FONT_FAMILY.desc,
      control: { type: 'text' },
      table: { category: 'Размеры' },
    },
    ...Object.fromEntries(
      SHADOW_TOKENS.map(({ arg, label, desc }) => [
        arg,
        {
          name: label,
          description: desc,
          control: { type: 'text' },
          table: { category: 'Тени' },
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
const PALETTE_GROUPS: { title: string; tokens: TokenControl[] }[] = [
  { title: 'Мост shadcn (broad)', tokens: PALETTE },
  { title: 'Semantic (--tsr-sys-*)', tokens: SEMANTIC },
  { title: 'Component (--tsr-comp-*)', tokens: GRID_TOKENS },
]

// Один свотч: цвет читаем со смонтированного элемента (getComputedStyle внутри
// тематизированной колонки → значение именно этой темы, включая раскрытый
// color-mix, который браузер отдаёт готовым rgb/rgba).
const Swatch = ({ token, label, desc }: TokenControl) => {
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
        <div style={{ fontWeight: 600 }}>{desc}</div>
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
const PaletteColumn = ({ mode }: { mode: 'light' | 'dark' }) => (
  <div
    className={
      mode === 'dark' ? `${DATA_GRID_THEME_CLASS} dark` : DATA_GRID_THEME_CLASS
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
      {mode === 'dark' ? 'Тёмная тема' : 'Светлая тема'}
    </h3>
    {PALETTE_GROUPS.map(({ title, tokens }) => (
      <section key={title} style={{ marginBottom: 24 }}>
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
          {title}
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

const THEME_WRAPPER = '.data-grid-theme[class*="theme-wrapper"]'
const wrapperOf = (root: ParentNode) =>
  root.querySelector<HTMLElement>(THEME_WRAPPER)
/** Тема, в которой таблица нарисована сейчас. */
const schemeOf = (root: ParentNode) => {
  const wrapper = wrapperOf(root)
  return wrapper ? getComputedStyle(wrapper).colorScheme : ''
}

/** Контейнер приложения с темой: его фон из палитры приложения виден вокруг таблицы. */
const SOURCE_CONTAINER = 'theming-source-container'
const SOURCE_CONTAINER_CSS = `.${SOURCE_CONTAINER} {
  padding: 16px;
  border-radius: 8px;
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

const SOURCES: readonly GuideStoryStep[] = [
  {
    title: 'Тема по странице',
    hint: 'Таблица не задаёт себе тему, а следует теме страницы.',
    props: () => ({ colorMode: 'auto' }),
  },
  {
    title: 'Приложение затемнило контейнер',
    hint: 'У контейнера таблицы тёмная тема. Таблица следует ближайшему предку и становится тёмной, цвета берёт из тёмной палитры приложения.',
    enter: darkContainer,
  },
  {
    title: 'Таблице задана светлая тема',
    hint: 'Приложение задало таблице светлую тему внутри тёмного контейнера. Таблица светлая на своих светлых значениях, тёмный предок на неё не действует.',
    props: () => ({ colorMode: 'light' }),
    enter: darkContainer,
  },
  {
    title: 'Таблице задана тёмная тема',
    hint: 'Контейнер снова светлый, а приложение задало таблице тёмную тему. Таблица тёмная на светлой странице.',
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
      <GuideStory
        title="Источник темы"
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
    await step(SOURCES[0]!.title, async () => {
      await until(() => expect(schemeOf(canvas)).toBe(page))
    })
    await step(SOURCES[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(schemeOf(canvas)).toBe('dark'))
      expect(wrapperOf(canvas)!.parentElement!.classList).toContain('dark')
    })
    await step(SOURCES[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(schemeOf(canvas)).toBe('light'))
      expect(wrapperOf(canvas)!.parentElement!.classList).toContain('dark')
    })
    await step(SOURCES[3]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(schemeOf(canvas)).toBe('dark'))
      expect(wrapperOf(canvas)!.parentElement!.classList).not.toContain('dark')
    })
    await settle()
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

const GRID_BUTTONS: readonly GuideStoryStep[] = [
  {
    title: 'Кнопки по умолчанию',
    hint: 'Тема приложения размер кнопок не задаёт. Кнопки в заголовке, ячейках и строках — 28px, колонки выбора и раскрытия строк — 36px. Кнопки панели над таблицей — 32px. В примере кнопки ячеек и строк показаны сразу, обычно они появляются при наведении.',
  },
  {
    title: 'Тема задала крупные кнопки',
    hint: 'Приложение указало в своей теме размер кнопок таблицы 32px. Кнопки в заголовке, ячейках и строках — 32px, колонки выбора и раскрытия — 40px. Кнопки панели над таблицей по-прежнему 32px.',
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
      <GuideStory
        title="Размер кнопок таблицы из темы"
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
    await step(GRID_BUTTONS[0].title, async () => {
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
    await step(GRID_BUTTONS[1].title, async () => {
      await guideNext(canvas)
      await expectSizes(32, 40)
    })
    await settle()
  },
}
