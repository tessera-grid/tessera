/**
 * Запись ядра черновиков (ADR 0178, §1): срез `drafts` и опции ядра `drafts`,
 * `onDraftsChange`, `initialDrafts`. Запись есть в каждой таблице и плагином не считается.
 */
import { definePlugin } from '../definePlugin'
import type { TesseraFeatureEntry } from '../features'
import { neverInert } from '../pluginDiagnostics'
import { DRAFTS, DRAFTS_KEY, type Draft, warnInertDrafts } from './drafts'

interface DraftsOptions {
  enabled?: boolean
  drafts?: readonly Draft[]
  onDraftsChange?: (next: readonly Draft[]) => void
  initialDrafts?: readonly Draft[]
}

const NONE: readonly Draft[] = []

const draftsPlugin = definePlugin<DraftsOptions>()({
  id: DRAFTS,
  diagnose: neverInert,
  state: (): readonly Draft[] => NONE,
  stateName: 'drafts',
  setup: () => table => {
    warnInertDrafts(table)
    const atom = (
      table as {
        atoms: Record<
          string,
          { subscribe: (listener: () => void) => { unsubscribe: () => void } }
        >
      }
    ).atoms[DRAFTS_KEY]
    const subscription = atom?.subscribe(() => warnInertDrafts(table))
    return () => subscription?.unsubscribe()
  },
})

/** Запись ядра в начале набора: в диагностике плагинов её нет. */
export const draftsEntry = (
  options: Omit<DraftsOptions, 'enabled'>,
): TesseraFeatureEntry => ({
  ...draftsPlugin(options),
  includedBy: 'core',
})
