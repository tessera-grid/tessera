/**
 * definePlugin — авторская поверхность плагина поверх записи `TesseraFeatureEntry`.
 * Принимает декларации по полям, возвращает фабрику
 * `(opts?) => TesseraFeatureEntry`. Прячет раскладку: `options` → опции таблицы,
 * `hooks` → живой слайс записи под ключом `id` (undefined-ключи отброшены),
 * `features` → фрагмент фич v9, `state` → сгенерированная v9-фича локального слайса
 * под ключом `plugin:<id>`, `column`/`slots`/`setup` — как есть. Каналы в компонент — `./channels`.
 */
import { makeStateUpdater } from '@tanstack/react-table'

import type { TableFeature } from '../../types'
import type { ServiceColumn } from '../createColumns'
import type { PluginSlot } from '../createSlots'
import type { PluginConfiguration, TesseraFeatureEntry } from '../features'
import type {
  ActionMenuDeclaration,
  ContextMenuAction,
  SlotAction,
} from '../headerActions'
import type { KeyboardAction } from '../keyboardActions'
import type { PluginDiagnose } from '../pluginDiagnostics'
import { argsKeyOf } from '../pluginArgs'
import { pluginStateKey, stateChangeOption } from './channels'

export {
  readPluginHooks,
  injectCellHooks,
  injectHeaderHooks,
  injectCellState,
  injectCellOwner,
  setPluginState,
  pluginStateKey,
  type PluginCellProps,
  type PluginHeaderProps,
  type PluginCellStateProps,
  type PluginCellOwnerProps,
} from './channels'

/**
 * Минимальная v9-фича локального состояния плагина: seed слайса под ключом
 * `pluginStateKey(id)` из дефолта `getDefault()`. Store сам создаёт атом; чтение/запись —
 * через инъектированный пропс `state` (`injectCellState`), не через общий `getState`.
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
  /**
   * Резолвнутые опции таблицы (→ опции useTable). Живые (ADR 0039): ядро пересобирает
   * их при смене значения аргументов, функции из аргументов приходят стабильными.
   */
  options?: (opts: TOptions) => TResolved
  /** Живой слайс бизнес-колбэков; undefined-ключи отбрасываются. */
  hooks?: (opts: TOptions) => THooks
  /**
   * Дефолт ЛОКАЛЬНОГО состояния плагина (значение слайса). definePlugin генерирует
   * v9-фичу, seed'ящую слайс под ключом `plugin:<id>`; компонент читает/пишет его через пропс
   * `state: [value, setter]` (`injectCellState`), приватно от общего `getState`.
   */
  state?: () => TState
  /** Сервисная колонка плагина. */
  column?: ServiceColumn
  /** Декларативные слоты плагина; функция — набор слотов зависит от аргументов фабрики. */
  slots?: PluginSlot[] | ((opts: TOptions) => PluginSlot[])
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
      // Поля, зависящие от аргументов: считаются сразу (запись самодостаточна) и
      // пересобираются ядром при смене значения аргументов (ADR 0039).
      const configure = (args: TOptions): PluginConfiguration => {
        const out: PluginConfiguration = {}
        if (config.options) {
          out.options = config.options(args)
        }
        if (config.slots) {
          out.slots =
            typeof config.slots === 'function'
              ? config.slots(args)
              : config.slots
        }
        if (config.actionMenu) {
          out.actionMenu = config.actionMenu(args)
        }
        if (config.setup) {
          out.setup = config.setup(args)
        }
        return out
      }
      Object.assign(entry, configure(opts))
      entry.args = opts
      entry.argsKey = argsKeyOf(opts)
      entry.configure = configure as TesseraFeatureEntry['configure']

      if (config.hooks) {
        entry.hooks = { [config.id]: stripUndefined(config.hooks(opts)) }
      }
      if (config.column) {
        entry.column = config.column
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

      return entry
    }
  }

export type { CellComponentProps, HeaderComponentProps } from '../createSlots'
