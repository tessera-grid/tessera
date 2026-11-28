import type { CellErrorHook } from '../../shared/cellHooks'

/** `cellErrors` hooks (ADR 0150): read live through `table.getHooks()`. */
export type CellErrorsHooks = CellErrorHook
