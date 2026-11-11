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
  PluginStateSlice,
  TesseraFeatureEntry,
} from '../features'
import type {
  ActionMenuDeclaration,
  ContextMenuAction,
  SlotAction,
} from '../headerActions'
import type { KeyboardAction } from '../keyboardActions'
import type { ColumnTransform } from '../columnTransforms'
import type { ViewSettingsSection } from '../viewSettings'
import type { PluginDiagnose } from '../pluginDiagnostics'
import type { NarrowState } from '../effectiveState'
import type { StubEntry } from '../stubs'
import type { DraftKind } from '../drafts/drafts'
import type { LabelSet } from '../localization'
import type { ActionLabels } from '../actions'
import {
  type ServiceColumnMode,
  type ServicePresence,
  presenceNarrow,
} from '../servicePresence'
import { argsKeyOf } from '../pluginArgs'
import { authorBodyOf, type PluginBody } from '../bodyContributions'
import {
  pluginStateKey,
  stateChangeOption,
  withPluginChannels,
  type PluginCellProps,
  type PluginHeaderProps,
  type PluginSlotDecl,
} from './channels'

/** Сужение среза — значение поля `narrow`; его пишут плагины. */
export type { NarrowState }

export {
  readPluginHooks,
  setPluginState,
  pluginStateKey,
  type PluginCellProps,
  type PluginHeaderProps,
  type PluginCellStateProps,
  type PluginCellOwnerProps,
  type PluginSlotDecl,
  savedSliceOf,
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
    getDefaultTableOptions: table => ({
      [stateChangeOption(key)]: makeStateUpdater(key as never, table),
    }),
  }
}

const withoutKeys = (value: object, keys: readonly string[]): object =>
  Object.fromEntries(
    Object.entries(value).filter(([name]) => !keys.includes(name)),
  )

const capitalize = (key: string) => key.charAt(0).toUpperCase() + key.slice(1)

const stateSlicesOf = (
  keys: readonly string[],
  opts: Record<string, unknown>,
): PluginStateSlice[] =>
  keys.map(key => ({
    key,
    value: opts[key],
    onChange: opts[`on${capitalize(key)}Change`] as
      ((next: unknown) => void) | undefined,
    initial: opts[`initial${capitalize(key)}`],
  }))

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
export interface PluginServiceColumn<THooks, TOptions = never> extends Omit<
  ServiceColumn,
  'make' | 'pluginId'
> {
  cell?: (props: PluginCellProps<THooks>) => ReactNode
  header?: (props: PluginHeaderProps<THooks>) => ReactNode
  make: (parts: ServiceColumnParts) => ColumnDef<any, any, any>
  /**
   * Когда колонка нужна (ADR 0050); без поля — всегда. Приложение переопределяет
   * опцией фабрики `column: 'always'`.
   */
  presence?: ServicePresence<TOptions>
}

const keepVisibility: NarrowState = value => value

const toServiceColumn = (
  {
    cell,
    header,
    make,
    presence: _presence,
    ...column
  }: PluginServiceColumn<unknown, unknown>,
  id: string,
): ServiceColumn => {
  const parts: ServiceColumnParts = {
    cell: cell && (withPluginChannels(cell as never, id, false) as never),
    header: header && (withPluginChannels(header as never, id, false) as never),
  }
  let made: ColumnDef<any, any, any> | undefined
  return {
    ...column,
    make: () => (made ??= make(parts)),
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
   * по ключу среза; ядро отдаёт TanStack эффективное, не переписывая сохранённое. Итог
   * с теми же полями от того же значения ядро заменяет прежним объектом (ADR 0171, §1).
   */
  narrow?: (opts: TOptions) => Record<string, NarrowState> | undefined
  /**
   * Дефолт ЛОКАЛЬНОГО состояния плагина (значение слайса). definePlugin генерирует
   * v9-фичу, seed'ящую слайс под ключом `plugin:<id>`; слот с `state: true` читает и
   * пишет его пропсом `state: [value, setter]`.
   */
  state?: () => TState
  /**
   * Имя локального среза в аргументах (ADR 0171, §4): плагин принимает `<имя>`,
   * `on<Имя>Change` и `initial<Имя>`, как срезы TanStack. С `<имя>` срезом владеет
   * приложение: изменение изнутри приходит колбэку, видно — с новым значением.
   */
  stateName?: Extract<keyof TOptions, string>
  /**
   * Срезы TanStack, которые плагин принимает аргументами `<срез>`, `on<Срез>Change` и
   * `initial<Срез>` (ADR 0120, §4).
   */
  slices?: readonly Extract<keyof TOptions, string>[]
  /**
   * Модель, которую включает плагин интерфейса (ADR 0120, §3): её фабрика и аргументы,
   * которые интерфейс ей передаёт; `enabled` передаётся всегда.
   */
  model?: {
    plugin: (opts?: any) => TesseraFeatureEntry
    keys: readonly Extract<keyof TOptions, string>[]
  }
  /** Сервисная колонка плагина; `cell`/`header` получают его `hooks` (DP19). */
  column?: PluginServiceColumn<THooks, TOptions>
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
  /** Заглушки пустой таблицы плагина — записи реестра (ADR 0123, ES14). */
  stubs?: StubEntry[]
  /** Виды черновиков плагина: как применить, отбросить и подписать (ADR 0178, §1). */
  draftKinds?: DraftKind[]
  /**
   * Наборы подписей плагина (ADR 0182, §8): `defineLabels` с id плагина — ключи словаря
   * таблицы `<id>.<ключ>`, приложение переводит их через `localization`; и наборы общих
   * модулей, которые плагин рисует.
   */
  labels?: readonly LabelSet[]
  /**
   * Действия плагина в справочнике (ADR 0182, §1): имя → подпись; одно имя действия для меню,
   * журнала, пульта, объявлений и канала действий.
   */
  actions?: ActionLabels
  /** Декларативные пункты контекстного меню (ADR 0030). */
  contextMenuActions?: ContextMenuAction[]
  /** Клавиатурные действия на ячейках (ADR 0021). */
  keyboardActions?: KeyboardAction[]
  /** Что плагин делает с данными по колонке и как это снять (ADR 0204, §2). */
  columnTransforms?: ColumnTransform[]
  /** Разделы «Настроек вида»: короткое значение, уровни или своя панель (ADR 0215, §5). */
  viewSettingsSections?: ViewSettingsSection[]
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
  /**
   * Вклад в тело грида (ADR 0173): атрибуты и переменные стиля ячейки и строки по выбору
   * из состояния, атрибуты, события и хук корня, клавиши навигации. Имена — только
   * `data-<id>-*`, `aria-*` и `--<id>-*`; исключение выключает вклад.
   */
  body?: (opts: TOptions) => PluginBody
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
      toServiceColumn(
        config.column as PluginServiceColumn<unknown, unknown>,
        config.id,
      )
    const presence = config.column?.presence
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
        if (config.body) {
          out.body = authorBodyOf(config.id, config.body(args))
        }
        const narrow = { ...config.narrow?.(args) }
        // Срез остаётся под сужением и в режиме 'always': иначе TanStack держал бы
        // последнее суженное значение.
        if (presence) {
          narrow.columnVisibility =
            args.enabled === false ||
            (args as { column?: ServiceColumnMode }).column === 'always'
              ? keepVisibility
              : presenceNarrow(config.column!.id, presence, args)
        }
        if (Object.keys(narrow).length > 0) {
          out.narrow = narrow
        }
        return out
      }
      Object.assign(entry, configure(opts))
      entry.args = opts
      if (config.model) {
        const options = opts as Record<string, unknown>
        entry.model = config.model.plugin({
          ...Object.fromEntries(
            config.model.keys
              .filter(key => options[key] !== undefined)
              .map(key => [key, options[key]]),
          ),
          enabled: opts.enabled,
        })
      }
      // Значение внешнего состояния — не настройка: его смена не пересобирает плагин (DP18),
      // в том числе срез модели, заданный аргументом интерфейса.
      entry.argsKey = argsKeyOf(
        withoutKeys(opts, [
          ...(config.stateName ? [config.stateName] : []),
          ...(config.slices ?? []),
          ...(entry.model?.stateSlices ?? []).map(slice => slice.key),
        ]),
      )
      if (config.slices) {
        entry.stateSlices = stateSlicesOf(
          config.slices,
          opts as Record<string, unknown>,
        )
      }
      if (config.stateName) {
        const [slice] = stateSlicesOf(
          [config.stateName],
          opts as Record<string, unknown>,
        )
        entry.stateSlices = [
          ...(entry.stateSlices ?? []),
          { ...slice!, key: pluginStateKey(config.id) },
        ]
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
      if (config.stubs) {
        entry.stubs = config.stubs
      }
      if (config.draftKinds) {
        entry.draftKinds = config.draftKinds
      }
      if (config.labels) {
        entry.labels = config.labels
      }
      if (config.actions) {
        entry.actions = config.actions
      }
      if (config.contextMenuActions) {
        entry.contextMenuActions = config.contextMenuActions
      }
      if (config.keyboardActions) {
        entry.keyboardActions = config.keyboardActions
      }
      if (config.columnTransforms) {
        entry.columnTransforms = config.columnTransforms
      }
      if (config.viewSettingsSections) {
        entry.viewSettingsSections = config.viewSettingsSections
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
