/** Методы таблицы реестра черновиков (ADR 0178, §1, DR1). */
import { assignTableAPIs } from '@tanstack/react-table'

import type { RowData, TableFeature, TableFeatures } from '../../types'
import {
  type Draft,
  type DraftTarget,
  readDrafts,
  removeDraft,
  setDraft,
} from './drafts'

interface DraftsTableAPI {
  /** Черновики в порядке появления. */
  getDrafts: () => readonly Draft[]
  /** Положить черновик; запись той же пары вида и цели заменяется. */
  setDraft: (draft: Draft) => void
  /** Снять черновик вида у цели. */
  discardDraft: (target: DraftTarget, kind: string) => void
}

/* eslint-disable @typescript-eslint/no-unused-vars -- generics карт обязаны
   повторять сигнатуры v9, иначе declaration merging не склеится */
declare module '@tanstack/react-table' {
  interface Plugins {
    draftsFeature: TableFeature
  }
  interface Table_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    draftsFeature: DraftsTableAPI
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */

export const draftsFeature: TableFeature = {
  constructTableAPIs: table => {
    assignTableAPIs('draftsFeature', table, {
      table_getDrafts: { fn: () => readDrafts(table) },
      table_setDraft: { fn: (draft: Draft) => setDraft(table, draft) },
      table_discardDraft: {
        fn: (target: DraftTarget, kind: string) =>
          removeDraft(table, kind, target),
      },
    })
  },
}
