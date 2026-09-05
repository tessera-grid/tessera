import { CSSProperties, memo } from 'react'

import { Meta, StoryObj } from '@storybook/react'

import { Card, CardContent, Grid } from './_shims'
import { DATA_GRID_THEME_CLASS } from '../core/themeVariables'
import { useCreateHooks } from '../core/createHooks/useCreateHooks'
import { useRowSelectionState } from '../core/createState/rowSelectionState'
import { useCreateTable } from '../core/createTable'
import { DataGrid } from '../grid/DataGrid/DataGrid'
import {
  columnPinning,
  columnSizing,
  columnSorting,
  rowActions,
  rowSelection,
} from '../plugins'
import { useColumns } from './__mocks__/columns'
import { useData } from './__mocks__/data'

// История витрины темизации: контролы Storybook меняют цвет каждого токена, а
// значение прокидывается в грид через инлайн-`style` обёртки (бьёт дефолты слоя
// `.data-grid-theme` из theme.css — см. ADR 0018). Два раздела:
//   • «Палитра (shadcn)» — апстрим-токены (`--primary`/`--foreground`/`--info`…),
//     из которых через var()/color-mix() выводятся ВСЕ токены грида: правишь один
//     — согласованно меняется вся тема.
//   • «Токены грида» — прямые `--data-grid-*`: точечный оверрайд конкретного
//     элемента (напр. только цвет прогресс-бара), не трогая палитру.

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

// Апстрим-палитра shadcn — верхний рычаг: правка каскадит во все токены грида.
const PALETTE: TokenControl[] = [
  { token: '--background', arg: 'background', label: 'background', desc: 'Базовый фон холста. Каскадит в фон нечётных строк, закреплённых слева ячеек и drag-клона.' },
  { token: '--foreground', arg: 'foreground', label: 'foreground', desc: 'Основные «чернила» (текст/иконки). База для hover/selected-фонов, цвета контролов, скелетона, фокус-ринга.' },
  { token: '--card', arg: 'card', label: 'card', desc: 'Фон карточки. Каскадит в фон чётных строк, кнопок действий и thumb переключателя.' },
  { token: '--muted', arg: 'muted', label: 'muted', desc: 'Приглушённый фон. Каскадит в шапку, закреплённые ячейки и hover кнопок действий.' },
  { token: '--primary', arg: 'primary', label: 'primary', desc: 'Акцент/чернила. Каскадит в аутлайн ячейки, заливку чекбокса, включённый трек switch, accent.' },
  { token: '--primary-foreground', arg: 'primaryForeground', label: 'primary-foreground', desc: 'Контраст к primary. Каскадит в цвет галочки чекбокса.' },
  { token: '--border', arg: 'border', label: 'border', desc: 'Цвет hairline-границ. Каскадит в границы контролов и разделитель закреплённых колонок.' },
  { token: '--ring', arg: 'ring', label: 'ring', desc: 'База цвета кольца фокуса (клавиатурный фокус контролов).' },
  { token: '--destructive', arg: 'destructive', label: 'destructive', desc: 'Цвет ошибки/опасности. Фон строки при недопустимом drop.' },
  { token: '--info', arg: 'info', label: 'info (loader)', desc: 'Семантический синий (статус). По умолчанию — цвет бегущей полосы прогресс-бара.' },
]

// Прямые токены грида — точечный оверрайд конкретного элемента.
const GRID_TOKENS: TokenControl[] = [
  { token: '--data-grid-head-bg', arg: 'headBg', label: 'head-bg', desc: 'Фон ячеек шапки.' },
  { token: '--data-grid-head-cell-hovered-bg', arg: 'headHoverBg', label: 'head-cell-hovered-bg', desc: 'Фон ячейки шапки при наведении (и подложка ресайз-хэндла).' },
  { token: '--data-grid-row-bg', arg: 'rowBg', label: 'row-bg', desc: 'Фон чётных строк тела.' },
  { token: '--data-grid-row-odd-bg', arg: 'rowOddBg', label: 'row-odd-bg', desc: 'Фон нечётных строк (зебра).' },
  { token: '--data-grid-row-hovered-bg', arg: 'rowHoverBg', label: 'row-hovered-bg', desc: 'Фон строки при наведении курсора.' },
  { token: '--data-grid-row-selected-bg', arg: 'rowSelectedBg', label: 'row-selected-bg', desc: 'Фон выбранной (отмеченной) строки.' },
  { token: '--data-grid-cell-outline-color', arg: 'cellOutline', label: 'cell-outline-color', desc: 'Цвет аутлайна ячейки шапки при наведении.' },
  { token: '--data-grid-cell-pinned-bg', arg: 'pinnedBg', label: 'cell-pinned-bg', desc: 'Фон закреплённой (pinned) ячейки.' },
  { token: '--data-grid-cell-pinned-border-color', arg: 'pinnedBorder', label: 'cell-pinned-border-color', desc: 'Цвет границы-разделителя закреплённых колонок.' },
  { token: '--data-grid-control-color', arg: 'controlColor', label: 'control-color', desc: 'Цвет иконок контролов шапки (сортировка/пиннинг/группировка) в покое.' },
  { token: '--data-grid-control-active-color', arg: 'controlActive', label: 'control-active-color', desc: 'Цвет активного контрола (напр. включённой сортировки).' },
  { token: '--data-grid-focus-ring', arg: 'focusRing', label: 'focus-ring', desc: 'Цвет кольца фокуса на чекбоксе/переключателе/кнопке.' },
  { token: '--data-grid-checkbox-checked-bg', arg: 'checkboxBg', label: 'checkbox-checked-bg', desc: 'Фон отмеченного чекбокса выбора строки.' },
  { token: '--data-grid-checkbox-check-color', arg: 'checkboxCheck', label: 'checkbox-check-color', desc: 'Цвет галочки внутри чекбокса.' },
  { token: '--data-grid-action-button-color', arg: 'actionColor', label: 'action-button-color', desc: 'Цвет иконок кнопок действий над строкой.' },
  { token: '--data-grid-action-button-bg', arg: 'actionBg', label: 'action-button-bg', desc: 'Фон кнопок действий над строкой.' },
  { token: '--data-grid-accent', arg: 'accent', label: 'accent', desc: 'Общий акцентный цвет грида.' },
  { token: '--data-grid-skeleton-bg', arg: 'skeletonBg', label: 'skeleton-bg', desc: 'Базовый цвет скелетон-заглушки при загрузке.' },
  { token: '--data-grid-loader-track', arg: 'loaderTrack', label: 'loader-track', desc: 'Цвет дорожки линейного прогресс-бара.' },
  { token: '--data-grid-loader-bar', arg: 'loaderBar', label: 'loader-bar', desc: 'Цвет бегущей полосы прогресс-бара.' },
  { token: '--data-grid-scrollbar-thumb', arg: 'scrollbarThumb', label: 'scrollbar-thumb', desc: 'Цвет ползунка тонкого скроллбара.' },
]

// Цвет основных теней — единый рычаг (color-контрол).
const SHADOW_COLOR: TokenControl = {
  token: '--data-grid-shadow-color',
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
    token: '--data-grid-shadow-head',
    arg: 'shadowHead',
    label: 'shadow-head',
    desc: 'Тень под шапкой при скролле (box-shadow целиком).',
    default: '0 4px 8px var(--data-grid-shadow-color)',
  },
  {
    token: '--data-grid-shadow-footer',
    arg: 'shadowFooter',
    label: 'shadow-footer',
    desc: 'Тень над футером (box-shadow целиком).',
    default: '0 -4px 8px var(--data-grid-shadow-color)',
  },
  {
    token: '--data-grid-shadow-drag',
    arg: 'shadowDrag',
    label: 'shadow-drag',
    desc: 'Тень клона строки/колонки при перетаскивании.',
    default: 'var(--data-grid-shadow-color) 0 2px 4px 2px',
  },
  {
    token: '--data-grid-shadow-drop-bubble',
    arg: 'shadowBubble',
    label: 'shadow-drop-bubble',
    desc: 'Тень бейджа-счётчика при перетаскивании нескольких строк.',
    default: '0 1px 2px 0 rgba(0, 0, 0, 0.08)',
  },
  {
    token: '--data-grid-shadow-action',
    arg: 'shadowAction',
    label: 'shadow-action',
    desc: 'Тень всплывающих кнопок действий над строкой.',
    default: 'rgb(0 0 0 / 20%) 0px 0px 4px 2px',
  },
]

// Цветовые токены (резолвятся в rgb для свотчей); тени-строки — отдельно.
const ALL_TOKENS = [...PALETTE, ...GRID_TOKENS, SHADOW_COLOR]

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
  enableLoading: boolean
  [arg: string]: string | boolean
}

/**
 * Собрать инлайн-`style` из значений контролов. Инжектим ТОЛЬКО реально
 * изменённые токены (значение ≠ дефолт) — иначе форсированный инлайн маскировал
 * бы дефолты слоя и ломал бы тёмный режим/каскад палитры для нетронутых токенов.
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

  return style as CSSProperties
}

const ThemingDemo = memo((args: ThemingArgs) => {
  const columns = useColumns(6)
  const { data } = useData({ count: 12, mode: 'flat', showStub: false })

  const { rowSelection: selection, onRowSelectionChange } =
    useRowSelectionState()

  const table = useCreateTable({
    columns,
    data,
    state: { rowSelection: selection },
    handlers: { onRowSelectionChange },
    hooks: useCreateHooks({
      rowSelection: {
        onSelectRow: () => null,
        onSelectAllRowsOnPage: () => null,
        isAllRowsSelected: false,
      },
    }),
    enableLoading: args.enableLoading,
    // Набор фич подобран так, чтобы витрина задействовала как можно больше
    // токенов: чекбоксы (rowSelection), кнопки шапки (sorting/pinning/sizing) и
    // колонка действий (rowActions).
    plugins: [
      rowSelection(),
      columnSorting(),
      columnPinning(),
      columnSizing(),
      rowActions({ width: 40 }),
    ],
  })

  return (
    <Grid
      style={{
        padding: 16,
        height: 480,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Card style={{ height: '100%' }}>
        <CardContent
          style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
        >
          <DataGrid
            table={table}
            height={400}
            maxHeight={400}
            colorMode={args.colorMode}
            style={buildThemeStyle(args)}
          />
        </CardContent>
      </Card>
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
    enableLoading: true,
    ...RESOLVED_DEFAULTS,
    ...Object.fromEntries(SHADOW_TOKENS.map(({ arg, default: def }) => [arg, def])),
  },
  argTypes: {
    // colorMode (light/dark) переключается ГЛОБАЛЬНЫМ тумблером «Theme» в
    // тулбаре Storybook (preview.tsx синхронит его с гридом), поэтому отдельного
    // arg-контрола здесь нет — иначе он молча перезаписывался бы декоратором.
    enableLoading: {
      name: 'enableLoading (loader)',
      description:
        'Показать линейный прогресс-бар под шапкой — чтобы увидеть токены loader-*.',
      control: { type: 'boolean' },
      table: { category: 'Режим' },
    },
    ...colorArgTypes(PALETTE, 'Палитра (shadcn)'),
    ...colorArgTypes(GRID_TOKENS, 'Токены грида (--data-grid-*)'),
    ...colorArgTypes([SHADOW_COLOR], 'Тени'),
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
