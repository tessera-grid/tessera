/**
 * Реестр черновиков (ADR 0178, §1): введённое, но не применённое — условие фильтра, значение
 * ячейки, строка до сохранения. Срез — только данные `{ kind, target, value }`, по записи на
 * пару вида и цели: приложение сохраняет его и возвращает опциями ядра `drafts`,
 * `onDraftsChange`, `initialDrafts`. Как применить, сбросить и подписать черновик, объявляет
 * плагин — владелец вида.
 */
import { logWarn } from '../../util/logger'
import type { TableLabels } from '../localization'
import { pluginStateKey, setPluginState } from '../definePlugin/channels'
import { useSyncExternalStore } from 'react'
import { useSelector } from '@tanstack/react-store'

import { useSliceProjection } from '../reactivity'
import { actionLabelOf } from '../actions'
import { actionOwnerOf } from '../actionOwners'

/** Draft target: a cell, a row or a column. */
export type DraftTarget =
  | { cell: [rowId: string, columnId: string] }
  | { row: string }
  | { column: string }

export interface Draft {
  /** Draft kind — declared by the owner plugin. */
  kind: string
  target: DraftTarget
  /** The value — serializable. */
  value: unknown
}

/** Подпись вида черновика: действие справочника его владельца (ADR 0182, §5). */
export const draftKindLabel = (
  table: unknown,
  kind: DraftKind,
  labels?: TableLabels,
): string =>
  actionLabelOf(
    table,
    { plugin: actionOwnerOf(kind), action: kind.action },
    labels,
  )

/** Обе части изменения, в порядке чтения отметки и пульта черновиков. */
export const draftValueDetails = (
  labels: TableLabels,
  was: string,
  now: string,
) =>
  [
    { label: labels.draftWas, value: was },
    { label: labels.draftNow, value: now },
  ] as const

/** Behavior of a draft kind (ADR 0178, §1, DR3). */
export interface DraftKind {
  kind: string
  /**
   * Catalog action of the kind's owner (ADR 0182, §5): the unsaved-changes panel names the entry
   * with it — what kind of draft it is.
   */
  action: string
  /** The draft value as one line — for the panel; without the field the panel shows no value. */
  describe?: (labels: TableLabels, draft: Draft, table: unknown) => string
  /**
   * What applies now, as one line: the value in the data, the active condition. With it the
   * panel shows "Was" and "Now"; `undefined` means the previous value is unknown, only "Now".
   */
  previous?: (
    labels: TableLabels,
    draft: Draft,
    table: unknown,
  ) => string | undefined
  /** Applies the draft; a promise means pending, its rejection is a failure on the object (ADR 0177). */
  apply: (table: unknown, draft: Draft) => unknown
  /** Applies the kind's drafts in one action (a batch); without the field — one by one. */
  applyAll?: (table: unknown, drafts: readonly Draft[]) => unknown
  /** Panel section title for drafts of a kind with a column target (DR44); without it — the kind's label. */
  sectionLabel?: (labels: TableLabels) => string
  /**
   * Unfinished input of the kind outside the registry (an open cell edit, ADR 0178, §5): a slice
   * and a flag. The panel counts it, "Apply all" passes it to `applyAll`.
   */
  openKey?: string
  isOpen?: (slice: unknown) => boolean
  /** Discards the draft; without the field — only removes the entry. */
  discard?: (table: unknown, draft: Draft) => void
  /** The kind works in this table; `false` makes its drafts inert (DR8). */
  active?: (table: unknown) => boolean
  /**
   * What the draft changes: the data or the view of the selection. "Apply all" applies data
   * first, then the view (ADR 0178, §5); without the field — data.
   */
  stage?: 'data' | 'view'
  /** A row draft changes how the row looks in the body: new or removed (ADR 0178, §7). */
  rowMark?: RowDraftMark
}

export type RowDraftMark = 'inserted' | 'deleted'

export const DRAFTS = 'drafts'
export const DRAFTS_KEY = pluginStateKey(DRAFTS)

const EMPTY: readonly Draft[] = []

type DraftsTable = {
  atoms?: Record<string, { get: () => unknown } | undefined>
  store?: { get: () => Record<string, unknown> }
  options?: { draftKinds?: readonly DraftKind[] }
}

/** Ключ записи: одна на пару вида и цели. */
export const draftKeyOf = (kind: string, target: DraftTarget) => {
  if ('cell' in target)
    return `${kind}\u0000cell\u0000${target.cell.join('\u0000')}`
  if ('row' in target) return `${kind}\u0000row\u0000${target.row}`
  return `${kind}\u0000column\u0000${target.column}`
}

const keyOf = (draft: Draft) => draftKeyOf(draft.kind, draft.target)

/**
 * Срез черновиков; без таблицы — пустой. Читается атом среза: снимок всего `store` собирает
 * все срезы, а источник строк спрашивает черновики на каждую ячейку (DR55).
 */
export const readDrafts = (table: unknown): readonly Draft[] => {
  const t = table as DraftsTable | undefined
  const atom = t?.atoms?.[DRAFTS_KEY]
  const drafts = atom ? atom.get() : t?.store?.get()[DRAFTS_KEY]
  return (drafts as readonly Draft[] | undefined) ?? EMPTY
}

/** Положить черновик: запись той же пары вида и цели заменяется. */
export const setDraft = (table: unknown, draft: Draft) => {
  const key = keyOf(draft)
  const prev = readDrafts(table)
  const at = prev.findIndex(item => keyOf(item) === key)
  const next =
    at < 0 ? [...prev, draft] : prev.map((item, i) => (i === at ? draft : item))
  setPluginState(table, DRAFTS, next)
}

/**
 * Положить и снять записи одной записью в срез (ADR 0219, WR11): та же пара вида и цели
 * заменяется, порядок прежних записей сохраняется, новые — в конце.
 */
export const writeDrafts = (
  table: unknown,
  set: readonly Draft[],
  remove: readonly { kind: string; target: DraftTarget }[] = [],
) => {
  if (set.length === 0 && remove.length === 0) return
  const prev = readDrafts(table)
  const incoming = new Map(set.map(draft => [keyOf(draft), draft]))
  const gone = new Set(remove.map(item => draftKeyOf(item.kind, item.target)))
  let changed = false
  const next: Draft[] = []
  for (const item of prev) {
    const key = keyOf(item)
    const replacement = incoming.get(key)
    if (replacement) {
      incoming.delete(key)
      next.push(replacement)
      changed = true
    } else if (gone.has(key)) {
      changed = true
    } else {
      next.push(item)
    }
  }
  for (const draft of incoming.values()) {
    next.push(draft)
    changed = true
  }
  if (changed) setPluginState(table, DRAFTS, next)
}

/** Снять записи, отобранные условием, одной записью в срез; нечего снимать — ничего. */
export const removeDrafts = (
  table: unknown,
  remove: (draft: Draft) => boolean,
) => {
  const prev = readDrafts(table)
  const next = prev.filter(draft => !remove(draft))
  if (next.length !== prev.length) setPluginState(table, DRAFTS, next)
}

/** Снять черновики строк `rowIds`: цели-строки и ячейки этих строк. */
export const removeRowDrafts = (table: unknown, rowIds: ReadonlySet<string>) =>
  removeDrafts(table, ({ target }) =>
    'cell' in target
      ? rowIds.has(target.cell[0])
      : 'row' in target && rowIds.has(target.row),
  )

/** Снять запись вида и цели; нет записи — ничего. */
export const removeDraft = (
  table: unknown,
  kind: string,
  target: DraftTarget,
) => {
  const key = draftKeyOf(kind, target)
  const prev = readDrafts(table)
  if (!prev.some(item => keyOf(item) === key)) return
  setPluginState(
    table,
    DRAFTS,
    prev.filter(item => keyOf(item) !== key),
  )
}

/** Виды включённых плагинов, которые работают в этой таблице. */
export const draftKindsOf = (table: unknown): readonly DraftKind[] =>
  ((table as DraftsTable | undefined)?.options?.draftKinds ?? []).filter(
    kind => kind.active?.(table) ?? true,
  )

export const draftKindOf = (table: unknown, kind: string) =>
  draftKindsOf(table).find(item => item.kind === kind)

/** Черновики видов включённых плагинов; прочие инертны (DR3). */
export const activeDrafts = (table: unknown): Draft[] => {
  const kinds = new Set(draftKindsOf(table).map(item => item.kind))
  return readDrafts(table).filter(draft => kinds.has(draft.kind))
}

/** Сбросить черновик: поведение вида, затем снять запись. */
export const discardDraft = (table: unknown, draft: Draft) => {
  draftKindOf(table, draft.kind)?.discard?.(table, draft)
  removeDraft(table, draft.kind, draft.target)
}

/** Применить черновик поведением вида; вид не включён — ничего. */
export const applyDraft = (table: unknown, draft: Draft) =>
  draftKindOf(table, draft.kind)?.apply(table, draft)

/** Черновики видов без работающего владельца инертны; в разработке — предупреждение (DR3). */
export const warnInertDrafts = (table: unknown) => {
  const kinds = new Set(draftKindsOf(table).map(item => item.kind))
  for (const draft of readDrafts(table)) {
    if (kinds.has(draft.kind)) continue
    logWarn(
      table as never,
      `[drafts] the "${draft.kind}" draft is inert: no enabled plugin owns this kind in this table`,
      `inertDraft:${draft.kind}`,
    )
  }
}

/** Записи среза по ключу пары вида и цели: ячейка находит свою без перебора среза. */
const indexes = new WeakMap<readonly Draft[], Map<string, Draft>>()
const indexOf = (drafts: readonly Draft[]) => {
  let index = indexes.get(drafts)
  if (!index) {
    index = new Map(drafts.map(draft => [keyOf(draft), draft]))
    indexes.set(drafts, index)
  }
  return index
}

/** Запись вида у цели из индекса текущего среза. */
export const draftOf = (table: unknown, kind: string, target: DraftTarget) => {
  const drafts = readDrafts(table)
  return drafts.length > 0
    ? indexOf(drafts).get(draftKeyOf(kind, target))
    : undefined
}

/** Есть ли запись вида у цели; поиск по указателю среза, без перебора. */
export const hasDraft = (table: unknown, kind: string, target: DraftTarget) =>
  draftOf(table, kind, target) !== undefined

/** Черновик вида у цели — перерисовывает только подписчика этой цели. */
export const useDraft = (
  table: unknown,
  kind: string,
  target: DraftTarget,
): Draft | undefined => {
  const key = draftKeyOf(kind, target)
  return useSliceProjection(table, DRAFTS_KEY, (drafts?: readonly Draft[]) =>
    indexOf(drafts ?? EMPTY).get(key),
  )
}

const markOf = (
  table: unknown,
  drafts: readonly Draft[] | undefined,
  rowId: string,
): RowDraftMark | undefined => {
  if (!drafts?.length) return undefined
  const index = indexOf(drafts)
  for (const kind of draftKindsOf(table)) {
    if (kind.rowMark && index.has(draftKeyOf(kind.kind, { row: rowId })))
      return kind.rowMark
  }
  return undefined
}

/** Строка — новая или удалённая черновиком; иначе `undefined`. */
export const rowDraftMarkOf = (table: unknown, rowId: string) =>
  markOf(table, readDrafts(table), rowId)

/** Пометка строки черновиком — перерисовывает только строку, чья пометка сменилась. */
export const useRowDraftMark = (table: unknown, rowId: string) =>
  useSelector(
    (table as { atoms?: Record<string, typeof NO_DRAFTS> }).atoms?.[
      DRAFTS_KEY
    ] ?? NO_DRAFTS,
    (drafts?: readonly Draft[]) => markOf(table, drafts, rowId),
  )

/** Источник без черновиков — у таблицы без записи ядра (хосты тестов). */
const NO_DRAFTS = {
  get: () => EMPTY,
  subscribe: (_listener?: (value: readonly Draft[]) => void) => ({
    unsubscribe: () => {},
  }),
}

/**
 * Есть ли черновик у колонки или строки — подписка заголовка и строки на срез черновиков
 * (ADR 0178, §3): общий store срезы плагинов не оповещают.
 */
export const useHasDraftAt = (
  table: unknown,
  target: DraftTarget | undefined,
) =>
  useSelector(
    (table as { atoms?: Record<string, typeof NO_DRAFTS> }).atoms?.[
      DRAFTS_KEY
    ] ?? NO_DRAFTS,
    (drafts?: readonly Draft[]) =>
      target === undefined
        ? false
        : (drafts ?? EMPTY).some(draft =>
            'column' in target
              ? 'column' in draft.target &&
                draft.target.column === target.column
              : 'row' in target
                ? 'row' in draft.target && draft.target.row === target.row
                : false,
          ),
  )

/** Число видов с незавершённым вводом (открытая правка) — подписка на их срезы. */
export const useOpenDrafts = (table: unknown) => {
  const kinds = draftKindsOf(table).filter(kind => kind.openKey && kind.isOpen)
  const atoms = (table as { atoms?: Record<string, typeof NO_DRAFTS> }).atoms
  const sources = kinds.map(kind => atoms?.[kind.openKey!])
  return useSyncExternalStore(
    notify => {
      const subscriptions = sources.map(source => source?.subscribe(notify))
      return () => subscriptions.forEach(item => item?.unsubscribe())
    },
    () =>
      kinds.filter((kind, index) => kind.isOpen!(sources[index]?.get())).length,
  )
}

/**
 * Применить всё (ADR 0178, §8): вид с пакетом — одним вызовом, в том числе с одним лишь
 * незавершённым вводом; прочие — по черновику.
 */
export const applyAllDrafts = (table: unknown) => {
  const drafts = activeDrafts(table)
  const atoms = (table as { atoms?: Record<string, typeof NO_DRAFTS> }).atoms
  const kinds = draftKindsOf(table)
  const ordered = [
    ...kinds.filter(kind => kind.stage !== 'view'),
    ...kinds.filter(kind => kind.stage === 'view'),
  ]
  for (const kind of ordered) {
    const own = drafts.filter(draft => draft.kind === kind.kind)
    const open = !!kind.openKey && !!kind.isOpen?.(atoms?.[kind.openKey]?.get())
    if (kind.applyAll) {
      if (own.length > 0 || open) void kind.applyAll(table, own)
    } else {
      for (const draft of own) void kind.apply(table, draft)
    }
  }
}
