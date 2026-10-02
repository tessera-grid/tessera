import type { TableLabels } from '../../core/localization'
import type { ExportViewFeature } from './settings'

/** Подпись значения оси «Строки»; `view` называет то, что учитывается (EX10). */
export const rowLabel = (
  labels: TableLabels,
  value: string,
  viewBy: ExportViewFeature[],
): string => {
  switch (value) {
    case 'all':
      return labels.exportAll
    case 'view':
      return labels.exportView(viewBy)
    case 'page':
      return labels.exportPage
    case 'selected':
      return labels.exportSelected
    default:
      return value
  }
}
