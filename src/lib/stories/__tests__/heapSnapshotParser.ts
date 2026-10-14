// Разбор снимка кучи V8 по кускам (ADR 0092, LK16): строка снимка целиком в общем
// прогоне превышает предел длины строки V8. Метаданные — до `"nodes"`, дальше только
// массивы; нужные `nodes`, `edges`, `strings` собираются поэлементно, остальные
// пропускаются.

export interface HeapSnapshot {
  snapshot: {
    meta: {
      node_fields: string[]
      node_types: [string[]]
      edge_fields: string[]
      edge_types: [string[]]
    }
  }
  nodes: number[]
  edges: number[]
  strings: string[]
}

const KEPT = new Set(['nodes', 'edges', 'strings'])
const QUOTE = 34
const BACKSLASH = 92

const isNumberChar = (code: number) =>
  (code >= 48 && code <= 57) ||
  code === 45 ||
  code === 43 ||
  code === 46 ||
  code === 101 ||
  code === 69

/** Конец JSON-строки, открытой кавычкой на `start`, или `-1`, если она не дописана. */
const stringEnd = (text: string, start: number) => {
  for (let i = start + 1; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if (code === BACKSLASH) i++
    else if (code === QUOTE) return i
  }
  return -1
}

export const createHeapSnapshotParser = () => {
  let carry = ''
  let header: HeapSnapshot['snapshot'] | undefined
  const arrays: Record<string, unknown[]> = {
    nodes: [],
    edges: [],
    strings: [],
  }
  /** Ключ текущего массива верхнего уровня; `undefined` — между ключами. */
  let key: string | undefined
  /** Глубина вложенности внутри текущего массива верхнего уровня. */
  let depth = 0

  const consume = (text: string) => {
    let i = 0
    if (!header) {
      const at = text.indexOf('"nodes":')
      if (at < 0) return text
      header = (
        JSON.parse(text.slice(0, at).replace(/,\s*$/, '') + '}') as {
          snapshot: HeapSnapshot['snapshot']
        }
      ).snapshot
      i = at
    }
    while (i < text.length) {
      const code = text.charCodeAt(i)
      if (key === undefined) {
        if (code === QUOTE) {
          const end = stringEnd(text, i)
          if (end < 0) return text.slice(i)
          const colon = text.indexOf(':', end)
          if (colon < 0) return text.slice(i)
          const open = text.indexOf('[', colon)
          if (open < 0) return text.slice(i)
          key = JSON.parse(text.slice(i, end + 1)) as string
          depth = 0
          i = open + 1
          continue
        }
        i++
        continue
      }
      const kept = KEPT.has(key) && depth === 0 ? arrays[key] : undefined
      if (code === QUOTE) {
        const end = stringEnd(text, i)
        if (end < 0) return text.slice(i)
        if (kept) kept.push(JSON.parse(text.slice(i, end + 1)))
        i = end + 1
      } else if (isNumberChar(code)) {
        let end = i + 1
        while (end < text.length && isNumberChar(text.charCodeAt(end))) end++
        if (end === text.length) return text.slice(i)
        if (kept) kept.push(Number(text.slice(i, end)))
        i = end
      } else if (code === 91) {
        depth++
        i++
      } else if (code === 93) {
        if (depth === 0) key = undefined
        else depth--
        i++
      } else {
        i++
      }
    }
    return ''
  }

  return {
    push(chunk: string) {
      carry = consume(carry + chunk)
    },
    /** Длина удержанного между кусками текста: незаконченный токен. */
    get carried() {
      return carry.length
    },
    finish(): HeapSnapshot {
      if (carry.trim().replace(/[}\s]/g, '') !== '' || !header) {
        throw new Error('снимок кучи оборван')
      }
      return {
        snapshot: header,
        nodes: arrays.nodes as number[],
        edges: arrays.edges as number[],
        strings: arrays.strings as string[],
      }
    },
  }
}
