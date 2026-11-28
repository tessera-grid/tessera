/**
 * Справочник действий (ADR 0182): одно имя действия `{ plugin, action }` для журнала, пульта,
 * меню, объявлений и канала действий. Ядро держит механизм; подписи объявляет владелец —
 * плагин в записи (`actions`), ядро — свои. Подпись собирается при показе по текущему словарю.
 */
import type { TableLabels } from '../localization'
import { ENGLISH_LABELS } from '../localization'
import { announcerLabels } from '../announcer'
import { actionOwnerOf } from '../actionOwners'
import { logWarn } from '../../util/logger'

/** Action id — the same pair as in a debug-action event (ADR 0125). */
export interface ActionId {
  plugin: string
  action: string
}

/** An action with its label parameters, as failures and drafts store it. */
export interface ActionRef extends ActionId {
  params?: Record<string, unknown>
}

/** Action label: one for every place the action is shown (ADR 0182, §3). */
export type ActionLabel = (
  labels: TableLabels,
  params?: Record<string, unknown>,
) => string

/**
 * An owner's actions: action name → label, or a reference to another owner's action with the
 * same label (a context-menu item that runs someone else's action).
 */
export type ActionLabels = Record<string, ActionLabel | ActionId>

/** Справочник таблицы: `<plugin>/<action>` → подпись или ссылка. */
export type ActionCatalog = Record<string, ActionLabel | ActionId>

export const actionKey = (id: ActionId) => `${id.plugin}/${id.action}`

/** Итог действия в канале — фаза исходного: подпись у них одна (ADR 0182, §7). */
const OUTCOME = /(Resolved|Rejected|Cancelled|Empty)$/

type CatalogHost = {
  options?: { actionCatalog?: ActionCatalog }
  reportAction?: object
}

const catalogOf = (table: unknown): ActionCatalog =>
  (table as CatalogHost | undefined)?.options?.actionCatalog ?? {}

/**
 * Пункты разделов меню: приходят при открытии раздела и в сборку таблицы не входят. Ключ —
 * метод `reportAction`: он один у экземпляра и у его копий и переживает пересборку
 * справочника (ADR 0182, AN23).
 */
const sectionActions = new WeakMap<object, ActionCatalog>()

const sectionActionsOf = (table: unknown): ActionCatalog | undefined => {
  const key = (table as CatalogHost | undefined)?.reportAction
  return key && sectionActions.get(key)
}

/** Подписи показанных пунктов раздела владельца `plugin`; объявленное в сборке главнее. */
export const declareSectionActions = (
  table: unknown,
  plugin: string,
  items: readonly { id: string; label?: ActionLabel }[],
) => {
  const key = (table as CatalogHost | undefined)?.reportAction
  if (!key) return
  const shown = sectionActions.get(key) ?? {}
  sectionActions.set(key, shown)
  for (const item of items)
    if (item.label) shown[actionKey({ plugin, action: item.id })] = item.label
}

/**
 * Подпись действия из справочника: сам id, итог — по исходному действию, вариант
 * `<действие>:<вариант>` — по действию; механизм ядра от имени плагина — подписью ядра.
 */
const findLabel = (
  table: unknown,
  id: ActionId,
  depth = 0,
): ActionLabel | undefined => {
  const catalog = catalogOf(table)
  const shown = sectionActionsOf(table)
  const base = id.action.replace(OUTCOME, '')
  const head = base.split(':')[0]!
  for (const action of new Set([id.action, base, head]))
    for (const plugin of new Set([id.plugin, 'core'])) {
      const key = `${plugin}/${action}`
      const entry = catalog[key] ?? shown?.[key]
      if (typeof entry === 'function') return entry
      if (entry && depth < 4) return findLabel(table, entry, depth + 1)
    }
  return undefined
}

/** Есть ли у действия подпись в справочнике таблицы. */
export const hasActionLabel = (table: unknown, id: ActionId): boolean =>
  !!findLabel(table, id)

/**
 * Подпись действия по текущему словарю: `labels` — подписи, в которых рисует потребитель;
 * без них — подписи таблицы. Неизвестный id — предупреждение в разработке и сам id
 * (ADR 0182, AN10).
 */
export const actionLabelOf = (
  table: unknown,
  id: ActionRef,
  labels?: TableLabels,
): string => {
  const label = findLabel(table, id)
  if (!label) {
    const key = actionKey(id)
    logWarn(table as never, `unknown action "${key}"`, `action:${key}`)
    return key
  }
  return label(labels ?? announcerLabels(table) ?? ENGLISH_LABELS, id.params)
}

/** Пункт меню и инлайн-кнопка — действие справочника (ADR 0182, §4). */
export interface NamedAction<TCtx> {
  id: string
  /**
   * Action label without context: listed in the catalog as `<owner>/<id>` (ADR 0182, §4).
   */
  label?: ActionLabel
  /**
   * Catalog action for a context — different states are different actions: a name of the same
   * owner or another owner's id; `id` by default.
   */
  action?: (ctx: TCtx) => string | ActionId
  /** Label parameters for a context. */
  params?: (ctx: TCtx, labels: TableLabels) => Record<string, unknown>
}

/** Действие пункта в контексте: id справочника и параметры. */
export const actionRefOf = <TCtx>(
  action: NamedAction<TCtx>,
  ctx: TCtx,
  labels: TableLabels,
): ActionRef => {
  const named = action.action?.(ctx) ?? action.id
  const id =
    typeof named === 'string'
      ? { plugin: actionOwnerOf(action), action: named }
      : named
  return action.params ? { ...id, params: action.params(ctx, labels) } : id
}

/** Подпись пункта меню или инлайн-кнопки в контексте. */
export const menuActionLabel = <TCtx>(
  action: NamedAction<TCtx>,
  ctx: TCtx,
  labels: TableLabels,
): string => {
  const table = (ctx as { table?: unknown } | undefined)?.table
  const ref = actionRefOf(action, ctx, labels)
  // Описатель вне таблицы (собран без записи плагина) — своей подписью.
  if (!hasActionLabel(table, ref) && action.label && !action.action)
    return action.label(labels, ref.params)
  return actionLabelOf(table, ref, labels)
}

/** Повторно объявленные id: действует первое объявление (ADR 0182, AN1). */
export const foldActionCatalog = (
  owners: readonly {
    id: string
    actions?: ActionLabels
    /** Пункты владельца, которые объявляют подпись своего действия. */
    named?: readonly { id: string; label?: ActionLabel }[]
  }[],
): { catalog: ActionCatalog; duplicates: string[] } => {
  const catalog: ActionCatalog = {}
  const duplicates: string[] = []
  for (const owner of owners) {
    // Пункт одного владельца в нескольких слотах — одно действие; дубль — у двух записей.
    const own = new Set<string>()
    const add = (action: string, label: ActionLabel | ActionId) => {
      const key = `${owner.id}/${action}`
      // Тот же описатель в нескольких слотах — одно объявление.
      if (own.has(key) && catalog[key] === label) return
      own.add(key)
      if (key in catalog) duplicates.push(key)
      else catalog[key] = label
    }
    for (const [action, label] of Object.entries(owner.actions ?? {}))
      add(action, label)
    for (const item of owner.named ?? [])
      if (item.label) add(item.id, item.label)
  }
  return { catalog, duplicates }
}
