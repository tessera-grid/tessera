/// <reference types="@vitest/browser-playwright" />
import type { BrowserCommand } from 'vitest/node'

// Дерево доступности Chromium через CDP (`Accessibility.getFullAXTree`) — то, что
// браузер отдаёт скринридеру через платформенный API (ADR 0033). Сворачивается в
// компактный текст: одна строка на узел `role "name" свойства`, отступ — глубина.
// Игнорируемые узлы, generic-обёртки и inline-боксы текста схлопываются.

interface AXValue {
  value?: unknown
}

interface AXProperty {
  name: string
  value: AXValue
}

interface AXNode {
  nodeId: string
  ignored: boolean
  role?: AXValue
  name?: AXValue
  description?: AXValue
  properties?: AXProperty[]
  childIds?: string[]
}

interface FrameTree {
  frame: { id: string; url: string }
  childFrames?: FrameTree[]
}

interface CDPSession {
  send: (method: string, params?: unknown) => Promise<unknown>
  detach: () => Promise<void>
}

/** Роли-обёртки без собственной семантики: их дети поднимаются на уровень выше. */
const TRANSPARENT_ROLES = new Set([
  'generic',
  'none',
  'InlineTextBox',
  'LineBreak',
])

/** Свойства, которые скринридер озвучивает для грида. */
const SPOKEN_PROPERTIES = [
  'level',
  'setsize',
  'posinset',
  'expanded',
  'selected',
  'checked',
  'pressed',
  'invalid',
  'busy',
  'live',
  'multiselectable',
  'readonly',
  'required',
  'disabled',
  'hasPopup',
  'valuenow',
  'valuemin',
  'valuemax',
  'orientation',
]

const flattenFrames = (tree: FrameTree): FrameTree['frame'][] => [
  tree.frame,
  ...(tree.childFrames ?? []).flatMap(flattenFrames),
]

/** Live-области: их речь — текст содержимого, а не имя. */
const LIVE_ROLES = new Set(['alert', 'status', 'log'])

/** `false` значим только у раскрытия (свёрнутая строка); прочие `false` — шум. */
const isMeaningful = (property: AXProperty) =>
  property.name === 'expanded' ||
  (property.value.value !== false && property.value.value !== 'false')

const formatNode = (node: AXNode, text: string) => {
  const role = String(node.role?.value ?? '')
  const name = String(node.name?.value ?? '').trim()
  const description = String(node.description?.value ?? '').trim()
  const props = (node.properties ?? [])
    .filter(p => SPOKEN_PROPERTIES.includes(p.name))
    .filter(isMeaningful)
    .map(p => (p.value.value === true ? p.name : `${p.name}=${p.value.value}`))
  return [
    role,
    name && JSON.stringify(name),
    description && `description=${JSON.stringify(description)}`,
    LIVE_ROLES.has(role) && `text=${JSON.stringify(text)}`,
    ...props,
  ]
    .filter(Boolean)
    .join(' ')
}

/**
 * Снимок поддерева доступности тестового iframe, начиная с первого узла роли
 * `grid`/`treegrid`/`table` (или со всего документа, если `root = 'document'`).
 */
export const axTree: BrowserCommand<[root?: 'grid' | 'document']> = async (
  { context, page },
  root = 'grid',
) => {
  const session = (await context.newCDPSession(page)) as unknown as CDPSession
  try {
    const { frameTree } = (await session.send('Page.getFrameTree')) as {
      frameTree: FrameTree
    }
    // Тест рендерится в дочернем iframe оркестратора Vitest.
    const frames = (frameTree.childFrames ?? []).flatMap(flattenFrames)
    const testFrame = frames[frames.length - 1] ?? frameTree.frame
    await session.send('Accessibility.enable')
    const { nodes } = (await session.send('Accessibility.getFullAXTree', {
      frameId: testFrame.id,
    })) as { nodes: AXNode[] }

    const byId = new Map(nodes.map(node => [node.nodeId, node]))
    const start =
      root === 'document'
        ? nodes[0]
        : nodes.find(node =>
            ['grid', 'treegrid', 'table'].includes(
              String(node.role?.value ?? ''),
            ),
          )
    if (!start) {
      return ''
    }

    const textOf = (node: AXNode): string =>
      String(node.role?.value) === 'StaticText'
        ? String(node.name?.value ?? '')
        : (node.childIds ?? [])
            .map(id => byId.get(id))
            .map(child => (child ? textOf(child) : ''))
            .join('')
            .trim()

    const lines: string[] = []
    const walk = (node: AXNode, depth: number) => {
      const role = String(node.role?.value ?? '')
      const visible = !node.ignored && !TRANSPARENT_ROLES.has(role)
      // Текст уже вошёл в имя родителя — текстовые узлы не выводим.
      if (role === 'StaticText') {
        return
      }
      if (visible) {
        lines.push(`${'  '.repeat(depth)}${formatNode(node, textOf(node))}`)
      }
      const childDepth = visible ? depth + 1 : depth
      for (const id of node.childIds ?? []) {
        const child = byId.get(id)
        if (child) walk(child, childDepth)
      }
    }
    walk(start, 0)
    return lines.join('\n')
  } finally {
    await session.detach()
  }
}
