/// <reference types="@vitest/browser-playwright" />
import type { BrowserCommand } from 'vitest/node'

import {
  createHeapSnapshotParser,
  type HeapSnapshot,
} from './heapSnapshotParser'

// Память страницы теста через CDP (ADR 0092): сборка мусора, счётчики DOM, обработчики
// на `window` и `document`, размер кучи и путь удержания объекта. Только Chromium.

interface CDPSession {
  send: (method: string, params?: unknown) => Promise<unknown>
  on: (event: string, handler: (payload: never) => void) => void
  detach: () => Promise<void>
}

interface FrameTree {
  frame: { id: string }
  childFrames?: FrameTree[]
}

type Context = Parameters<BrowserCommand<[]>>[0]

const withSession = async <T>(
  { context, page }: Context,
  run: (session: CDPSession) => Promise<T>,
) => {
  const session = (await context.newCDPSession(page)) as unknown as CDPSession
  try {
    return await run(session)
  } finally {
    await session.detach()
  }
}

const flattenFrames = (tree: FrameTree): FrameTree['frame'][] => [
  tree.frame,
  ...(tree.childFrames ?? []).flatMap(flattenFrames),
]

/** Кадр теста: последний дочерний iframe оркестратора Vitest. */
const testFrameId = async (session: CDPSession) => {
  const { frameTree } = (await session.send('Page.getFrameTree')) as {
    frameTree: FrameTree
  }
  const frames = (frameTree.childFrames ?? []).flatMap(flattenFrames)
  return (frames[frames.length - 1] ?? frameTree.frame).id
}

const gc = async (session: CDPSession) => {
  // Несколько проходов: финализаторы и слабые ссылки отпускают объекты не за один.
  for (let i = 0; i < 4; i++) {
    await session.send('HeapProfiler.collectGarbage')
  }
}

/** Полная сборка мусора в процессе страницы. */
export const collectGarbage: BrowserCommand<[]> = async context =>
  withSession(context, gc)

export interface DomCounters {
  documents: number
  nodes: number
  jsEventListeners: number
}

/** Узлы и JS-обработчики процесса страницы после сборки мусора. */
export const domCounters: BrowserCommand<[]> = async context =>
  withSession(context, async session => {
    await gc(session)
    return (await session.send('Memory.getDOMCounters')) as DomCounters
  })

/** Занятая куча JS после сборки мусора, байт. */
export const heapUsed: BrowserCommand<[]> = async context =>
  withSession(context, async session => {
    await gc(session)
    const { usedSize } = (await session.send('Runtime.getHeapUsage')) as {
      usedSize: number
    }
    return usedSize
  })

export interface GlobalListeners {
  window: string[]
  document: string[]
}

/** Типы обработчиков на `window` и `document` кадра теста, по одному на обработчик. */
export const globalListeners: BrowserCommand<[]> = async context =>
  withSession(context, async session => {
    const frameId = await testFrameId(session)
    const contexts: { id: number; frameId: string; isDefault: boolean }[] = []
    session.on(
      'Runtime.executionContextCreated',
      ({
        context: created,
      }: {
        context: {
          id: number
          auxData?: { frameId?: string; isDefault?: boolean }
        }
      }) =>
        contexts.push({
          id: created.id,
          frameId: created.auxData?.frameId ?? '',
          isDefault: Boolean(created.auxData?.isDefault),
        }),
    )
    await session.send('Runtime.enable')
    const executionContext = contexts.find(
      item => item.frameId === frameId && item.isDefault,
    )
    if (!executionContext) {
      throw new Error('контекст исполнения кадра теста не найден')
    }
    const listenersOf = async (expression: string) => {
      const { result } = (await session.send('Runtime.evaluate', {
        expression,
        contextId: executionContext.id,
      })) as { result: { objectId: string } }
      const { listeners } = (await session.send(
        'DOMDebugger.getEventListeners',
        { objectId: result.objectId },
      )) as { listeners: { type: string }[] }
      await session.send('Runtime.releaseObject', {
        objectId: result.objectId,
      })
      return listeners.map(listener => listener.type).sort()
    }
    const found: GlobalListeners = {
      window: await listenersOf('window'),
      document: await listenersOf('document'),
    }
    await session.send('Runtime.disable')
    return found
  })

/** Сколько путей удержания печатать и до какой длины. */
const MAX_PATHS = 3
const MAX_HOPS = 40

/**
 * Кратчайшие пути удержания объектов класса `className` с подписью из `labels` от
 * корня кучи: снимок кучи, обход в ширину без слабых рёбер. Строка пути — `ребро →
 * объект` через ` / `.
 */
export const retainingPaths: BrowserCommand<
  [className: string, labels: string[]]
> = async (context, className, labels) =>
  withSession(context, async session => {
    await gc(session)
    // Снимок — по кускам: целиком он не помещается в строку V8 (LK16).
    const parser = createHeapSnapshotParser()
    session.on(
      'HeapProfiler.addHeapSnapshotChunk',
      ({ chunk }: { chunk: string }) => parser.push(chunk),
    )
    await session.send('HeapProfiler.enable')
    await session.send('HeapProfiler.takeHeapSnapshot', {
      reportProgress: false,
    })
    await session.send('HeapProfiler.disable')
    const heap = parser.finish()
    return shortestPaths(heap, className, labels)
  })

const shortestPaths = (
  heap: HeapSnapshot,
  className: string,
  labels: string[],
) => {
  const { meta } = heap.snapshot
  const nodeSize = meta.node_fields.length
  const edgeSize = meta.edge_fields.length
  const nodeName = meta.node_fields.indexOf('name')
  const nodeEdges = meta.node_fields.indexOf('edge_count')
  const nodeType = meta.node_fields.indexOf('type')
  const nodeId = meta.node_fields.indexOf('id')
  const edgeType = meta.edge_fields.indexOf('type')
  const edgeName = meta.edge_fields.indexOf('name_or_index')
  const edgeTo = meta.edge_fields.indexOf('to_node')
  const edgeTypes = meta.edge_types[0]
  const nodeTypes = meta.node_types[0]
  const weak = edgeTypes.indexOf('weak')
  const elementEdge = edgeTypes.indexOf('element')
  const hiddenEdge = edgeTypes.indexOf('hidden')
  const count = heap.nodes.length / nodeSize
  const objectType = nodeTypes.indexOf('object')

  // Значение WeakMap снимок связывает и с ключом, и с таблицей WeakMap; удерживает
  // значение только живой ключ — ребро от таблицы не путь удержания.
  const viaWeakMapTable = (node: number, edge: number) => {
    const name = heap.edges[edge + edgeName]
    const type = heap.edges[edge + edgeType]
    if (type === elementEdge || type === hiddenEdge) {
      return false
    }
    const table = /pair in WeakMap \(table @(\d+)\)/.exec(heap.strings[name])
    return (
      table !== null &&
      Number(table[1]) === heap.nodes[node * nodeSize + nodeId]
    )
  }

  const firstEdge = new Uint32Array(count + 1)
  for (let node = 0; node < count; node++) {
    firstEdge[node + 1] =
      firstEdge[node] + heap.nodes[node * nodeSize + nodeEdges] * edgeSize
  }
  const parent = new Int32Array(count).fill(-1)
  const parentEdge = new Int32Array(count).fill(-1)
  parent[0] = 0
  const queue = new Uint32Array(count)
  let head = 0
  let tail = 0
  queue[tail++] = 0
  while (head < tail) {
    const node = queue[head++]
    for (
      let edge = firstEdge[node];
      edge < firstEdge[node + 1];
      edge += edgeSize
    ) {
      if (heap.edges[edge + edgeType] === weak || viaWeakMapTable(node, edge)) {
        continue
      }
      const to = heap.edges[edge + edgeTo] / nodeSize
      if (parent[to] !== -1) {
        continue
      }
      parent[to] = node
      parentEdge[to] = edge
      queue[tail++] = to
    }
  }

  const label = (node: number) => {
    const type = nodeTypes[heap.nodes[node * nodeSize + nodeType]]
    const name = heap.strings[heap.nodes[node * nodeSize + nodeName]]
    return type === 'object' || type === 'native' || type === 'closure'
      ? name.slice(0, 80)
      : `(${type}) ${name.slice(0, 40)}`
  }
  const edgeLabel = (edge: number) => {
    const type = heap.edges[edge + edgeType]
    const name = heap.edges[edge + edgeName]
    return type === elementEdge || type === hiddenEdge
      ? `[${name}]`
      : heap.strings[name]
  }

  const propertyEdge = edgeTypes.indexOf('property')
  /** Подпись метки — строка в её свойстве `label`. */
  const labelOf = (node: number) => {
    for (
      let edge = firstEdge[node];
      edge < firstEdge[node + 1];
      edge += edgeSize
    ) {
      if (
        heap.edges[edge + edgeType] === propertyEdge &&
        heap.strings[heap.edges[edge + edgeName]] === 'label'
      ) {
        const to = heap.edges[edge + edgeTo] / nodeSize
        return heap.strings[heap.nodes[to * nodeSize + nodeName]]
      }
    }
    return undefined
  }

  const paths: string[] = []
  for (let node = 0; node < count && paths.length < MAX_PATHS; node++) {
    if (
      heap.nodes[node * nodeSize + nodeType] !== objectType ||
      heap.strings[heap.nodes[node * nodeSize + nodeName]] !== className ||
      parent[node] === -1 ||
      !labels.includes(labelOf(node) ?? '')
    ) {
      continue
    }
    const steps: string[] = []
    for (
      let current = node;
      current !== 0 && steps.length < MAX_HOPS;
      current = parent[current]
    ) {
      steps.unshift(`${edgeLabel(parentEdge[current])} → ${label(current)}`)
    }
    paths.push(`${labelOf(node)}: ${steps.join(' / ')}`)
  }
  return paths
}
