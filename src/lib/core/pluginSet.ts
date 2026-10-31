/**
 * Состав набора плагинов — договор на время жизни таблицы (ADR 0039, RX5–RX6).
 * TanStack v9 собирает фичи и атомы только в конструкторе, поэтому ядро помнит
 * состав с момента монтирования:
 *  - плагин, добавленный позже, исключается из сборки и инертен с причиной
 *    `'addedAfterMount'` — его фичи в таблице нет;
 *  - удалённый позже остаётся «призраком» с причиной `'removedAfterMount'`: запись
 *    `definePlugin` пересобирается с `enabled: false`, иначе его фича работала бы со
 *    старыми опциями (v9 сливает опции с прежними).
 */
import type { TesseraFeatureEntry } from './features'
import { argsKeyOf } from './pluginArgs'

export interface PluginSetStore {
  mounted: ReadonlySet<string>
  /** Записи последнего коммита: из них собирается «призрак» удалённого плагина. */
  last: Map<string, TesseraFeatureEntry>
}

/** Состав — с первого рендера: набор, с которым таблица монтируется. */
export const createPluginSetStore = (
  plugins: readonly TesseraFeatureEntry[],
): PluginSetStore => ({
  mounted: new Set(plugins.map(entry => entry.id)),
  last: new Map(),
})

/** Эффект коммита: запомнить записи набора для «призраков». */
export const rememberPluginSet = (
  store: PluginSetStore,
  plugins: readonly TesseraFeatureEntry[],
) => {
  for (const entry of plugins) {
    if (store.mounted.has(entry.id)) store.last.set(entry.id, entry)
  }
}

const ghostOf = (
  id: string,
  last: TesseraFeatureEntry | undefined,
): TesseraFeatureEntry => {
  const ghost: TesseraFeatureEntry = {
    id,
    enabled: false,
    inertReason: 'removedAfterMount',
    features: last?.features,
    options: last?.options,
    reconcile: last?.reconcile,
    hooks: last?.hooks,
  }
  if (!last?.configure) {
    return ghost
  }
  const args = { ...(last.args as object), enabled: false }
  return {
    ...ghost,
    args,
    argsKey: argsKeyOf(args),
    configure: last.configure,
    options: last.configure(args).options,
  }
}

/** Записи, которые ядро собирает: состав — с момента монтирования. */
export const resolvePluginSet = (
  store: PluginSetStore,
  plugins: readonly TesseraFeatureEntry[],
): TesseraFeatureEntry[] => {
  const { mounted } = store
  const present = new Set<string>()
  const entries: TesseraFeatureEntry[] = []

  for (const entry of plugins) {
    present.add(entry.id)
    if (mounted.has(entry.id)) {
      entries.push(entry)
    } else {
      entries.push({
        id: entry.id,
        enabled: false,
        inertReason: 'addedAfterMount',
      })
    }
  }
  for (const id of mounted) {
    if (!present.has(id)) {
      entries.push(ghostOf(id, store.last.get(id)))
    }
  }
  return entries
}

/**
 * Сигнатура состава: активные `id` и записи с причиной от ядра. Отключённые через
 * `enabled: false` в неё не входят — их переключение меняет её само.
 */
export const pluginSetSignature = (
  entries: readonly TesseraFeatureEntry[],
): string =>
  entries
    .map(entry =>
      entry.inertReason
        ? `${entry.id}!${entry.inertReason}`
        : entry.enabled === false
          ? null
          : entry.id,
    )
    .filter(Boolean)
    .join('|')
