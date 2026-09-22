/**
 * Вклад cellSelection в контекстное меню (ADR 0030): пункт «Копировать». Читает
 * выделение из stock-фичи (`getSelectedCellRangesData`), сериализует ядровым
 * clipboard-модулем и пишет в буфер через async Clipboard API (клик по пункту —
 * пользовательский жест, запись разрешена). TSV + HTML-таблица; фолбэк — writeText.
 */
import { Copy } from 'lucide-react'

import {
  cellRangesToHtml,
  cellRangesToTsv,
  hasSelectedCells,
} from '../../core/clipboard'
import type { ContextMenuAction } from '../../core/headerActions'

const writeClipboard = async (tsv: string, html: string): Promise<void> => {
  try {
    if (
      navigator.clipboard &&
      typeof (window as { ClipboardItem?: unknown }).ClipboardItem ===
        'function'
    ) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': new Blob([tsv], { type: 'text/plain' }),
          'text/html': new Blob([html], { type: 'text/html' }),
        }),
      ])
      return
    }
  } catch {
    // Богатая запись недоступна — падаем на текстовый фолбэк ниже.
  }
  try {
    await navigator.clipboard?.writeText(tsv)
  } catch {
    // Буфер недоступен (нет прав/insecure context) — тихо выходим.
  }
}

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
    const table = ctx.table as {
      getSelectedCellRangesData?: () => unknown[][][]
    }
    const regions = table.getSelectedCellRangesData?.() ?? []
    if (!hasSelectedCells(regions)) {
      return
    }
    void writeClipboard(cellRangesToTsv(regions), cellRangesToHtml(regions))
  },
}
