import type { TableLabels } from '../../core/localization'
import type { ExportViewFeature } from '../dataExportModel/settings'
import { dataExportLabels } from './labels'

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
        ? dataExportLabels(labels).exportAll
        : dataExportLabels(labels).exportLoaded(loaded)
    case 'view':
      return dataExportLabels(labels).exportView(
        viewBy.map(feature =>
          feature === 'sorting'
            ? dataExportLabels(labels).exportViewSorting
            : dataExportLabels(labels).exportViewFiltering,
        ),
      )
    case 'page':
      return dataExportLabels(labels).exportPage
    case 'selected':
      return dataExportLabels(labels).exportSelected
    default:
      return value
  }
}
