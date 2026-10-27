/**
 * Вклад cellSelection в контекстное меню (ADR 0030): пункт «Копировать» — тот же путь,
 * что Ctrl+C (ADR 0146): клик по пункту — жест пользователя, запись в буфер разрешена;
 * незагруженные строки серверной модели догружаются.
 */
import { Copy } from 'lucide-react'

import { copyCellSelection } from '../../core/cellSelectionCopy'
import type { ContextMenuAction } from '../../core/headerActions'

export const copyContextAction: ContextMenuAction = {
  id: 'cellSelection:copy',
  order: 0,
  icon: () => <Copy width={16} height={16} />,
  label: (_ctx, labels) => labels.copy,
  // Показываем, когда ячейка под курсором входит в выделение (для одной и для
  // многих). На невыбираемых сервисных колонках isInSelection=false → пункт скрыт,
  // меню там уступает нативному (ADR 0030, CM10).
  visible: ctx => ctx.selection.isInSelection,
  onSelect: ctx => {
    copyCellSelection(ctx.table, { source: 'pointer' })
  },
}
