/**
 * Наборы подписей всех встроенных владельцев (ADR 0182, §9) — для проверки словаря в тесте
 * приложения: `unknownLabelKeys(dictionary, allLabelSets)`. В сборку попадает только по
 * явному импорту. Тип без аннотации: так декларация этого модуля ссылается на `labels.d.ts`
 * всех владельцев, иначе их дополнения `PluginLabels` не доходят до потребителя (AN18).
 */
import type { LabelSet } from './lib/core/localization'
import { backToTopLabels } from './lib/plugins/backToTop/labels'
import { cellEditingLabels } from './lib/plugins/cellEditing/labels'
import { cellSelectionLabels } from './lib/plugins/cellSelection/labels'
import { columnDraggingLabels } from './lib/plugins/columnDragging/labels'
import { columnFilteringLabels } from './lib/plugins/columnFiltering/labels'
import { columnPinningLabels } from './lib/plugins/columnPinning/labels'
import { columnSizingLabels } from './lib/plugins/columnSizing/labels'
import { columnSortingLabels } from './lib/plugins/columnSorting/labels'
import { columnVisibilityLabels } from './lib/plugins/columnVisibility/labels'
import { contextMenuLabels } from './lib/plugins/contextMenu/labels'
import { dataExportLabels } from './lib/plugins/dataExport/labels'
import { dataExportModelLabels } from './lib/plugins/dataExportModel/labels'
import { failureLogLabels } from './lib/plugins/failureLog/labels'
import { infiniteScrollLabels } from './lib/plugins/infiniteScroll/labels'
import { paginationLabels } from './lib/plugins/pagination/labels'
import { quickSearchLabels } from './lib/plugins/quickSearch/labels'
import { rowActionsLabels } from './lib/plugins/rowActions/labels'
import { rowDraggingLabels } from './lib/plugins/rowDragging/labels'
import { rowExpandingLabels } from './lib/plugins/rowExpanding/labels'
import { rowGroupingLabels } from './lib/plugins/rowGrouping/labels'
import { rowSelectionLabels } from './lib/plugins/rowSelection/labels'
import { rowSelectionModelLabels } from './lib/plugins/rowSelectionModel/labels'
import { serverRowModelLabels } from './lib/plugins/serverRowModel/labels'
import { unsavedChangesLabels } from './lib/plugins/unsavedChanges/labels'
import { calendarLabels } from './lib/shared/calendar/labels'
import { filteringLabels } from './lib/shared/filtering/labels'
import { optionsLabels } from './lib/shared/options/labels'

export const allLabelSets = [
  backToTopLabels,
  cellEditingLabels,
  cellSelectionLabels,
  columnDraggingLabels,
  columnFilteringLabels,
  columnPinningLabels,
  columnSizingLabels,
  columnSortingLabels,
  columnVisibilityLabels,
  contextMenuLabels,
  dataExportLabels,
  dataExportModelLabels,
  failureLogLabels,
  infiniteScrollLabels,
  paginationLabels,
  quickSearchLabels,
  rowActionsLabels,
  rowDraggingLabels,
  rowExpandingLabels,
  rowGroupingLabels,
  rowSelectionLabels,
  rowSelectionModelLabels,
  serverRowModelLabels,
  unsavedChangesLabels,
  calendarLabels,
  filteringLabels,
  optionsLabels,
] as const satisfies readonly LabelSet[]
