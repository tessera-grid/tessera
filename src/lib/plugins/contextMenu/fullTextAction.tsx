/**
 * Пункт «Показать полностью» (ADR 0231, §6): у ячейки с обрезанным текстом, меню которой открыто
 * касанием, — подсказка с полным текстом у ячейки. Мыши и клавиатуре пункт не нужен: им её
 * показывают наведение и фокус (ADR 0075).
 */
import { TextSearch } from 'lucide-react'

import { setActionOwner } from '../../core/actionOwners'
import type { ContextMenuAction } from '../../core/headerActions'
import { SHOW_FULL_TEXT_EVENT } from '../../core/overflowText'
import { contextMenuLabels } from './labels'

export const showFullTextAction = (title: HTMLElement): ContextMenuAction => {
  const action: ContextMenuAction = {
    id: 'contextMenu:showFullText',
    order: -100,
    icon: () => <TextSearch width={16} height={16} />,
    label: labels => contextMenuLabels(labels).showFullText,
    onSelect: () => {
      title.dispatchEvent(new Event(SHOW_FULL_TEXT_EVENT, { bubbles: true }))
    },
  }
  // Пункта нет в списке плагина: владелец — сам плагин, подпись — его справочник (ADR 0182).
  setActionOwner(action, 'contextMenu')
  return action
}
