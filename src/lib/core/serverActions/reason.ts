import type { TableLabels } from '../localization'
import { rejectionText } from '../../util/thenable'
import type { ServerActionKind } from './serverActionFeature'

/** Подпись отказа по виду серверного действия (ADR 0132, §6). */
const FAILED_LABEL = {
  sorting: 'serverActionFailedSorting',
  filtering: 'serverActionFailedFiltering',
  search: 'serverActionFailedSearch',
  pagination: 'serverActionFailedPagination',
  grouping: 'serverActionFailedGrouping',
  aggregation: 'serverActionFailedAggregation',
  copy: 'serverActionFailedCopy',
  selectPage: 'serverActionFailedSelectPage',
  paste: 'serverActionFailedPaste',
  fill: 'serverActionFailedFill',
  undo: 'serverActionFailedUndo',
  redo: 'serverActionFailedRedo',
  write: 'serverActionFailedWrite',
} as const satisfies Record<ServerActionKind, keyof TableLabels>

/** Причина отказа серверного действия: текст сервера (AS10), иначе подпись действия. */
export const serverActionReason = (
  failure: { kind: ServerActionKind; error: unknown },
  labels: TableLabels,
): string => rejectionText(failure.error) ?? labels[FAILED_LABEL[failure.kind]]
