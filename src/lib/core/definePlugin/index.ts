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

/** Service column components with the plugin's channels mixed in — for `make`. */
export interface ServiceColumnParts {
  cell?: (ctx: CellComponentProps) => ReactNode
  header?: (ctx: HeaderComponentProps) => ReactNode
}

/**
 * A service column in `definePlugin`: `cell`/`header` are typed by the plugin's `hooks` and
 * receive them without a scope string (ADR 0028, DP19, DP20).
 */
export interface PluginServiceColumn<THooks, TOptions = never> extends Omit<
  ServiceColumn,
  'make' | 'pluginId'
> {
  cell?: (props: PluginCellProps<THooks>) => ReactNode
  header?: (props: PluginHeaderProps<THooks>) => ReactNode
  make: (parts: ServiceColumnParts) => ColumnDef<any, any, any>
  /**
   * When the column is needed (ADR 0050); without the field — always. The application
   * overrides it with the factory option `column: 'always'`.
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

export interface DefinePluginConfig<
  TOptions extends { enabled?: boolean },
  TFeatures extends object,
  TResolved extends Record<string, unknown>,
  THooks extends object,
  TState,
> {
  /** Plugin id; also the scope key for the hooks slice and local state. */
  id: string
  /** A fragment of TanStack v9 stock features (→ `tableFeatures`). */
  features?: TFeatures
  /**
   * Resolved table options (→ `useTable` options). Live (ADR 0039): the core rebuilds them
   * when argument values change; functions from arguments arrive stable.
   */
  options?: (opts: TOptions) => TResolved
  /**
   * Arguments fixed for the table's lifetime (ADR 0039): the value is taken at mount, a
   * change later is not applied and triggers a dev warning.
   */
  lifetime?: readonly Extract<keyof TOptions, string>[]
  /**
   * Function arguments that affect rendering (predicates): a new function reference
   * re-renders cells (ADR 0039). `on*` callbacks are not included.
   */
  refreshOn?: readonly Extract<keyof TOptions, string>[]
  /** Live slice of business callbacks; `undefined` keys are dropped. */
  hooks?: (opts: TOptions) => THooks
  /**
   * Narrows state slices by arguments (ADR 0039, §4): "stored → allowed" per slice key; the
   * core gives TanStack the effective value without rewriting the stored one. A result with the
   * same fields from the same value is replaced by the previous object (ADR 0171, §1).
   */
  narrow?: (opts: TOptions) => Record<string, NarrowState> | undefined
  /**
   * Default of the plugin's LOCAL state (the slice value). `definePlugin` generates a v9
   * feature that seeds the slice under `plugin:<id>`; a slot with `state: true` reads and
   * writes it through the `state: [value, setter]` prop.
   */
  state?: () => TState
  /**
   * Name of the local slice in arguments (ADR 0171, §4): the plugin accepts `<name>`,
   * `on<Name>Change` and `initial<Name>`, like TanStack slices. With `<name>` the application
   * owns the slice: a change from inside goes to the callback and shows with the new value.
   */
  stateName?: Extract<keyof TOptions, string>
  /**
   * TanStack slices the plugin accepts as arguments `<slice>`, `on<Slice>Change` and
   * `initial<Slice>` (ADR 0120, §4).
   */
  slices?: readonly Extract<keyof TOptions, string>[]
  /**
   * The model an interface plugin enables (ADR 0120, §3): its factory and the arguments the
   * interface passes to it; `enabled` is always passed.
   */
  model?: {
    plugin: (opts?: any) => TesseraFeatureEntry
    keys: readonly Extract<keyof TOptions, string>[]
  }
  /** The plugin's service column; `cell`/`header` receive its `hooks` (DP19). */
  column?: PluginServiceColumn<THooks, TOptions>
  /**
   * The plugin's declarative slots; a function when the slot set depends on factory arguments.
   * The component gets the plugin's channels (`hooks`, local `state`) typed from the
   * declarations of the same call: a mismatch is a compile error (DP7).
   */
  slots?:
    | PluginSlotDecl<THooks, NoInfer<TState>>[]
    | ((opts: TOptions) => PluginSlotDecl<THooks, NoInfer<TState>>[])
  /** Declarative slot actions (an inline button or a kebab-menu item). */
  slotActions?: SlotAction[]
  /** The plugin's empty-table stubs — registry entries (ADR 0123, ES14). */
  stubs?: StubEntry[]
  /** The plugin's draft kinds: how to apply, discard and label them (ADR 0178, §1). */
  draftKinds?: DraftKind[]
  /**
   * The plugin's label sets (ADR 0182, §8): `defineLabels` with the plugin id — table dictionary
   * keys `<id>.<key>` that the application translates through `localization`; and label sets of
   * shared modules the plugin renders.
   */
  labels?: readonly LabelSet[]
  /**
   * The plugin's actions in the catalog (ADR 0182, §1): name → label; one action name for the
   * menu, the failure log, the unsaved-changes panel, announcements and the debug-action channel.
   */
  actions?: ActionLabels
  /** Declarative context-menu items (ADR 0030). */
  contextMenuActions?: ContextMenuAction[]
  /** Keyboard actions on cells (ADR 0021). */
  keyboardActions?: KeyboardAction[]
  /** What the plugin does to the data per column and how to remove it (ADR 0204, §2). */
  columnTransforms?: ColumnTransform[]
  /** "View settings" sections: a short value, levels or a custom panel (ADR 0215, §5). */
  viewSettingsSections?: ViewSettingsSection[]
  /** A menu plugin's declaration (depends on options): which slots get the kebab menu. */
  actionMenu?: (opts: TOptions) => ActionMenuDeclaration
  /** Inert reason for `table.getPluginDiagnostics()`; `undefined` means the plugin works. */
  diagnose?: PluginDiagnose
  /**
   * Imperative setup after the table is created (a factory from options → an effect on the
   * table; may return a cleanup). Through options the setup sees the factory arguments.
   */
  setup?: (opts: TOptions) => (table: unknown) => void | (() => void)
  /**
   * Reconciles plugin state with the table after every render — also for a disabled plugin
   * (ADR 0040, §2). Must be cheap when there is nothing to do.
   */
  reconcile?: (table: unknown, context: PluginReconcileContext) => void
  /**
   * Contribution to the grid body (ADR 0173): cell and row attributes and style variables
   * selected from state, root attributes, events and hook, navigation keys. Names are only
   * `data-<id>-*`, `aria-*` and `--<id>-*`; an exception disables the contribution.
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
 * The second step of `definePlugin`. Two signatures, so the slot component's hooks type comes
 * from the plugin: without `hooks` it is empty (a component expecting hooks is an error), with
 * `hooks` it is inferred from their declaration and from the components, and a mismatch fails
 * (DP7).
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
