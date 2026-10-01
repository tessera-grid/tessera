/**
 * Каналы плагина в компонент: `hooks` — пропсом через
 * `injectCellHooks`/`injectHeaderHooks`; локальный `state` — пропсом
 * `[value, setter]` через `injectCellState`/`injectCellOwner`. Компонент-facing
 * конфиг (напр. предикат `canEdit`) кладут в `hooks` (живой слайс).
 */
import { createElement, type ReactNode } from 'react'

import type {
  CellComponentProps,
  HeaderComponentProps,
  RegisterSlotParams,
  StatusBarComponentProps,
  ToolbarComponentProps,
} from '../createSlots'
import { useSlice } from '../reactivity'

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

/** Ключ локального слайса плагина в store: с пространством имён, чтобы не совпасть со стоковым срезом (DP13). */
export const pluginStateKey = (id: string): string => `plugin:${id}`

/** Имя опции-updater'а слайса (конвенция v9: `on<Key>Change`). */
export const stateChangeOption = (id: string): string =>
  `on${id.charAt(0).toUpperCase()}${id.slice(1)}Change`

type WritableAtom = { set: (v: unknown) => void }

/**
 * Запись значения в локальный слайс плагина: через штатный updater-опцию
 * `on<Key>Change` (makeStateUpdater), с фолбэком на запись атома тем же путём, что и
 * makeStateUpdater: внешний `options.atoms[key]`, иначе `baseAtoms[key]` (`table.atoms`
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
  const key = pluginStateKey(id)
  const updater = t.options?.[stateChangeOption(key)]
  if (typeof updater === 'function') {
    updater(next)
    return
  }
  ;(t.options?.atoms?.[key] ?? t.baseAtoms?.[key])?.set(next)
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
    const value = useSlice(
      ctx.table as never,
      pluginStateKey(id) as never,
    ) as TState
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
    const value = useSlice(
      ctx.table as never,
      pluginStateKey(id) as never,
    ) as TState
    const setter = (next: TState) => setPluginState(ctx.table, id, next)
    return createElement(Component, {
      ...ctx,
      content: (ctx as { content?: ReactNode }).content,
      hooks: readPluginHooks<THooks>(ctx.table, id),
      state: [value, setter],
    })
  }

type SlotBase<TName extends string> = Omit<
  RegisterSlotParams<object>,
  'component' | 'render' | 'pluginId'
> & { slot: TName }

/**
 * Слот одного вида. По умолчанию компонент получает hook-слайс плагина; пару
 * локального состояния `[value, setter]` — только слот с `state: true`: такой
 * компонент подписан на весь срез и перерисовывается при каждом его изменении.
 */
type SlotDeclOf<TName extends string, TContext, THooks, TState> =
  | (SlotBase<TName> & {
      state?: false
      component?: (props: TContext & { hooks: THooks }) => ReactNode
    })
  | ([TState] extends [never]
      ? never
      : SlotBase<TName> & {
          state: true
          component?: (
            props: TContext & {
              hooks: THooks
              state: [TState, (next: TState) => void]
            },
          ) => ReactNode
        })

/**
 * Слот в `definePlugin`: компонент получает контекст своего слота и каналы плагина,
 * типы которых выведены из `hooks`/`state` того же вызова. Компонент, ждущий другой
 * тип канала, не присваивается — ошибка компиляции в вызове `definePlugin` (DP7).
 */
export type PluginSlotDecl<THooks = Record<never, never>, TState = never> =
  | SlotDeclOf<
      'leftHeaderSlot' | 'rightHeaderSlot',
      HeaderComponentProps,
      THooks,
      TState
    >
  | SlotDeclOf<
      'leftCellSlot' | 'rightCellSlot' | 'actionRowSlot',
      CellComponentProps,
      THooks,
      TState
    >
  | SlotDeclOf<
      'cellSlot',
      CellComponentProps & { content: ReactNode },
      THooks,
      TState
    >
  | SlotDeclOf<'toolbarSlot', ToolbarComponentProps, THooks, TState>
  | SlotDeclOf<'statusBarSlot', StatusBarComponentProps, THooks, TState>

type SlotContext = { table: unknown }
type SlotComponent = (props: never) => ReactNode

// Обёртка на пару «компонент — плагин» одна: иначе пересборка настройки при смене
// аргументов давала бы новый тип компонента и перемонтировала слот.
const wrappers = new WeakMap<SlotComponent, Map<string, SlotComponent>>()

const hooksOnly =
  (Component: SlotComponent, id: string) => (ctx: SlotContext) =>
    createElement(Component as (props: Record<string, unknown>) => ReactNode, {
      ...ctx,
      hooks: readPluginHooks(ctx.table as { getHooks: () => unknown }, id),
    })

const hooksAndState =
  (Component: SlotComponent, id: string) => (ctx: SlotContext) => {
    const value = useSlice(ctx.table as never, pluginStateKey(id) as never)
    return createElement(
      Component as (props: Record<string, unknown>) => ReactNode,
      {
        ...ctx,
        hooks: readPluginHooks(ctx.table as { getHooks: () => unknown }, id),
        state: [value, (next: unknown) => setPluginState(ctx.table, id, next)],
      },
    )
  }

/** Компонент слота с каналами плагина `id` (обёртка кэшируется). */
export const withPluginChannels = (
  Component: SlotComponent,
  id: string,
  withState: boolean,
): SlotComponent => {
  const key = `${id}|${withState}`
  const byPlugin = wrappers.get(Component) ?? new Map<string, SlotComponent>()
  wrappers.set(Component, byPlugin)
  const cached = byPlugin.get(key)
  if (cached) {
    return cached
  }
  const wrapped = (withState ? hooksAndState : hooksOnly)(Component, id)
  byPlugin.set(key, wrapped as SlotComponent)
  return wrapped as SlotComponent
}
