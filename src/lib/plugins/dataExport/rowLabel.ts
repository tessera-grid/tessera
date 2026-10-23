import type { TableLabels } from '../../core/localization'
import type { ExportViewFeature } from '../dataExportModel/settings'

/**
 * Подпись значения оси «Строки»; `view` называет то, что учитывается (EX10).
 * `loaded` — в `data` только загруженная часть строк сервера (ADR 0081, IS14).
 */
export const rowLabel = (
  labels: TableLabels,
  value: string,
  viewBy: ExportViewFeature[],
  loaded?: number,
): string => {
  switch (value) {
    case 'all':
      return loaded === undefined
        ? labels.exportAll
        : labels.exportLoaded(loaded)
    case 'view':
      return labels.exportView(
        viewBy.map(feature =>
          feature === 'sorting'
            ? labels.exportViewSorting
            : labels.exportViewFiltering,
        ),
      )
    case 'page':
      return labels.exportPage
    case 'selected':
      return labels.exportSelected
    default:
      return value
  }
}
