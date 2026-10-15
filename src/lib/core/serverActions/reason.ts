import type { TableLabels } from '../localization'
import { rejectionText } from '../thenable'
import type { ServerActionKind } from './serverActionFeature'

/** Причина отказа серверного действия: текст сервера (AS10), иначе подпись действия. */
export const serverActionReason = (
  failure: { kind: ServerActionKind; error: unknown },
  labels: TableLabels,
): string =>
  rejectionText(failure.error) ?? labels.serverActionFailed(failure.kind)
