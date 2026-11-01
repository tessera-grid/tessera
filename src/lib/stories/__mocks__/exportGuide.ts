/**
 * Действия гайдов выгрузки (ADR 0044, ADR 0073, ADR 0172): панель, оси, запуск и перехват
 * скачивания. Общие у историй Export и Data types.
 */
import { spyOn } from 'storybook/test'

import { byTestId, pollUntil, repeat } from './catalogPlay'

export const exportPanel = () => byTestId('export-panel')
export const exportButton = () => byTestId('export-button')

/** Пользователь открывает настройки выгрузки. */
export const openExportPanel = async (
  root: HTMLElement,
  signal: AbortSignal,
) => {
  await pollUntil(() => !!root.querySelector('.data-grid__body-row'), signal)
  await repeat(
    () => !!exportPanel(),
    () => exportButton()?.click(),
    signal,
  )
}

export const axisValue = (axis: string, value: string) =>
  document.querySelector<HTMLElement>(
    `[data-testid="export-axis-${axis}"] [role="radio"][data-value="${value}"]`,
  )
export const axisChecked = (axis: string, value: string) =>
  axisValue(axis, value)?.getAttribute('aria-checked') === 'true'
/** Пользователь выбирает значение оси панели. */
export const chooseAxis = (axis: string, value: string, signal: AbortSignal) =>
  repeat(
    () => axisChecked(axis, value),
    () => axisValue(axis, value)?.click(),
    signal,
  )

/** Выгрузки, которые таблица скачала сама (`onExported`). */
export const exported: string[] = []
export const onExported = (request: {
  settings: { rows: string }
  format: { id: string }
}) => {
  exported.push(`${request.settings.rows}.${request.format.id}`)
}

/** Пользователь нажимает «выгрузить» в панели и ждёт файла. */
export const runExport = async (signal: AbortSignal) => {
  const before = exported.length
  await repeat(
    () => exported.length > before || !exportPanel(),
    () => byTestId('export-run')?.click(),
    signal,
  )
  await pollUntil(() => exported.length > before, signal)
}

export function interceptDownload() {
  const names: string[] = []
  const blobs: Blob[] = []
  const url = spyOn(URL, 'createObjectURL').mockImplementation(value => {
    blobs.push(value as Blob)
    return 'blob:export-story'
  })
  const click = spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
    function (this: HTMLAnchorElement) {
      names.push(this.download)
    },
  )
  return {
    names,
    blobs,
    restore: () => {
      url.mockRestore()
      click.mockRestore()
    },
  }
}

/** Текст записи zip по локальным заголовкам; deflate — встроенным `DecompressionStream`. */
export async function zipEntryText(bytes: Uint8Array, name: string) {
  const view = new DataView(bytes.buffer)
  for (let at = 0; view.getUint32(at, true) === 0x04034b50;) {
    const method = view.getUint16(at + 8, true)
    const size = view.getUint32(at + 18, true)
    const nameLength = view.getUint16(at + 26, true)
    const start = at + 30 + nameLength
    const entry = new TextDecoder().decode(bytes.slice(at + 30, start))
    if (entry === name) {
      const stream = new Blob([bytes.slice(start, start + size)]).stream()
      return new Response(
        method === 8
          ? stream.pipeThrough(new DecompressionStream('deflate-raw'))
          : stream,
      ).text()
    }
    at = start + size
  }
  return ''
}
