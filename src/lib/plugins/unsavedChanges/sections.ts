/**
 * Порядок пульта (ADR 0178, §8; DR44): изменения данных — правки ячеек и операции над строками —
 * одним списком в порядке появления, черновики с целью-колонкой — ниже, разделом на вид в порядке
 * его первого черновика.
 */
import type { Draft } from '../../core/drafts/drafts'

export interface DraftSection {
  kind: string
  drafts: Draft[]
}

export const draftSections = (drafts: readonly Draft[]) => {
  const data: Draft[] = []
  const sections = new Map<string, DraftSection>()
  for (const draft of drafts) {
    if (!('column' in draft.target)) {
      data.push(draft)
      continue
    }
    let section = sections.get(draft.kind)
    if (!section) {
      section = { kind: draft.kind, drafts: [] }
      sections.set(draft.kind, section)
    }
    section.drafts.push(draft)
  }
  return { data, sections: [...sections.values()] }
}
