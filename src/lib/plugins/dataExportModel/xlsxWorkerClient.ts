import XlsxWorker from './xlsx.worker?worker&inline'
import type { ExportData } from './types'
import type { BuildXlsxOptions } from './xlsxBuild'

const isPortable = (value: unknown): boolean =>
  value == null ||
  (typeof value === 'object'
    ? Object.getPrototypeOf(value) === Date.prototype
    : typeof value !== 'function' && typeof value !== 'symbol')

export const serializeXlsxInWorker = (
  data: ExportData,
  options: BuildXlsxOptions,
  signal?: AbortSignal,
): Promise<Blob> => {
  signal?.throwIfAborted()
  const worker = new XlsxWorker()
  let onAbort: () => void
  const result = new Promise<Blob>((resolve, reject) => {
    let offset = 0
    onAbort = () => reject(signal?.reason)
    signal?.addEventListener('abort', onAbort, { once: true })
    worker.onerror = event => {
      event.preventDefault()
      reject(event.error ?? new Error(event.message))
    }
    worker.onmessageerror = reject
    worker.onmessage = ({
      data: response,
    }: MessageEvent<Blob | true | false>) => {
      if (response instanceof Blob) return resolve(response)
      if (response === false) return reject(new Error('XLSX Worker failed'))
      try {
        signal?.throwIfAborted()
        const rows = data.rows.slice(offset, offset + 2000)
        if (!rows.every(row => row.every(isPortable))) {
          reject(new Error('XLSX data requires local serialization'))
          return
        }
        offset += rows.length
        worker.postMessage({ rows, last: offset === data.rows.length })
      } catch (error) {
        reject(error)
      }
    }
    worker.postMessage({
      data: { columns: data.columns, timeZone: data.timeZone, rows: [] },
      options,
    })
  })
  return result.finally(() => {
    signal?.removeEventListener('abort', onAbort)
    worker.terminate()
  })
}
