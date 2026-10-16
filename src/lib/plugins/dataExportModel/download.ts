/** Скачивание через `Blob` и временную ссылку `<a download>` (ADR 0044, EX17). */
import type { ExportFormat } from './types'

export const downloadFile = (
  content: string | Uint8Array | Blob,
  filename: string,
  format: ExportFormat,
) => {
  const blob =
    content instanceof Blob
      ? content
      : new Blob([content as BlobPart], { type: format.mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.${format.extension}`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
