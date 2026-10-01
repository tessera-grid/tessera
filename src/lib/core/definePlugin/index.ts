/**
 * definePlugin — авторская поверхность плагина поверх записи `TesseraFeatureEntry`.
 * Принимает декларации по полям, возвращает фабрику
 * `(opts?) => TesseraFeatureEntry`. Прячет раскладку: `options` → опции таблицы,
 * `hooks` → живой слайс записи под ключом `id` (undefined-ключи отброшены),
 * `features` → фрагмент фич v9, `state` → сгенерированная v9-фича локального слайса
 * под ключом `plugin:<id>`, `column`/`slots`/`setup` — как есть. Каналы в компонент — `./channels`.
 */
import type { ReactNode } from 'react'
import { makeStateUpdater } from '@tanstack/react-table'

import type { ColumnDef, TableFeature } from '../../types'
import type { ServiceColumn } from '../createColumns'
import type {
  CellComponentProps,
  HeaderComponentProps,
  PluginSlot,
} from '../createSlots'
import type {
  PluginConfiguration,
  PluginReconcileContext,
  TesseraFeatureEntry,
} from '../features'
import type {
  ActionMenuDeclaration,
  ContextMenuAction,
  SlotAction,
} from '../headerActions'
import type { KeyboardAction } from '../keyboardActions'
import type { PluginDiagnose } from '../pluginDiagnostics'
import type { NarrowState } from '../effectiveState'
import { argsKeyOf } from '../pluginArgs'
import {
  pluginStateKey,
  stateChangeOption,
  withPluginChannels,
  type PluginCellProps,
  type PluginHeaderProps,
  type PluginSlotDecl,
} from './channels'

export {
  readPluginHooks,
  setPluginState,
  pluginStateKey,
  type PluginCellProps,
  type PluginHeaderProps,
  type PluginCellStateProps,
  type PluginCellOwnerProps,
  type PluginSlotDecl,
} from './channels'

/**
 * Минимальная v9-фича локального состояния плагина: seed слайса под ключом
 * `pluginStateKey(id)` из дефолта `getDefault()`. Store сам создаёт атом; чтение/запись —
 * через пропс `state` слота с `state: true`, не через общий `getState`.
 */
const makeLocalStateFeature = (
  id: string,
  getDefault: () => unknown,
): TableFeature => {
  const key = pluginStateKey(id)
  return {
    getInitialState: state => ({ [key]: getDefault(), ...state }),
    getDefaultTableOptions: table => {
      const write = makeStateUpdater(key as never, table)
      const t = table as unknown as {
        atoms: Record<string, { get: () => unknown } | undefined>
        options: {
          pluginStateListeners?: Record<string, (next: unknown) => void>
        }
      }
      return {
        // Каждое изменение среза изнутри — в `onChange` внешнего состояния (DP17).
        [stateChangeOption(key)]: (updater: never) => {
          const prev = t.atoms[key]?.get()
          write(updater)
          const next = t.atoms[key]?.get()
          if (next !== prev) {
            t.options.pluginStateListeners?.[key]?.(next)
          }
        },
      }
    },
  }
}

const withoutKey = (value: object, key: string): object =>
  Object.fromEntries(Object.entries(value).filter(([name]) => name !== key))

const stripUndefined = <T extends object>(slice: T): Partial<T> => {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(slice)) {
    if (value !== undefined) {
      out[key] = value
    }
  }
  return out as Partial<T>
}

/** Компоненты сервисной колонки с подмешанными каналами плагина — для `make`. */
export interface ServiceColumnParts {
  cell?: (ctx: CellComponentProps) => ReactNode
  header?: (ctx: HeaderComponentProps) => ReactNode
}

/**
 * Сервисная колонка в `definePlugin`: `cell`/`header` типизированы по `hooks`
 * плагина и получают их без scope-строки (ADR 0028, DP19, DP20).
 */
export interface PluginServiceColumn<THooks> extends Omit<
  ServiceColumn,
  'make' | 'pluginId'
> {
  cell?: (props: PluginCellProps<THooks>) => ReactNode
  header?: (props: PluginHeaderProps<THooks>) => ReactNode
  make: (depth: number, parts: ServiceColumnParts) => ColumnDef<any, any, any>
}

const toServiceColumn = (
  { cell, header, make, ...column }: PluginServiceColumn<unknown>,
  id: string,
): ServiceColumn => {
  const parts: ServiceColumnParts = {
    cell: cell && (withPluginChannels(cell as never, id, false) as never),
    header: header && (withPluginChannels(header as never, id, false) as never),
  }
  const byDepth = new Map<number, ColumnDef<any, any, any>>()
  return {
    ...column,
    make: depth => {
      const made = byDepth.get(depth) ?? make(depth, parts)
      byDepth.set(depth, made)
      return made
    },
  }
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
  /**
   * Резолвнутые опции таблицы (→ опции useTable). Живые (ADR 0039): ядро пересобирает
   * их при смене значения аргументов, функции из аргументов приходят стабильными.
   */
  options?: (opts: TOptions) => TResolved
  /**
   * Аргументы-договоры на время жизни таблицы (ADR 0039): значение берётся с момента
   * монтирования, смена на лету не применяется и сопровождается dev-warn.
   */
  lifetime?: readonly Extract<keyof TOptions, string>[]
  /**
   * Аргументы-функции, влияющие на отрисовку (предикаты): новая ссылка на функцию
   * перерисовывает ячейки (ADR 0039). Колбэки `on*` сюда не входят.
   */
  refreshOn?: readonly Extract<keyof TOptions, string>[]
  /** Живой слайс бизнес-колбэков; undefined-ключи отбрасываются. */
  hooks?: (opts: TOptions) => THooks
  /**
   * Сужение срезов состояния аргументами (ADR 0039, §4): «сохранённое → допустимое»
   * по ключу среза; ядро отдаёт TanStack эффективное, не переписывая сохранённое.
   */
  narrow?: (opts: TOptions) => Record<string, NarrowState> | undefined
  /**
   * Дефолт ЛОКАЛЬНОГО состояния плагина (значение слайса). definePlugin генерирует
   * v9-фичу, seed'ящую слайс под ключом `plugin:<id>`; слот с `state: true` читает и
   * пишет его пропсом `state: [value, setter]`.
   */
  state?: () => TState
  /**
   * Пара опций внешнего локального состояния (ADR 0028, DP8): `value` — значение,
   * которое приложение задаёт срезу, `onChange` — колбэк каждого изменения среза.
   */
  controlled?: {
    value: Extract<keyof TOptions, string>
    onChange?: Extract<keyof TOptions, string>
  }
  /** Сервисная колонка плагина; `cell`/`header` получают его `hooks` (DP19). */
  column?: PluginServiceColumn<THooks>
  /**
   * Декларативные слоты плагина; функция — набор слотов зависит от аргументов фабрики.
   * Компонент получает каналы плагина (`hooks`, локальный `state`) с типами из
   * деклараций этого же вызова: расхождение — ошибка компиляции (DP7).
   */
  slots?:
    | PluginSlotDecl<THooks, NoInfer<TState>>[]
    | ((opts: TOptions) => PluginSlotDecl<THooks, NoInfer<TState>>[])
  /** Декларативные действия слота (инлайн-кнопка / пункт кебаб-меню). */
  slotActions?: SlotAction[]
  /** Декларативные пункты контекстного меню (ADR 0030). */
  contextMenuActions?: ContextMenuAction[]
  /** Клавиатурные действия на ячейках (ADR 0021). */
  keyboardActions?: KeyboardAction[]
  /** Декларация плагина-меню (зависит от opts): на какие слоты распространить кебаб. */
  actionMenu?: (opts: TOptions) => ActionMenuDeclaration
  /** Причина инертности для `table.getPluginDiagnostics()`; `undefined` — плагин работает. */
  diagnose?: PluginDiagnose
  /**
   * Императивный сетап после создания таблицы (фабрика от opts → эффект над table;
   * может вернуть cleanup). Через opts сетап видит аргументы фабрики.
   */
  setup?: (opts: TOptions) => (table: unknown) => void | (() => void)
  /**
   * Согласование состояния плагина с таблицей после каждого рендера — и у
   * выключенного плагина (ADR 0040, §2). Должно быть дешёвым без работы.
   */
  reconcile?: (table: unknown, context: PluginReconcileContext) => void
}

/**
 * Каррированная форма: `TOptions` задаётся ОДИН раз явным дженериком
 * (`definePlugin<Opts>()(...)`), после чего `o` в `options`/`hooks` выводится как
 * `TOptions` без повторной аннотации, а `TFeatures`/`TResolved`/`THooks` выводятся из
 * конфига (DP12). TS не выводит общий входной тип из нескольких соседних полей —
 * отсюда явный дженерик первым шагом.
 */
/**
 * Вторая ступень `definePlugin`. Две сигнатуры, чтобы тип хуков слот-компонента
 * шёл от плагина: без `hooks` он пустой (компонент, ждущий хуки, — ошибка), с
 * `hooks` — выведен из их декларации и из компонентов, и расхождение не сходится (DP7).
 */
export interface PluginFactoryBuilder<TOptions extends { enabled?: boolean }> {
  <
    TFeatures extends object = object,
    TResolved extends Record<string, unknown> = Record<string, unknown>,
    TState = never,
  >(
    config: DefinePluginConfig<
      TOptions,
      TFeatures,
      TResolved,
      Record<never, never>,
      TState
    > & { hooks?: undefined },
  ): (opts?: TOptions) => TesseraFeatureEntry<TFeatures>
  <
    TFeatures extends object = object,
    TResolved extends Record<string, unknown> = Record<string, unknown>,
    THooks extends object = Record<never, never>,
    TState = never,
  >(
    config: DefinePluginConfig<
      TOptions,
      TFeatures,
      TResolved,
      THooks,
      TState
    > & {
      hooks: (opts: TOptions) => THooks
    },
  ): (opts?: TOptions) => TesseraFeatureEntry<TFeatures>
}

export const definePlugin = <
  TOptions extends { enabled?: boolean },
>(): PluginFactoryBuilder<TOptions> =>
  (<
    TFeatures extends object = object,
    TResolved extends Record<string, unknown> = Record<string, unknown>,
    THooks extends object = Record<never, never>,
    TState = never,
  >(
    config: DefinePluginConfig<TOptions, TFeatures, TResolved, THooks, TState>,
  ) => {
    const column =
      config.column &&
      toServiceColumn(config.column as PluginServiceColumn<unknown>, config.id)
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
      // Поля, зависящие от аргументов: считаются сразу (запись самодостаточна) и
      // пересобираются ядром при смене значения аргументов (ADR 0039).
      const configure = (args: TOptions): PluginConfiguration => {
        const out: PluginConfiguration = {}
        if (config.options) {
          out.options = config.options(args)
        }
        if (config.slots) {
          const declared =
            typeof config.slots === 'function'
              ? config.slots(args)
              : config.slots
          out.slots = declared.map(({ state, ...slot }) =>
            slot.component
              ? {
                  ...slot,
                  component: withPluginChannels(
                    slot.component as never,
                    config.id,
                    state === true,
                  ),
                }
              : slot,
          ) as PluginSlot[]
        }
        if (config.actionMenu) {
          out.actionMenu = config.actionMenu(args)
        }
        if (config.setup) {
          out.setup = config.setup(args)
        }
        const narrow = config.narrow?.(args)
        if (narrow) {
          out.narrow = narrow
        }
        return out
      }
      Object.assign(entry, configure(opts))
      entry.args = opts
      // Значение внешнего состояния — не настройка: его смена не пересобирает плагин (DP18).
      entry.argsKey = argsKeyOf(
        config.controlled ? withoutKey(opts, config.controlled.value) : opts,
      )
      if (config.controlled) {
        const options = opts as Record<string, unknown>
        const onChange = config.controlled.onChange
        entry.controlledState = {
          key: pluginStateKey(config.id),
          value: options[config.controlled.value],
          onChange: onChange
            ? (options[onChange] as ((next: unknown) => void) | undefined)
            : undefined,
        }
      }
      entry.configure = configure as TesseraFeatureEntry['configure']
      if (config.lifetime) {
        entry.lifetimeArgs = config.lifetime
      }
      if (config.refreshOn) {
        entry.refreshArgs = config.refreshOn
      }

      if (config.hooks) {
        entry.hooks = { [config.id]: stripUndefined(config.hooks(opts)) }
      }
      if (column) {
        entry.column = column
      }
      if (config.slotActions) {
        entry.slotActions = config.slotActions
      }
      if (config.contextMenuActions) {
        entry.contextMenuActions = config.contextMenuActions
      }
      if (config.keyboardActions) {
        entry.keyboardActions = config.keyboardActions
      }
      if (config.diagnose) {
        entry.diagnose = config.diagnose
      }
      if (config.reconcile) {
        entry.reconcile = config.reconcile
      }

      return entry
    }
  }) as PluginFactoryBuilder<TOptions>

export type { CellComponentProps, HeaderComponentProps } from '../createSlots'
