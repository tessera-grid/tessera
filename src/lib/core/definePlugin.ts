/**
 * definePlugin — авторская поверхность плагина поверх записи `TesseraFeatureEntry`.
 * Принимает декларации по полям, возвращает фабрику
 * `(opts?) => TesseraFeatureEntry`. Прячет раскладку: `options` → опции таблицы,
 * `hooks` → живой слайс записи под ключом `id` (undefined-ключи отброшены),
 * `features` → фрагмент фич v9, `state` → сгенерированная v9-фича локального слайса
 * под ключом `id`, `column`/`slots`/`setup` — как есть.
 *
 * Каналы в компонент: `hooks` — пропсом через `injectCellHooks`/`injectHeaderHooks`;
 * локальный `state` — пропсом `[value, setter]` через `injectCellState`. Резолвнутые
 * `options`-как-пропс (компонент-facing конфиг) отдельным каналом не выделены —
 * компонент-facing конфиг (напр. предикат `canEdit`) кладут в `hooks` (живой слайс).
 */
import { createElement, type ReactNode } from 'react'

import { makeStateUpdater } from '@tanstack/react-table'

import type { TableFeature } from '../types'
import type { ServiceColumn } from './createColumns'
import type {
  CellComponentProps,
  HeaderComponentProps,
  PluginSlot,
} from './createSlots'
import type { TesseraFeatureEntry } from './features'
import type {
  ActionMenuDeclaration,
  ContextMenuAction,
  SlotAction,
} from './headerActions'
import { useSlice } from './reactivity'

/** Пропсы компонента ячейки: нативный `CellContext` + инъектированный слайс хуков. */
export interface PluginCellProps<THooks = never> extends CellComponentProps {
  hooks: THooks
}

/** Пропсы компонента заголовка: нативный `HeaderContext` + слайс хуков. */
export interface PluginHeaderProps<
  THooks = never,
> extends HeaderComponentProps {
  hooks: THooks
}

/**
 * Живое чтение hook-слайса плагина из общего канала `table.getHooks()` по его scope
 * (= `id`). Единственный контролируемый каст — здесь; компонент получает слайс
 * типизированным пропсом.
 */
export const readPluginHooks = <THooks>(
  table: { getHooks: () => unknown },
  scope: string,
): THooks => {
  const all = (table.getHooks() ?? {}) as Record<string, unknown>
  return (all[scope] ?? {}) as THooks
}

/**
 * Обёртка колонки/слота: подмешивает hook-слайс плагина (по `scope`) в компонент
 * ячейки типизированным пропсом `hooks`. Компонент — чистая функция `PluginCellProps`,
 * без кастов и импорта плагина.
 */
export const injectCellHooks =
  <THooks>(
    Component: (props: PluginCellProps<THooks>) => ReactNode,
    scope: string,
  ) =>
  (ctx: CellComponentProps): ReactNode =>
    createElement(Component, {
      ...ctx,
      hooks: readPluginHooks<THooks>(ctx.table, scope),
    })

/** Аналог `injectCellHooks` для слота/колонки заголовка (`PluginHeaderProps`). */
export const injectHeaderHooks =
  <THooks>(
    Component: (props: PluginHeaderProps<THooks>) => ReactNode,
    scope: string,
  ) =>
  (ctx: HeaderComponentProps): ReactNode =>
    createElement(Component, {
      ...ctx,
      hooks: readPluginHooks<THooks>(ctx.table, scope),
    })

/**
 * Пропсы компонента ячейки плагина с ЛОКАЛЬНЫМ состоянием: hooks-слайс + пара
 * `state: [value, setter]`. `TState` выводится из декларации `state` плагина;
 * состояние приватно (читается пропсом, а не общим `getState`).
 */
export interface PluginCellStateProps<
  THooks,
  TState,
> extends PluginCellProps<THooks> {
  state: [TState, (next: TState) => void]
}

/**
 * Пропсы компонента-владельца ячейки (`cellSlot`): к hooks + локальному `state`
 * добавляется `content` — собственный рендер ячейки. Владелец рантайм решает,
 * показать его (`{content}`) или заместить своим UI (напр. инлайн-редактором).
 */
export interface PluginCellOwnerProps<
  THooks,
  TState,
> extends PluginCellStateProps<THooks, TState> {
  content: ReactNode
}

/** Имя опции-updater'а слайса (конвенция v9: `on<Key>Change`). */
const stateChangeOption = (id: string): string =>
  `on${id.charAt(0).toUpperCase()}${id.slice(1)}Change`

type WritableAtom = { set: (v: unknown) => void }

/**
 * Запись значения в локальный слайс плагина: через штатный updater-опцию
 * `on<Key>Change` (makeStateUpdater), с фолбэком на запись атома тем же путём, что и
 * makeStateUpdater: внешний `options.atoms[id]`, иначе `baseAtoms[id]` (`table.atoms`
 * в v9 — производные, только для чтения).
 */
export const setPluginState = (
  table: unknown,
  id: string,
  next: unknown,
): void => {
  const t = table as {
    options?: Record<string, unknown> & {
      atoms?: Record<string, WritableAtom | undefined>
    }
    baseAtoms?: Record<string, WritableAtom | undefined>
  }
  const updater = t.options?.[stateChangeOption(id)]
  if (typeof updater === 'function') {
    updater(next)
    return
  }
  ;(t.options?.atoms?.[id] ?? t.baseAtoms?.[id])?.set(next)
}

/**
 * Обёртка колонки/слота для плагина с локальным состоянием: реактивно читает слайс
 * `id` (`useSlice`) и подмешивает `state: [value, setter]` + hooks в компонент.
 * Рендерится как компонент (RenderSlot/FlexRender → createElement), поэтому вызов
 * хука внутри легален.
 */
export const injectCellState =
  <THooks, TState>(
    Component: (props: PluginCellStateProps<THooks, TState>) => ReactNode,
    id: string,
  ) =>
  (ctx: CellComponentProps): ReactNode => {
    const value = useSlice(ctx.table as never, id as never) as TState
    const setter = (next: TState) => setPluginState(ctx.table, id, next)
    return createElement(Component, {
      ...ctx,
      hooks: readPluginHooks<THooks>(ctx.table, id),
      state: [value, setter],
    })
  }

/**
 * Обёртка слота-владельца ячейки (`cellSlot`) с локальным состоянием: как
 * `injectCellState`, но прокидывает ещё `content` (собственный рендер ячейки,
 * приходит от `RenderCellSlot`) в компонент типизированным пропсом.
 */
export const injectCellOwner =
  <THooks, TState>(
    Component: (props: PluginCellOwnerProps<THooks, TState>) => ReactNode,
    id: string,
  ) =>
  // Тип параметра — стоковый CellComponentProps (совместимость с сигнатурой слота);
  // `content` кладёт RenderCellSlot в рантайме (для cellSlot он всегда есть).
  (ctx: CellComponentProps): ReactNode => {
    const value = useSlice(ctx.table as never, id as never) as TState
    const setter = (next: TState) => setPluginState(ctx.table, id, next)
    return createElement(Component, {
      ...ctx,
      content: (ctx as { content?: ReactNode }).content,
      hooks: readPluginHooks<THooks>(ctx.table, id),
      state: [value, setter],
    })
  }

/**
 * Минимальная v9-фича локального состояния плагина: seed слайса под ключом `id` из
 * дефолта `getDefault()`. Store сам создаёт атом `table.atoms[id]`; чтение/запись —
 * через инъектированный пропс `state` (`injectCellState`), не через общий `getState`.
 */
const makeLocalStateFeature = (
  id: string,
  getDefault: () => unknown,
): TableFeature => ({
  getInitialState: state => ({ [id]: getDefault(), ...state }),
  getDefaultTableOptions: table => ({
    [stateChangeOption(id)]: makeStateUpdater(id as never, table),
  }),
})

const stripUndefined = <T extends object>(slice: T): Partial<T> => {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(slice)) {
    if (value !== undefined) {
      out[key] = value
    }
  }
  return out as Partial<T>
}

interface DefinePluginConfig<
  TOptions extends { enabled?: boolean },
  TFeatures extends object,
  TResolved extends Record<string, unknown>,
  THooks extends object,
  TState,
> {
  /** Идентификатор плагина; служит и ключом scope для hook-слайса и локального state. */
  id: string
  /** Фрагмент стоковых фич TanStack v9 (→ `tableFeatures`). */
  features?: TFeatures
  /** Резолвнутые опции таблицы (→ опции useTable). */
  options?: (opts: TOptions) => TResolved
  /** Живой слайс бизнес-колбэков; undefined-ключи отбрасываются. */
  hooks?: (opts: TOptions) => THooks
  /**
   * Дефолт ЛОКАЛЬНОГО состояния плагина (значение слайса). definePlugin генерирует
   * v9-фичу, seed'ящую слайс под ключом `id`; компонент читает/пишет его через пропс
   * `state: [value, setter]` (`injectCellState`), приватно от общего `getState`.
   */
  state?: () => TState
  /** Сервисная колонка плагина. */
  column?: ServiceColumn
  /** Декларативные слоты плагина (UI-компоненты в местах рендера). */
  slots?: PluginSlot[]
  /** Декларативные действия слота (инлайн-кнопка / пункт кебаб-меню). */
  slotActions?: SlotAction[]
  /** Декларативные пункты контекстного меню (ADR 0030). */
  contextMenuActions?: ContextMenuAction[]
  /** Декларация плагина-меню (зависит от opts): на какие слоты распространить кебаб. */
  actionMenu?: (opts: TOptions) => ActionMenuDeclaration
  /**
   * Императивный сетап после создания таблицы (фабрика от opts → эффект над table;
   * может вернуть cleanup). Через opts сетап видит аргументы фабрики.
   */
  setup?: (opts: TOptions) => (table: unknown) => void | (() => void)
}

/**
 * Каррированная форма: `TOptions` задаётся ОДИН раз явным дженериком
 * (`definePlugin<Opts>()(...)`), после чего `o` в `options`/`hooks` выводится как
 * `TOptions` без повторной аннотации, а `TFeatures`/`TResolved`/`THooks` выводятся из
 * конфига (DP12). TS не выводит общий входной тип из нескольких соседних полей —
 * отсюда явный дженерик первым шагом.
 */
export const definePlugin =
  <TOptions extends { enabled?: boolean }>() =>
  <
    TFeatures extends object = object,
    TResolved extends Record<string, unknown> = Record<string, unknown>,
    THooks extends object = Record<never, never>,
    TState = never,
  >(
    config: DefinePluginConfig<TOptions, TFeatures, TResolved, THooks, TState>,
  ) => {
    return (
      opts: TOptions = {} as TOptions,
    ): TesseraFeatureEntry<TFeatures> => {
      const entry: TesseraFeatureEntry<TFeatures> = {
        id: config.id,
        enabled: opts.enabled,
      }

      // features = стоковый фрагмент + (если объявлен state) сгенерированная фича
      // локального состояния, seed'ящая слайс под ключом id.
      if (config.features || config.state) {
        const merged: Record<string, unknown> = { ...config.features }
        if (config.state) {
          merged[`${config.id}StateFeature`] = makeLocalStateFeature(
            config.id,
            config.state,
          )
        }
        entry.features = merged as TFeatures
      }
      if (config.options) {
        entry.options = config.options(opts)
      }
      if (config.hooks) {
        entry.hooks = { [config.id]: stripUndefined(config.hooks(opts)) }
      }
      if (config.column) {
        entry.column = config.column
      }
      if (config.slots) {
        entry.slots = config.slots
      }
      if (config.slotActions) {
        entry.slotActions = config.slotActions
      }
      if (config.contextMenuActions) {
        entry.contextMenuActions = config.contextMenuActions
      }
      if (config.actionMenu) {
        entry.actionMenu = config.actionMenu(opts)
      }
      if (config.setup) {
        entry.setup = config.setup(opts)
      }

      return entry
    }
  }

export type { CellComponentProps, HeaderComponentProps }
