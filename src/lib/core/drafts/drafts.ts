/**
 * Реестр черновиков (ADR 0178, §1): введённое, но не применённое — условие фильтра, значение
 * ячейки, строка до сохранения. Срез — только данные `{ kind, target, value }`, по записи на
 * пару вида и цели: приложение сохраняет его и возвращает опциями ядра `drafts`,
 * `onDraftsChange`, `initialDrafts`. Как применить, отбросить и подписать черновик, объявляет
 * плагин — владелец вида.
 */
import { logWarn } from '../../util/logger'
import type { TableLabels } from '../localization'
import { pluginStateKey, setPluginState } from '../definePlugin/channels'
import { useSelector } from '@tanstack/react-store'

import { useSliceProjection } from '../reactivity'

/** Цель черновика: ячейка, строка или колонка. */
export type DraftTarget =
  | { cell: [rowId: string, columnId: string] }
  | { row: string }
  | { column: string }

export interface Draft {
  /** Вид черновика — его объявляет плагин-владелец. */
  kind: string
  target: DraftTarget
  /** Значение — сериализуемое. */
  value: unknown
}

/** Поведение вида черновика (ADR 0178, §1, DR3). */
export interface DraftKind {
  kind: string
  /** Подпись записи по словарю таблицы: что это за черновик. */
  label: (labels: TableLabels, draft: Draft) => string
  /** Значение черновика одной строкой — для пульта; без поля пульт значение не пишет. */
  describe?: (labels: TableLabels, draft: Draft, table: unknown) => string
  /** Применить черновик; промис — ожидание, его отказ — отказ на объекте (ADR 0177). */
  apply: (table: unknown, draft: Draft) => unknown
  /** Отбросить черновик; без поля — только снять запись. */
  discard?: (table: unknown, draft: Draft) => void
  /** Вид работает в этой таблице; `false` — его черновики инертны (DR8). */
  active?: (table: unknown) => boolean
}

export const DRAFTS = 'drafts'
export const DRAFTS_KEY = pluginStateKey(DRAFTS)

const EMPTY: readonly Draft[] = []

type DraftsTable = {
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

/** Срез черновиков; без таблицы — пустой. */
export const readDrafts = (table: unknown): readonly Draft[] =>
  ((table as DraftsTable | undefined)?.store?.get()[DRAFTS_KEY] as
    readonly Draft[] | undefined) ?? EMPTY

/** Положить черновик: запись той же пары вида и цели заменяется. */
export const setDraft = (table: unknown, draft: Draft) => {
  const key = keyOf(draft)
  const prev = readDrafts(table)
  const at = prev.findIndex(item => keyOf(item) === key)
  const next =
    at < 0 ? [...prev, draft] : prev.map((item, i) => (i === at ? draft : item))
  setPluginState(table, DRAFTS, next)
}

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

/** Отбросить черновик: поведение вида, затем снять запись. */
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

/** Черновик вида у цели — перерисовывает только подписчика этой цели. */
export const useDraft = (
  table: unknown,
  kind: string,
  target: DraftTarget,
): Draft | undefined => {
  const key = draftKeyOf(kind, target)
  return useSliceProjection(table, DRAFTS_KEY, (drafts?: readonly Draft[]) =>
    (drafts ?? EMPTY).find(item => keyOf(item) === key),
  )
}

/** Источник без черновиков — у таблицы без записи ядра (хосты тестов). */
const NO_DRAFTS = {
  get: () => EMPTY,
  subscribe: () => ({ unsubscribe: () => {} }),
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
