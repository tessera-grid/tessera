/**
 * definePlugin — авторская поверхность плагина поверх записи `TesseraFeatureEntry`
 * (ADR 0028). Принимает декларации по полям, возвращает фабрику
 * `(opts?) => TesseraFeatureEntry`. Прячет раскладку: `options` → опции таблицы,
 * `hooks` → живой слайс записи под ключом `id` (undefined-ключи отброшены),
 * `features` → фрагмент фич v9, `column`/`slots`/`setup` — как есть.
 *
 * Границы прототипа: инъекция локального канала в компоненты реализована для
 * `hooks` (пропс через `readPluginHooks`); каналы `state`/`options` в
 * `PluginCellProps` — следующий инкремент (нужны плагину с локальным состоянием,
 * у `rowSelection` их нет).
 */
import { createElement, type ReactNode } from 'react'

import type { ServiceColumn } from './createColumns'
import type {
  CellComponentProps,
  HeaderComponentProps,
  PluginSlot,
} from './createSlots'
import type { TesseraFeatureEntry } from './features'
import type { ActionMenuDeclaration, SlotAction } from './headerActions'

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
> {
  /** Идентификатор плагина; служит и ключом scope для hook-слайса. */
  id: string
  /** Фрагмент стоковых фич TanStack v9 (→ `tableFeatures`). */
  features?: TFeatures
  /** Резолвнутые опции таблицы (→ опции useTable). */
  options?: (opts: TOptions) => TResolved
  /** Живой слайс бизнес-колбэков; undefined-ключи отбрасываются. */
  hooks?: (opts: TOptions) => THooks
  /** Сервисная колонка плагина. */
  column?: ServiceColumn
  /** Декларативные слоты плагина (UI-компоненты в местах рендера). */
  slots?: PluginSlot[]
  /** Декларативные действия слота (инлайн-кнопка / пункт кебаб-меню). */
  slotActions?: SlotAction[]
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
  >(
    config: DefinePluginConfig<TOptions, TFeatures, TResolved, THooks>,
  ) => {
    return (
      opts: TOptions = {} as TOptions,
    ): TesseraFeatureEntry<TFeatures> => {
      const entry: TesseraFeatureEntry<TFeatures> = {
        id: config.id,
        enabled: opts.enabled,
      }

      if (config.features) {
        entry.features = config.features
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
