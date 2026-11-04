/**
 * Presence-based сборка набора фич. Свёртка: always-on
 * `commonFeature` + слоты активных записей → один объект → `tableFeatures()`.
 *
 * Компромисс по типам: полностью динамический массив теряет статическую валидацию
 * слотов v9. Здесь тип итога — пересечение слотов записей (+ commonFeature);
 * рантайм-валидацию делает `tableFeatures()`. Типобезопасный путь для
 * фиксированного набора — литерал (см. использование в тестах).
 */
import { setActionOwner } from './actionOwners'
import {
  type KeyboardAction,
  registerKeyboardActionsInto,
  sortKeyboardActionsByPriority,
} from './keyboardActions'
import {
  columnGroupingFeature,
  columnOrderingFeature,
  columnPinningFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  tableFeatures,
} from '@tanstack/react-table'

import { commonFeature } from './commonFeature'
import { expandIncludedModels } from './pluginModels'
import { actionStatusFeature } from './headerActions/actionStatusFeature'
import { failuresFeature } from './failures/failuresFeature'
import { draftsFeature } from './drafts/draftsFeature'
import { flashFeature } from './flashes/flashFeature'
import { highlightFeature } from './highlights/highlightFeature'
import { scrollToRowFeature } from './scrollToRow/scrollToRowFeature'
import { serverActionFeature } from './serverActions/serverActionFeature'
import type { ServiceColumn } from './createColumns'
import {
  createEmptyRenderSlots,
  registerSlotInto,
  type PluginSlot,
  type RenderSlots,
} from './createSlots'
import {
  createEmptySlotActions,
  registerSlotActionInto,
  type ActionMenuDeclaration,
  type ContextMenuAction,
  type SlotAction,
  type SlotActionMenu,
  type SlotActions,
} from './headerActions'
import type { NarrowMap, NarrowState } from './effectiveState'
import type { StubEntry } from './stubs'
import type { DraftKind } from './drafts/drafts'
import type { LabelSet } from './localization'
import {
  type ActionCatalog,
  type ActionLabels,
  foldActionCatalog,
} from './actions'
import { CORE_ACTIONS } from './actions/coreActions'
import {
  type FoldedWrappers,
  type PluginWrappers,
  createEmptyWrappers,
  registerWrappersInto,
} from './pluginWrappers'
import {
  type BodyContributions,
  type FoldedBody,
  createEmptyBody,
  registerBodyInto,
} from './bodyContributions'
import {
  reportPluginError,
  type PluginDiagnose,
  type PluginInertReason,
  type PluginDiagnosticSource,
} from './pluginDiagnostics'

/**
 * Запись плагина, которую задаёт автор (ADR 0164, §3): фрагмент карты фич, табличные
 * опции и декларативные слоты, действия и меню. `features` идёт в `tableFeatures()`;
 * остальное сворачивается в опции таблицы (`foldEntries`).
 */
export interface TablePlugin<TFeatures extends object = object> {
  id: string
  /**
   * Фрагмент для `tableFeatures({...})`, напр. `{ rowSortingFeature, sortedRowModel,
   * sortFns }`. Опционален: запись может нести только декларативные действия/меню
   * (slotActions/actionMenu) без собственной фичи.
   */
  features?: TFeatures
  /** Наличие = включено. */
  enabled?: boolean
  /** Табличные опции фичи (напр. `{ enableSorting: true }`) — вливаются в опции useTable. */
  options?: Record<string, unknown>
  /** Модель, которую несёт плагин интерфейса; ядро раскрывает её в свою запись (ADR 0120, §3). */
  model?: TablePlugin
  /**
   * Живой слайс бизнес-хуков плагина (колбэки/флаги), читается через
   * `table.getHooks()`. В отличие от `options`/`slots`, НЕ мемоизируется по сигнатуре
   * набора — сворачивается каждый рендер (`foldHooks`), чтобы колбэки оставались
   * актуальными на момент вызова. Ключ верхнего уровня — scope плагина.
   */
  hooks?: Record<string, unknown>
  /** Декларативные слоты плагина. */
  slots?: PluginSlot[]
  /** Декларативные действия слота (кебаб/инлайн). */
  slotActions?: SlotAction[]
  /** Заглушки пустой таблицы плагина — записи реестра (ADR 0123). */
  stubs?: StubEntry[]
  /** Виды черновиков плагина (ADR 0178, §1). */
  draftKinds?: DraftKind[]
  /** Наборы подписей плагина и общих модулей, которые он рисует (ADR 0182, §8). */
  labels?: readonly LabelSet[]
  /** Действия плагина в справочнике: имя → подпись или ссылка (ADR 0182, §1). */
  actions?: ActionLabels
  /** Декларативные пункты контекстного меню (ADR 0030). */
  contextMenuActions?: ContextMenuAction[]
  /** Клавиатурные действия на ячейках (ADR 0021). */
  keyboardActions?: KeyboardAction[]
  /** Декларация плагина-меню: на какие слоты распространить кебаб. */
  actionMenu?: ActionMenuDeclaration
  /** Причина инертности для `table.getPluginDiagnostics()` (ADR 0022). */
  diagnose?: PluginDiagnose
  /** Сервисная колонка плагина (напр. колонка раскрытия/выбора). */
  column?: ServiceColumn
  /**
   * Императивный сетап ПОСЛЕ создания таблицы (generic-escape): побочный
   * эффект, невыразимый через фичу/опции (напр. rowActions пишет авто-слайс ширины
   * через table.setColumnAutoSizing). Ядро выполняет setups активных записей в
   * едином useEffect; может вернуть cleanup.
   */
  setup?: (table: unknown) => void | (() => void)
  /**
   * Сужение срезов состояния параметрами плагина (ADR 0039, §4): «сохранённое →
   * допустимое» по ключу среза. Ядро отдаёт TanStack эффективное значение, не
   * переписывая сохранённое.
   */
  narrow?: Record<string, NarrowState>
  /**
   * Согласование состояния плагина с таблицей после каждого рендера (ADR 0040, §2):
   * ядро зовёт его у всех присутствующих записей, включая выключенные. Обязано быть
   * дешёвым, когда согласовывать нечего.
   */
  reconcile?: (table: unknown, context: PluginReconcileContext) => void
}

/** Внутренняя запись плагина: поля, которые ставят ядро и `definePlugin` (ADR 0164, §3). */
export interface TesseraFeatureEntry<
  TFeatures extends object = object,
> extends TablePlugin<TFeatures> {
  /** Аргументы фабрики `definePlugin` (ADR 0039): из них ядро пересобирает настройку. */
  args?: unknown
  /** Ключ аргументов по значению; смена ключа пересобирает `configure`. */
  argsKey?: string
  /**
   * Аргументы-договоры на время жизни таблицы (напр. `server`, ADR 0039): ядро
   * держит их значение с момента монтирования, смена на лету — dev-warn.
   */
  lifetimeArgs?: readonly string[]
  /**
   * Аргументы-функции, влияющие на отрисовку (ADR 0039): новая ссылка на такую
   * функцию перерисовывает ячейки. Колбэки `on*` сюда не входят.
   */
  refreshArgs?: readonly string[]
  /**
   * Срезы из аргументов плагина: `<срез>`, `on<Срез>Change`, `initial<Срез>` — TanStack
   * (ADR 0120, §4) и локальный срез `plugin:<id>` (ADR 0171, §4).
   */
  stateSlices?: PluginStateSlice[]
  /** Кто включил запись — интерфейс свою модель (MP16) или ядро свою (ADR 0170): в диагностике её нет. */
  includedBy?: string
  /** Причина инертности, заданная ядром по составу набора (`'addedAfterMount'`…). */
  inertReason?: PluginInertReason
  /**
   * Настройка из вида аргументов (функции — стабильные обёртки). Ядро зовёт её при
   * смене `argsKey` вместо готовых `options`/`slots`/`actionMenu`/`setup`.
   */
  configure?: (args: any) => PluginConfiguration
  model?: TesseraFeatureEntry
  /** Обёртки и декораторы тела и шапки плагина перетаскивания (ADR 0168, §2). */
  wrappers?: PluginWrappers
  /** Вклад в ячейку и строку тела, корень грида и клавиши навигации (ADR 0170, §3). */
  body?: BodyContributions
}

/** Срез TanStack, заданный аргументами плагина; `undefined` — аргумент не передан. */
export interface PluginStateSlice {
  key: string
  value: unknown
  onChange?: (next: unknown) => void
  initial: unknown
}

export interface PluginReconcileContext {
  enabled: boolean
  /** Хуки плагина: живые у включённого, из записи — у выключенного. */
  hooks: Record<string, unknown>
}

/** Поля записи, которые зависят от аргументов фабрики. */
export type PluginConfiguration = Partial<
  Pick<
    TesseraFeatureEntry,
    'options' | 'slots' | 'actionMenu' | 'setup' | 'narrow' | 'body'
  >
>

/** Свёрнутая из записей конфигурация — уходит в опции таблицы / сборку колонок. */
export interface FoldedEntryConfig {
  options: Record<string, unknown>
  slots: RenderSlots
  slotActions: SlotActions
  contextMenuActions: ContextMenuAction[]
  /** Заглушки пустой таблицы активных записей (ADR 0123). */
  stubEntries: StubEntry[]
  /** Виды черновиков активных записей (ADR 0178). */
  draftKinds: DraftKind[]
  /** Подписи всех присутствующих записей (ADR 0182, §8). */
  labelSets: LabelSet[]
  /** Справочник действий: ядро и все присутствующие записи (ADR 0182). */
  actionCatalog: ActionCatalog
  /** Повторно объявленные действия (ADR 0182, AN1). */
  actionDuplicates: string[]
  keyboardActions: KeyboardAction[]
  actionMenu: SlotActionMenu
  serviceColumns: ServiceColumn[]
  setups: NonNullable<TesseraFeatureEntry['setup']>[]
  /** Сужения срезов состояния активных записей, по ключу среза (ADR 0039). */
  narrow: NarrowMap
  /** Все присутствующие записи, включая `enabled: false`. */
  pluginDiagnostics: PluginDiagnosticSource[]
  wrappers: FoldedWrappers
  body: FoldedBody
}

const isActive = (entry: TesseraFeatureEntry) => entry.enabled !== false

/**
 * Дубли `id` среди записей. `id` — единый ключ scope: hook-слайс, локальный state-слайс,
 * генерируемая state-фича и id слотов. Дубль молча перезаписывает их («последний
 * победил»), поэтому ядро дев-варнит (DP5).
 */
export const findDuplicatePluginIds = (
  entries: readonly TesseraFeatureEntry[],
): string[] => {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const entry of entries) {
    if (seen.has(entry.id)) {
      duplicates.add(entry.id)
    }
    seen.add(entry.id)
  }
  return [...duplicates]
}

/** Перезапись опции или хука чужим плагином: `from` задал, `to` перезаписал. */
export interface PluginOverwrite {
  kind: 'option' | 'hook'
  key: string
  from: string
  to: string
}

/**
 * Перезаписи опций таблицы и хуков записями с другим `id` (ADR 0140). Значение — по-прежнему
 * от последней записи; дубль `id` предупреждает DP5.
 */
export const findPluginOverwrites = (
  plugins: readonly TesseraFeatureEntry[],
): PluginOverwrite[] => {
  const overwrites: PluginOverwrite[] = []
  const owners = {
    option: new Map<string, string>(),
    hook: new Map<string, string>(),
  }
  const values = {
    option: new Map<string, unknown>(),
    hook: new Map<string, unknown>(),
  }
  const check = (
    kind: PluginOverwrite['kind'],
    source: object | undefined,
    id: string,
  ) => {
    for (const [key, value] of Object.entries(source ?? {})) {
      const from = owners[kind].get(key)
      // Одинаковое значение — не перезапись: общая опция фильтров и поиска `filterFromLeafRows`.
      if (
        from !== undefined &&
        from !== id &&
        !Object.is(values[kind].get(key), value)
      ) {
        overwrites.push({ kind, key, from, to: id })
      }
      owners[kind].set(key, id)
      values[kind].set(key, value)
    }
  }
  for (const entry of expandIncludedModels(plugins).entries) {
    check('option', entry.options, entry.id)
    if (isActive(entry)) check('hook', entry.hooks, entry.id)
  }
  return overwrites
}

/**
 * Чистая свёртка активных записей в опции таблицы. Порядок фолда = порядок
 * записей, как в императивной регистрации. Используется и `useCreateTable`, и
 * headless-тестами.
 */
export const foldEntries = (
  plugins: readonly TesseraFeatureEntry[],
): FoldedEntryConfig => {
  // Модели, которые несут интерфейсы, — свои записи (ADR 0120); раскрытый набор не меняется.
  const { entries } = expandIncludedModels(plugins)
  const options: Record<string, unknown> = {}
  const slots = createEmptyRenderSlots()
  const slotActions = createEmptySlotActions()
  const contextMenuActions: ContextMenuAction[] = []
  const stubEntries: StubEntry[] = []
  const draftKinds: DraftKind[] = []
  const labelSets: LabelSet[] = []
  const actionOwners: Parameters<typeof foldActionCatalog>[0][number][] = [
    { id: 'core', actions: CORE_ACTIONS },
  ]
  const keyboardActions: KeyboardAction[] = []
  const actionMenu: SlotActionMenu = {}
  const serviceColumns: ServiceColumn[] = []
  const setups: NonNullable<TesseraFeatureEntry['setup']>[] = []
  const pluginDiagnostics: PluginDiagnosticSource[] = []
  const narrow: NarrowMap = {}
  const wrappers = createEmptyWrappers()
  const body = createEmptyBody()

  for (const entry of entries) {
    if (!entry.includedBy) {
      pluginDiagnostics.push({
        id: entry.id,
        enabled: entry.enabled,
        diagnose: entry.diagnose,
        reason: entry.inertReason,
      })
    }

    // Опции берём от ВСЕХ присутствующих записей (в т.ч. enabled:false) — фабрика
    // отключённого плагина эмитит enable*:false, гася свою (всегда-присутствующую в
    // наборе) фичу. Слоты/колонки/действия/setup — только у активных (реактивный UI).
    // Опции модели выставляет только её запись (ADR 0120): от порядка они не зависят.
    Object.assign(options, entry.options)

    // Ключи словаря выключенного плагина — тоже ключи таблицы: словарь приложения их знает.
    for (const set of entry.labels ?? [])
      if (!labelSets.includes(set)) labelSets.push(set)
    // Действия выключенного плагина — тоже: его отказы и черновики остаются названными.
    actionOwners.push({
      id: entry.id,
      actions: entry.actions,
      named: [
        ...(entry.slotActions ?? []),
        ...(entry.contextMenuActions ?? []),
      ],
    })

    // Сужение — тоже от всех записей: выключенный плагин гасит свой срез (фильтры —
    // ADR 0045), не теряя сохранённого значения.
    for (const [key, fn] of Object.entries(entry.narrow ?? {})) {
      ;(narrow[key] ??= []).push(fn)
    }

    // Обёртки тела и шапки — и у выключенной записи: начатая сессия доживает до отмены.
    registerWrappersInto(wrappers, entry.wrappers, isActive(entry))

    if (!isActive(entry)) {
      continue
    }

    registerBodyInto(body, entry.body)

    entry.slots?.forEach(slot =>
      registerSlotInto(slots, { ...slot, pluginId: entry.id }),
    )
    entry.slotActions?.forEach(action => {
      setActionOwner(action, entry.id)
      registerSlotActionInto(slotActions, action)
    })
    // Пункты контекстного меню собираем в общий список (дедуп по id — последний
    // побеждает); порядок/видимость резолвятся при открытии (resolveVisibleActions).
    entry.contextMenuActions?.forEach(action => {
      setActionOwner(action, entry.id)
      const index = contextMenuActions.findIndex(a => a.id === action.id)
      if (index === -1) {
        contextMenuActions.push(action)
      } else {
        contextMenuActions[index] = action
      }
    })

    if (entry.stubs) stubEntries.push(...entry.stubs)
    for (const kind of entry.draftKinds ?? []) {
      setActionOwner(kind, entry.id)
      draftKinds.push(kind)
    }

    entry.keyboardActions?.forEach(action => setActionOwner(action, entry.id))
    registerKeyboardActionsInto(keyboardActions, entry.keyboardActions)

    if (entry.column) {
      serviceColumns.push({ ...entry.column, pluginId: entry.id })
    }

    const { setup, id } = entry
    if (setup) {
      // Падение setup одного плагина не мешает остальным (ADR 0037, PE3).
      setups.push(table => {
        try {
          return setup(table)
        } catch (error) {
          reportPluginError(table, id, error)
          return undefined
        }
      })
    }

    if (entry.actionMenu) {
      const { slots: menuSlots, mode, threshold } = entry.actionMenu
      menuSlots.forEach(slot => {
        actionMenu[slot] = { mode, threshold }
      })
    }
  }

  return {
    options,
    slots,
    slotActions,
    contextMenuActions,
    stubEntries,
    draftKinds,
    labelSets,
    ...(() => {
      const { catalog, duplicates } = foldActionCatalog(actionOwners)
      return { actionCatalog: catalog, actionDuplicates: duplicates }
    })(),
    keyboardActions: sortKeyboardActionsByPriority(keyboardActions),
    actionMenu,
    serviceColumns,
    setups,
    narrow,
    pluginDiagnostics,
    wrappers,
    body,
  }
}

/**
 * Живая свёртка hook-слайсов активных записей. В отличие от `foldEntries`,
 * вызывается КАЖДЫЙ рендер (не мемоизируется по сигнатуре набора): бизнес-колбэки
 * должны быть актуальны на момент вызова через `table.getHooks()`. No-op дефолты и
 * дедуп по scope подкладывает `resolveHooks`.
 */
export const foldHooks = (
  entries: readonly TesseraFeatureEntry[],
): Record<string, unknown> => {
  const hooks: Record<string, unknown> = {}
  // Хуки модели, которую несёт интерфейс, — в её scope (ADR 0120).
  for (const entry of expandIncludedModels(entries).entries) {
    if (isActive(entry) && entry.hooks) {
      Object.assign(hooks, entry.hooks)
    }
  }
  return hooks
}

type UnionToIntersection<U> = (
  U extends unknown ? (x: U) => void : never
) extends (x: infer I) => void
  ? I
  : never

// Запись без `features` даёт `{}` и не обнуляет вывод остальных записей.
type EntryFeatures<E> = E extends { features?: infer F }
  ? NonNullable<F>
  : never

type MergeFeatures<T extends readonly TablePlugin[]> = UnionToIntersection<
  EntryFeatures<T[number]>
>

/**
 * Тип набора фич: always-on `commonFeature` + `columnOrderingFeature` (порядок/
 * индексы колонок нужны гриду всегда — getIndex/getIsFirstColumn/getIsLastColumn)
 * + слоты записей.
 */
export type TesseraFeatures<T extends readonly TablePlugin[]> = {
  commonFeature: typeof commonFeature
  actionStatusFeature: typeof actionStatusFeature
  failuresFeature: typeof failuresFeature
  draftsFeature: typeof draftsFeature
  highlightFeature: typeof highlightFeature
  flashFeature: typeof flashFeature
  scrollToRowFeature: typeof scrollToRowFeature
  serverActionFeature: typeof serverActionFeature
  columnOrderingFeature: typeof columnOrderingFeature
  columnVisibilityFeature: typeof columnVisibilityFeature
  columnPinningFeature: typeof columnPinningFeature
  columnSizingFeature: typeof columnSizingFeature
  columnGroupingFeature: typeof columnGroupingFeature
} & MergeFeatures<T>

/**
 * Собрать набор фич из записей. Отсеивает `enabled: false`, вклеивает always-on
 * `commonFeature` + `columnOrderingFeature`, сливает слоты и прогоняет через
 * `tableFeatures()`.
 */
export const buildTesseraFeatures = <
  const T extends readonly TesseraFeatureEntry[],
>(
  entries: T,
): TesseraFeatures<T> => {
  const merged: Record<string, unknown> = {
    commonFeature,
    actionStatusFeature,
    failuresFeature,
    draftsFeature,
    highlightFeature,
    flashFeature,
    scrollToRowFeature,
    serverActionFeature,
    columnOrderingFeature,
    columnVisibilityFeature,
    columnPinningFeature,
    columnSizingFeature,
    columnGroupingFeature,
  }

  // Фичи ВСЕХ присутствующих записей (в т.ч. enabled:false): набор фич фиксируется
  // на маунте useTable, поэтому рантайм-включение плагина не добавит фичу. Держим
  // фичу всегда, а поведение гейтим опцией
  // (enable*:false у отключённого плагина — foldEntries эмитит её от всех записей).
  for (const entry of expandIncludedModels(entries).entries) {
    Object.assign(merged, entry.features)
  }

  return tableFeatures(merged as never) as TesseraFeatures<T>
}
