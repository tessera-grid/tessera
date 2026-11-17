/**
 * Вклад cellSelection в контекстное меню (ADR 0030): пункт «Копировать» — тот же путь,
 * что Ctrl+C (ADR 0146): клик по пункту — жест пользователя, запись в буфер разрешена;
 * незагруженные строки серверной модели догружаются.
 */
import {
  ArrowDownToLine,
  ArrowRightToLine,
  ClipboardPaste,
  Copy,
  Eraser,
  Scissors,
} from 'lucide-react'

import { clearSelection, cutFromMenu, hasWritableSelection } from './clear'
import { copyCellSelection } from './copy'
import { fillFromEdge } from './fill'
import { canPaste, pasteFromMenu } from './paste'
import type { ContextMenuAction } from '../../core/headerActions'
import { cellSelectionLabels } from './labels'

export const copyContextAction: ContextMenuAction = {
  id: 'cellSelection:copy',
  order: 0,
  shortcut: 'Mod+C',
  icon: () => <Copy width={16} height={16} />,
  label: labels => cellSelectionLabels(labels).copy,
  // Показываем, когда ячейка под курсором входит в выделение (для одной и для
  // многих). На невыбираемых сервисных колонках isInSelection=false → пункт скрыт,
  // меню там уступает нативному (ADR 0030, CM10).
  visible: ctx => ctx.selection.isInSelection,
  onSelect: ctx => {
    copyCellSelection(ctx.table, { source: 'pointer' })
  },
}

/**
 * Пункты записи (ADR 0219, WR17): только с плагином правки; недоступны, когда в выделении нет
 * ячейки, куда можно записать. Итог — на самих ячейках, у пункта ожидания нет.
 */
const writable = (ctx: Parameters<ContextMenuAction['onSelect']>[0]) =>
  !hasWritableSelection(ctx.table)

export const cutContextAction: ContextMenuAction = {
  id: 'cellSelection:cut',
  order: 1,
  shortcut: 'Mod+X',
  icon: () => <Scissors width={16} height={16} />,
  label: labels => cellSelectionLabels(labels).cut,
  visible: ctx => ctx.selection.isInSelection && canPaste(ctx.table),
  disabled: writable,
  target: () => false,
  onSelect: ctx => cutFromMenu(ctx.table),
}

export const pasteContextAction: ContextMenuAction = {
  id: 'cellSelection:paste',
  order: 2,
  shortcut: 'Mod+V',
  icon: () => <ClipboardPaste width={16} height={16} />,
  label: labels => cellSelectionLabels(labels).paste,
  visible: ctx => ctx.selection.isInSelection && canPaste(ctx.table),
  disabled: writable,
  target: () => false,
  onSelect: ctx => {
    void pasteFromMenu(ctx.table)
  },
}

export const clearContextAction: ContextMenuAction = {
  id: 'cellSelection:clear',
  order: 3,
  icon: () => <Eraser width={16} height={16} />,
  label: labels => cellSelectionLabels(labels).clear,
  visible: ctx => ctx.selection.isInSelection && canPaste(ctx.table),
  disabled: writable,
  target: () => false,
  onSelect: ctx => clearSelection(ctx.table, 'clear', 'pointer'),
}

/** «Заполнить вниз» и «Заполнить вправо» (WR19): альтернатива протяжке маркера (WCAG 2.5.7). */
export const fillDownContextAction: ContextMenuAction = {
  id: 'cellSelection:fillDown',
  order: 4,
  shortcut: 'Mod+D',
  icon: () => <ArrowDownToLine width={16} height={16} />,
  label: labels => cellSelectionLabels(labels).fillDown,
  visible: ctx => ctx.selection.isInSelection && canPaste(ctx.table),
  disabled: writable,
  target: () => false,
  onSelect: ctx => {
    fillFromEdge(ctx.table, 'y', 'pointer')
  },
}

export const fillRightContextAction: ContextMenuAction = {
  id: 'cellSelection:fillRight',
  order: 5,
  shortcut: 'Mod+R',
  icon: () => <ArrowRightToLine width={16} height={16} />,
  label: labels => cellSelectionLabels(labels).fillRight,
  visible: ctx => ctx.selection.isInSelection && canPaste(ctx.table),
  disabled: writable,
  target: () => false,
  onSelect: ctx => {
    fillFromEdge(ctx.table, 'x', 'pointer')
  },
}
