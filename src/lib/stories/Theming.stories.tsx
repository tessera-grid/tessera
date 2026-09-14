import { CSSProperties, memo, useLayoutEffect, useRef, useState } from 'react'

import { Meta, StoryObj } from '@storybook/react'

import { Card, CardContent, Grid } from './_shims'
import { DATA_GRID_THEME_CLASS } from '../core/themeVariables'
import { useCreateHooks } from '../../v9/core/createHooks'
import { useRowSelectionState } from '../../v9/core/createState'
import { useCreateTable } from '../../v9/core/useCreateTable'
import { DataGrid } from '../../v9/grid/DataGrid'
import {
  columnPinning,
  columnSizing,
  columnSorting,
  rowActions,
  rowSelection,
} from '../../v9/plugins'
import { useColumns } from './__mocks__/columns'
import { useData } from './__mocks__/data'

// История витрины темизации: контролы Storybook меняют цвет токена, значение
// прокидывается в грид инлайн-`style` обёртки (бьёт дефолты слоя из theme.css —
// ADR 0018). Три поверхности переопределения по уровням токенов (ADR 0019),
// от общего к частному:
//   • «shadcn — мост (broad)» — апстрим-токены (`--primary`/`--foreground`/…):
//     интеграция с дизайн-системой приложения; каскадит во всё.
//   • «Semantic (--tsr-sys-*)» — роли грида (fg/surface/accent/overlay…): средний
//     рычаг, меняет всю группу; тема-зависимый уровень (флипается в dark).
//   • «Component (--tsr-comp-*)» — прямые токены части: точечный оверрайд
//     конкретного элемента, не трогая уровни выше.
// Primitive (`--tsr-ref-*`) в витрину не выносим — это не поверхность
// переопределения (ADR 0019, T-R9).

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
    desc: 'Базовый фон холста. Задаёт фон нечётных строк, закреплённых слева ячеек и drag-клона.',
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
    desc: 'Фон карточки. Задаёт фон чётных строк, кнопок действий и thumb переключателя.',
  },
  {
    token: '--muted',
    arg: 'muted',
    label: 'muted',
    desc: 'Приглушённый фон. Задаёт шапку, закреплённые ячейки и hover кнопок действий.',
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
    desc: 'Цвет ошибки/опасности. Фон строки при недопустимом drop.',
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
    desc: 'Роль базового фона. Фон нечётных строк, drag-клона, закреплённых слева ячеек.',
  },
  {
    token: '--tsr-sys-surface',
    arg: 'sysSurface',
    label: 'sys-surface',
    desc: 'Роль поверхности. Фон чётных строк, кнопок действий, thumb переключателя.',
  },
  {
    token: '--tsr-sys-muted',
    arg: 'sysMuted',
    label: 'sys-muted',
    desc: 'Роль приглушённого фона. Шапка, закреплённые ячейки, hover кнопок действий.',
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
    desc: 'Роль опасности. Фон строки при недопустимом drop.',
  },
  {
    token: '--tsr-sys-info',
    arg: 'sysInfo',
    label: 'sys-info',
    desc: 'Роль статуса. По умолчанию — цвет полосы прогресс-бара.',
  },
  {
    token: '--tsr-sys-overlay-hover',
    arg: 'sysOverlayHover',
    label: 'sys-overlay-hover',
    desc: 'Оверлей наведения (один рычаг интенсивности hover-подсветки строк/ячеек).',
  },
  {
    token: '--tsr-sys-overlay-selected',
    arg: 'sysOverlaySelected',
    label: 'sys-overlay-selected',
    desc: 'Оверлей выделения (интенсивность подсветки выбранной строки).',
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
    desc: 'Фон ячейки шапки при наведении (и подложка ресайз-хэндла).',
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
    desc: 'Фон строки при наведении курсора.',
  },
  {
    token: '--tsr-comp-row-selected-bg',
    arg: 'rowSelectedBg',
    label: 'row-selected-bg',
    desc: 'Фон выбранной (отмеченной) строки.',
  },
  {
    token: '--tsr-comp-cell-outline-color',
    arg: 'cellOutline',
    label: 'cell-outline-color',
    desc: 'Цвет аутлайна ячейки шапки при наведении.',
  },
  {
    token: '--tsr-comp-cell-pinned-bg',
    arg: 'pinnedBg',
    label: 'cell-pinned-bg',
    desc: 'Фон закреплённой (pinned) ячейки.',
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
    desc: 'Цвет иконок контролов шапки (сортировка/пиннинг/группировка) в покое.',
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
    token: '--tsr-comp-action-button-color',
    arg: 'actionColor',
    label: 'action-button-color',
    desc: 'Цвет иконок кнопок действий над строкой.',
  },
  {
    token: '--tsr-comp-action-button-bg',
    arg: 'actionBg',
    label: 'action-button-bg',
    desc: 'Фон кнопок действий над строкой.',
  },
  {
    token: '--tsr-comp-accent',
    arg: 'accent',
    label: 'accent',
    desc: 'Общий акцентный цвет грида.',
  },
  {
    token: '--tsr-comp-skeleton-bg',
    arg: 'skeletonBg',
    label: 'skeleton-bg',
    desc: 'Базовый цвет скелетон-заглушки при загрузке.',
  },
  {
    token: '--tsr-comp-loader-track',
    arg: 'loaderTrack',
    label: 'loader-track',
    desc: 'Цвет дорожки линейного прогресс-бара.',
  },
  {
    token: '--tsr-comp-loader-bar',
    arg: 'loaderBar',
    label: 'loader-bar',
    desc: 'Цвет бегущей полосы прогресс-бара.',
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
    default: 'rgb(0 0 0 / 20%) 0px 0px 4px 2px',
  },
]

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
  enableLoading: boolean
  [arg: string]: string | boolean
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

  return style as CSSProperties
}

const ThemingDemo = memo((args: ThemingArgs) => {
  const columns = useColumns(6)
  const { data } = useData({ count: 12, mode: 'flat', showStub: false })

  const { rowSelection: selection, onRowSelectionChange } =
    useRowSelectionState()

  const table = useCreateTable({
    // Демо-колонки строятся v8-хелпером (мок), таблица — v9: касты на границе
    // снимают вариантность типов (рантайм совпадает, покрыт визуал-тестами).
    columns: columns as never,
    data,
    state: { rowSelection: selection } as never,
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
            table={table as never}
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
    ...Object.fromEntries(
      SHADOW_TOKENS.map(({ arg, default: def }) => [arg, def]),
    ),
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
    ...colorArgTypes(PALETTE, 'shadcn — мост (broad)'),
    ...colorArgTypes(SEMANTIC, 'Semantic (--tsr-sys-*)'),
    ...colorArgTypes(GRID_TOKENS, 'Component (--tsr-comp-*)'),
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

// ============================================================================
// Палитра — свотч-борд токенов в обеих темах. Отдельная история: закруглённые
// квадраты на нейтральном фоне (`--tsr-sys-bg`), под каждым — русская подпись
// (роль токена), имя переменной и вычисленное значение цвета. Светлая и тёмная
// колонки рендерятся рядом (каждая — свой скоуп `.data-grid-theme[.dark]`),
// поэтому один и тот же токен резолвится в цвет своей темы.
// ============================================================================

// Группы палитры = те же массивы, что питают контролы Playground (от общего
// уровня к частному, ADR 0019). Overlay-токены полупрозрачны, поэтому свотчам
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
  name: 'Палитра (свотчи)',
  render: () => <PaletteBoard />,
  // Контролы токенов относятся к Playground; для статичного борда прячем панель.
  parameters: { controls: { disable: true } },
}
