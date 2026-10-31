import type { CellErrorHook } from '../../shared/cellHooks'

/** Хуки `cellErrors` (ADR 0150): читаются живо через `table.getHooks()`. */
export type CellErrorsHooks = CellErrorHook
