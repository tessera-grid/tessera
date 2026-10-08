/**
 * Zip-архив для `.xlsx` (ADR 0073, §5): локальные заголовки, CRC-32, центральный
 * каталог. Части сжимаются deflate встроенным `CompressionStream` (вне главного
 * потока); без него хранятся без сжатия.
 */

export interface ZipEntry {
  name: string
  /** Содержимое кусками — так большой лист не склеивается в одну строку. */
  chunks: Uint8Array[]
  /** CRC-32, посчитанный по ходу сборки кусков; иначе считается здесь. */
  crc?: number
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  return table
})()

/** Продолжает CRC-32 куском: начало — `0`, итог — значение после последнего куска. */
export const crc32Update = (previous: number, chunk: Uint8Array): number => {
  let crc = (previous ^ 0xffffffff) >>> 0
  for (let i = 0; i < chunk.length; i++) {
    crc = CRC_TABLE[(crc ^ chunk[i]!) & 0xff]! ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

export const crc32 = (chunks: Uint8Array[]): number =>
  chunks.reduce(crc32Update, 0)

const sizeOf = (chunks: Uint8Array[]) =>
  chunks.reduce((total, chunk) => total + chunk.length, 0)

const deflate = async (chunks: Uint8Array[]): Promise<Uint8Array | null> => {
  if (typeof CompressionStream === 'undefined') return null
  const stream = new Blob(chunks as BlobPart[])
    .stream()
    .pipeThrough(new CompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

const header = (size: number) => {
  const bytes = new Uint8Array(size)
  return { bytes, view: new DataView(bytes.buffer) }
}

/** Архив из частей; `compress: false` — без сжатия (так же, как без `CompressionStream`). */
export const buildZip = async (
  entries: ZipEntry[],
  { compress = true }: { compress?: boolean } = {},
): Promise<Blob> => {
  const encoder = new TextEncoder()
  const parts: BlobPart[] = []
  const central: Uint8Array[] = []
  let offset = 0

  for (const entry of entries) {
    const name = encoder.encode(entry.name)
    const crc = entry.crc ?? crc32(entry.chunks)
    const size = sizeOf(entry.chunks)
    const packed = compress ? await deflate(entry.chunks) : null
    const method = packed ? 8 : 0
    const stored = packed ? packed.length : size

    const local = header(30 + name.length)
    local.view.setUint32(0, 0x04034b50, true)
    local.view.setUint16(4, 20, true)
    local.view.setUint16(6, 0x0800, true) // имена в UTF-8
    local.view.setUint16(8, method, true)
    local.view.setUint32(14, crc, true)
    local.view.setUint32(18, stored, true)
    local.view.setUint32(22, size, true)
    local.view.setUint16(26, name.length, true)
    local.bytes.set(name, 30)
    parts.push(
      local.bytes,
      ...((packed ? [packed] : entry.chunks) as BlobPart[]),
    )

    const record = header(46 + name.length)
    record.view.setUint32(0, 0x02014b50, true)
    record.view.setUint16(4, 20, true)
    record.view.setUint16(6, 20, true)
    record.view.setUint16(8, 0x0800, true)
    record.view.setUint16(10, method, true)
    record.view.setUint32(16, crc, true)
    record.view.setUint32(20, stored, true)
    record.view.setUint32(24, size, true)
    record.view.setUint16(28, name.length, true)
    record.view.setUint32(42, offset, true)
    record.bytes.set(name, 46)
    central.push(record.bytes)

    offset += local.bytes.length + stored
  }

  const centralSize = sizeOf(central)
  const end = header(22)
  end.view.setUint32(0, 0x06054b50, true)
  end.view.setUint16(8, entries.length, true)
  end.view.setUint16(10, entries.length, true)
  end.view.setUint32(12, centralSize, true)
  end.view.setUint32(16, offset, true)

  return new Blob([...parts, ...(central as BlobPart[]), end.bytes], {
    type: 'application/zip',
  })
}
