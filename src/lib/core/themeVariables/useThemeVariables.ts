import { CSSProperties, useMemo } from 'react'

import {
  COLUMN_CONTENT_GAP,
  COLUMN_CONTENT_PADDING,
} from './cellContentVariables'

export type ColorMode = 'light' | 'dark'

const EASING_EASE_IN_OUT = 'cubic-bezier(0.4, 0, 0.2, 1)'
const DURATION_SHORTEST = 150
const DURATION_STANDARD = 300

/**
 * Формирует CSS-строку transition из набора свойств, длительности и easing.
 */
const createTransition = (
  props: string[],
  duration = DURATION_SHORTEST,
  easing = EASING_EASE_IN_OUT,
  delay = 0,
): string =>
  props.map(prop => `${prop} ${duration}ms ${easing} ${delay}ms`).join(',')

/**
 * Смешивает токен с прозрачностью — тонкие тинты (hover/selected/skeleton),
 * которым не соответствует ни один цельный shadcn-токен.
 */
const alpha = (token: string, percent: number, fallback: string) =>
  `color-mix(in oklch, var(${token}, ${fallback}) ${percent}%, transparent)`

/**
 * Смешивает токен с чернилами (foreground) без прозрачности — для непрозрачных
 * поверхностей (hover заголовка = фон ресайз-хэндла, pinned-hover), которые
 * обязаны маскировать контент под собой.
 */
const shade = (
  token: string,
  inkPercent: number,
  fallback: string,
  inkFallback: string,
) =>
  `color-mix(in oklch, var(${token}, ${fallback}), var(--foreground, ${inkFallback}) ${inkPercent}%)`

/**
 * Набор CSS-переменных таблицы.
 *
 * Тема грида — тонкая производная от токенов shadcn (см. src/styles/global.css и
 * docs/design.md): `--data-grid-*` ссылаются на `--primary`, `--foreground`,
 * `--muted`, `--border`, `--destructive`, `--ring`, `--info` и т.д. через
 * `var()`/`color-mix()`. Значение в `var(--token, fallback)` — это дефолт в духе
 * «Vercel» (моно-чернила #171717 на #fafafa), так что грид не ломается, даже
 * если global.css не подключён. Тёмный режим приходит из класса `.dark` на
 * обёртке грида (см. DataGrid.tsx), который переопределяет базовые токены —
 * поэтому набор ниже одинаков для light/dark.
 */
const getVariables = () => ({
  '--data-grid-z-index-pinned': 2,
  '--data-grid-z-index-head': 3,
  '--data-grid-z-index-loader': 4,

  '--data-grid-opacity': 0.99,
  '--data-grid-draggable-opacity': 0.95,

  '--data-grid-scrollbar-width': '6px',
  '--data-grid-scrollbar-thumb': alpha('--foreground', 25, '#171717'),
  '--data-grid-scrollbar-thumb-hover': alpha('--foreground', 40, '#171717'),
  '--data-grid-resize-handler-width': '24px',

  '--data-grid-head-cell-transition': createTransition([
    'background-color',
    'transform',
  ]),

  '--data-grid-row-transition': createTransition(['background-color']),

  '--data-grid-button-cell-transition': createTransition([
    'color',
    'background-color',
    'border-color',
    'opacity',
    'transform',
    'height',
  ]),

  '--data-grid-loader-height': '2px',
  '--data-grid-row-height': '50px',

  '--data-grid-head-bg': 'var(--muted, #f5f5f5)',
  // Непрозрачный hover — этим же фоном красится ресайз-хэндл, который обязан
  // маскировать контент ячейки; берём muted, слегка затемнённый чернилами.
  '--data-grid-head-cell-hovered-bg': shade('--muted', 8, '#f5f5f5', '#171717'),
  '--data-grid-draggable-cell-bg': 'var(--background, #fafafa)',

  '--data-grid-row-bg': 'var(--card, #ffffff)',
  '--data-grid-row-odd-bg': 'var(--background, #fafafa)',
  '--data-grid-row-hovered-bg': alpha('--foreground', 4, '#171717'),
  '--data-grid-row-selected-bg': alpha('--foreground', 6, '#171717'),
  '--data-grid-row-selected-hovered-bg': alpha('--foreground', 10, '#171717'),

  '--data-grid-cell-outline-color': 'var(--primary, #171717)',
  '--data-grid-cell-pinned-bg': 'var(--muted, #f5f5f5)',
  '--data-grid-cell-pinned-hovered-bg': shade(
    '--muted',
    6,
    '#f5f5f5',
    '#171717',
  ),
  '--data-grid-cell-pinned-selected-hovered-bg': shade(
    '--muted',
    6,
    '#f5f5f5',
    '#171717',
  ),
  '--data-grid-body-cell-outline-color': 'var(--primary, #171717)',
  '--data-grid-cell-content-padding': `0px ${COLUMN_CONTENT_PADDING}px`,
  '--data-grid-cell-content-gap': `${COLUMN_CONTENT_GAP}px`,
  '--data-grid-cell-font-size': '0.8125rem',
  // Typography — theme-agnostic default (system stack); override to use a
  // custom face. Numeric feature aligns digits in columns.
  '--data-grid-font-family':
    "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif",
  '--data-grid-numeric-font-feature': 'tabular-nums',
  '--data-grid-cell-odd-pinned-left-bg': 'var(--muted, #f5f5f5)',
  '--data-grid-cell-pinned-left-bg': 'var(--background, #fafafa)',
  '--data-grid-cell-pinned-border-color': 'var(--border, #ebebeb)',

  '--data-grid-row-accept-draggable-bg': 'var(--primary, #171717)',
  '--data-grid-row-not-accept-draggable-bg': 'var(--destructive, #ee0000)',

  // Иконки контролов должны выделяться: заметный тон (ink ~78%, ≈ design.md
  // body #4d4d4d), а не бледный muted-foreground. Активное состояние — полный ink.
  '--data-grid-control-color':
    'color-mix(in oklch, var(--foreground, #171717) 78%, var(--background, #fafafa))',
  '--data-grid-control-active-color': 'var(--foreground, #171717)',
  '--data-grid-control-active-hover-bg': alpha('--foreground', 8, '#171717'),
  '--data-grid-control-hover-bg': alpha('--foreground', 5, '#171717'),
  '--data-grid-control-disabled-color': alpha('--foreground', 32, '#171717'),
  '--data-grid-resize-handler-transition': createTransition(['height']),

  // Общая форма/интеракции контролов — из shadcn-токенов.
  '--data-grid-control-radius': 'var(--radius-md, 8px)',
  '--data-grid-control-border': 'var(--border, #ebebeb)',
  '--data-grid-focus-ring': alpha('--ring', 40, '#171717'),
  '--data-grid-focus-ring-width': '2px',

  // Checkbox — монохром: заливка primary + галочка primary-foreground.
  '--data-grid-checkbox-size': '16px',
  '--data-grid-checkbox-radius': '4px',
  '--data-grid-checkbox-checked-bg': 'var(--primary, #171717)',
  '--data-grid-checkbox-check-color': 'var(--primary-foreground, #ffffff)',

  // Switch — монохром: primary-трек во включённом, thumb цвета карточки.
  '--data-grid-switch-track-off': alpha('--foreground', 25, '#171717'),
  '--data-grid-switch-track-on': 'var(--primary, #171717)',
  '--data-grid-switch-thumb': 'var(--card, #ffffff)',

  '--data-grid-action-button-color':
    'color-mix(in oklch, var(--foreground, #171717) 78%, var(--background, #fafafa))',
  '--data-grid-action-button-bg': 'var(--card, #ffffff)',
  '--data-grid-action-button-hover-bg': 'var(--muted, #f5f5f5)',
  '--data-grid-action-button-transition': createTransition(
    ['background-color'],
    DURATION_STANDARD,
  ),

  '--data-grid-accent': 'var(--primary, #171717)',
  '--data-grid-skeleton-bg': alpha('--foreground', 10, '#171717'),
  '--data-grid-skeleton-wave': alpha('--foreground', 5, '#171717'),
  '--data-grid-loader-track': alpha('--foreground', 10, '#171717'),
  // Загрузка — это статус, а не бренд-акцент (как ошибка остаётся красной):
  // линейный прогресс держит синий (--info), чтобы активность читалась сразу.
  '--data-grid-loader-bar': 'var(--info, #0070f3)',
})

export interface ThemeVariablesParams {
  /**
   * Цветовая схема таблицы.
   * @default 'light'
   */
  colorMode?: ColorMode
}

/**
 * Формирует набор CSS-переменных таблицы.
 *
 * Значения одинаковы для light/dark — они выведены из токенов shadcn через
 * `var()`; фактический режим включает класс `.dark` на обёртке грида. Любой
 * токен можно переопределить снаружи, задав одноимённую CSS-переменную на
 * контейнере таблицы.
 *
 * `colorMode` сохранён в сигнатуре для обратной совместимости (его применяет
 * DataGrid, вешая класс `.dark`), но на возвращаемый объект он не влияет.
 */
export const useThemeVariables = (
  _params: ThemeVariablesParams = {},
): CSSProperties => useMemo(() => getVariables() as CSSProperties, [])
