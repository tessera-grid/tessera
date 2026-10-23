/**
 * Разбор снимка кучи по кускам (ADR 0092, LK16): тот же результат, что `JSON.parse`
 * строки целиком, и без строки целиком.
 */
import { describe, expect, it } from 'vitest'

import { createHeapSnapshotParser } from '../stories/__tests__/heapSnapshotParser'

const SNAPSHOT = JSON.stringify({
  snapshot: {
    meta: {
      node_fields: ['type', 'name', 'id', 'self_size', 'edge_count'],
      node_types: [
        ['hidden', 'object'],
        'string',
        'number',
        'number',
        'number',
      ],
      edge_fields: ['type', 'name_or_index', 'to_node'],
      edge_types: [['element', 'property', 'weak'], 'string_or_number', 'node'],
      location_fields: ['object_index', 'script_id', 'line', 'column'],
    },
    node_count: 3,
    edge_count: 2,
  },
  nodes: [1, 0, 1, 0, 2, 1, 1, 3, 123456789, 0, 1, 2, 5, 16, 0],
  edges: [1, 1, 5, 0, 2, 10],
  trace_function_infos: [],
  trace_tree: [1, 2, [3, [4, '"]']], 5, [0], ['strings', 1]],
  samples: [7, 8],
  locations: [0, 2, 91194, 7],
  strings: [
    '<dummy>',
    '',
    'pair in WeakMap (table @42)',
    'кавычка " и \\ слэш',
    'скобки ] [ } { и запятая, двоеточие:',
    'é\u0001\n\t',
    '"nodes":[1,2]',
  ],
}).replace(/,"/g, ',\n"')

const parseInChunks = (text: string, size: number) => {
  const parser = createHeapSnapshotParser()
  let maxCarried = 0
  for (let i = 0; i < text.length; i += size) {
    parser.push(text.slice(i, i + size))
    maxCarried = Math.max(maxCarried, parser.carried)
  }
  return { heap: parser.finish(), maxCarried }
}

describe('Снимок кучи по кускам (ADR 0092)', () => {
  it('LK16: снимок кучи разбирается по кускам — результат как у JSON.parse при любой нарезке, между кусками удержан только незаконченный токен', () => {
    const whole = JSON.parse(SNAPSHOT)
    const tokens = (whole.strings as string[]).map(
      s => JSON.stringify(s).length,
    )
    const longestToken = Math.max(...tokens, String(123456789).length)
    const headerEnd = SNAPSHOT.indexOf('"nodes":') + '"nodes":['.length
    for (const size of [1, 2, 3, 7, 64, SNAPSHOT.length]) {
      const { heap, maxCarried } = parseInChunks(SNAPSHOT, size)
      expect(heap.snapshot, `size ${size}`).toEqual(whole.snapshot)
      expect(Array.from(heap.nodes), `size ${size}`).toEqual(whole.nodes)
      expect(Array.from(heap.edges), `size ${size}`).toEqual(whole.edges)
      expect(heap.strings, `size ${size}`).toEqual(whole.strings)
      // До метаданных держится их начало; дальше — не больше куска и одного токена.
      expect(maxCarried, `size ${size}`).toBeLessThanOrEqual(
        Math.max(headerEnd, size + longestToken),
      )
    }
    // Оборванный снимок — ошибка, а не тихо урезанный результат.
    const cut = createHeapSnapshotParser()
    cut.push(SNAPSHOT.slice(0, SNAPSHOT.indexOf('"strings":') + 15))
    expect(() => cut.finish()).toThrow('снимок кучи оборван')
  })

  it('LK17: снимок, где чисел рёбер больше 2^27 — предела обычного массива V8, — разбирается; снимок, не сходящийся с node_count и edge_count, — ошибка', () => {
    const edgeCount = Math.ceil((2 ** 27 + 1) / 3)
    const header = (count: number) =>
      JSON.stringify({
        snapshot: {
          meta: {
            node_fields: ['type', 'name', 'id', 'self_size', 'edge_count'],
            node_types: [['object'], 'string', 'number', 'number', 'number'],
            edge_fields: ['type', 'name_or_index', 'to_node'],
            edge_types: [['property'], 'string_or_number', 'node'],
          },
          node_count: 1,
          edge_count: count,
        },
      }).slice(0, -1) + `,"nodes":[0,0,1,0,${count}],"edges":[`
    const tail = '0,0,0],"strings":[""]}'

    const parser = createHeapSnapshotParser()
    parser.push(header(edgeCount))
    const block = 1 << 16
    const chunk = '0,0,0,'.repeat(block)
    let left = edgeCount - 1
    for (; left >= block; left -= block) {
      parser.push(chunk)
    }
    parser.push('0,0,0,'.repeat(left) + tail)
    const heap = parser.finish()
    expect(heap.edges.length).toBe(edgeCount * 3)
    expect(heap.edges.length).toBeGreaterThan(2 ** 27)

    const extra = createHeapSnapshotParser()
    expect(() => extra.push(header(1) + '0,0,0,' + tail)).toThrow(
      'снимок кучи не сходится с метаданными',
    )
    const short = createHeapSnapshotParser()
    short.push(header(2) + tail)
    expect(() => short.finish()).toThrow('снимок кучи оборван')
  }, 60_000)
})
