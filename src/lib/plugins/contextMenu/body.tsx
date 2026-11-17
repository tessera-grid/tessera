/**
 * Вклад контекстного меню в тело (ADR 0170, §5): правый клик и клавиша меню — событием
 * `contextmenu` от корня грида; долгое нажатие, состояние и поповер — хуком корня.
 */
import { createElement } from 'react'

import type { BodyContributions } from '../../core/bodyContributions'
import { ContextMenu, openOnContextMenu } from './ContextMenu'
import { contextMenuLabels } from './labels'

export const contextMenuBody: BodyContributions = {
  keys: {
    id: 'contextMenu',
    shortcuts: [
      {
        combo: 'Shift+F10',
        section: 'menu',
        label: labels => contextMenuLabels(labels).contextMenu,
      },
    ],
  },
  root: {
    id: 'contextMenu',
    useRoot: props => createElement(ContextMenu, props),
    events: {
      contextmenu: (event, { table }) => openOnContextMenu(table, event),
    },
  },
}
