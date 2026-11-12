/**
 * Копирование выделения ячеек в буфер (ADR 0029, ADR 0146). Все строки выделения
 * загружены — синхронно в событии `copy`; иначе их догружает источник строк, а буфер
 * пишется асинхронным Clipboard API. Строк больше `cellSelectionMaxCopyRows` — отказ с
 * причиной. Отказ — плашка с повтором (ADR 0116); буфер тогда не меняется.
 */
import { announceLabel, announcerLabels } from '../../core/announcer'
import { type CancelSource, registerPending } from '../../core/cancellation'
import {
  cellRangesToHtml,
  cellRangesToTsv,
  countCells,
  hasSelectedCells,
  TESSERA_FORMAT,
  valuesToTesseraFormat,
} from './clipboard'
import { shownTextOf } from './shownText'
import { reportAction } from '../../core/debugActions'
import { ENGLISH_LABELS } from '../../core/localization'
import { rowSourceOf } from '../../core/rowSource'
import { timeSlicer } from '../../util/timeSlice'
import { readServerAction, writeServerAction } from '../../core/serverActions'
import { cellSelectionLabels } from './labels'

/** Предел строк выделения для буфера по умолчанию (ADR 0146, §5). */
export const DEFAULT_MAX_COPY_ROWS = 10_000

interface Bounds {
  minRowIndex: number
  maxRowIndex: number
  minColumnIndex: number
  maxColumnIndex: number
}

interface CopyCell {
  getCanSelect: () => boolean
  getValue: () => unknown
}

interface CopyRow {
  original?: unknown
  getAllCellsByColumnId: () => Record<string, CopyCell | undefined>
}

/** Регион буфера: показанный текст и значения в типе колонки (ADR 0219, WR4). */
interface CopyRegion {
  texts: string[][]
  values: unknown[][]
}

type ShownText = ReturnType<typeof shownTextOf>

interface CopyTable {
  store: object
  options: { cellSelectionMaxCopyRows?: number }
  atoms: {
    cellSelection?: {
      get: () => unknown
      subscribe: (listener: () => void) => { unsubscribe: () => void }
    }
  }
  getCellSelectionBounds?: () => Bounds[]
  getCellSelectionColumnIndexes?: () => Record<string, number>
  getSelectedCellRangesData?: () => unknown[][][]
  getSelectedCellCount?: () => number
}

/** Копирование, ждущее строк: новое копирование или выделение его прерывает. */
const waiting = new WeakMap<object, AbortController>()
let attempts = 0

/** Таблица ушла со страницы: копирование, ждущее строк, бросается (ADR 0092, LK4). */
export const abortCellSelectionCopy = (store: object) => {
  waiting.get(store)?.abort()
  waiting.delete(store)
}

/** Строк в выделении — объединение отрезков строк его прямоугольников. */
export const selectedRowCount = (bounds: readonly Bounds[]): number => {
  const spans = bounds
    .map(b => [b.minRowIndex, b.maxRowIndex] as const)
    .sort((a, b) => a[0] - b[0])
  let rows = 0
  let end = -1
  for (const [from, to] of spans) {
    if (to <= end) continue
    rows += to - Math.max(from, end + 1) + 1
    end = to
  }
  return rows
}

/** Строка региона: показанный текст и значения выбираемых ячеек прямоугольника. */
const regionRow = (
  bound: Bounds,
  columnIds: readonly string[],
  row: CopyRow | undefined,
  shown: ShownText,
  region: CopyRegion,
) => {
  const cells = row?.getAllCellsByColumnId()
  const texts: string[] = []
  const values: unknown[] = []
  for (let c = bound.minColumnIndex; c <= bound.maxColumnIndex; c++) {
    const columnId = columnIds[c]!
    const cell = cells?.[columnId]
    if (!cell?.getCanSelect()) continue
    const value = cell.getValue()
    texts.push(shown(columnId, value, row?.original))
    values.push(value)
  }
  region.texts.push(texts)
  region.values.push(values)
}

/** Регион прямоугольника по строкам `rows` подряд с его верха — сразу. */
const regionNow = (
  bound: Bounds,
  columnIds: readonly string[],
  rows: readonly (CopyRow | undefined)[],
  shown: ShownText,
): CopyRegion => {
  const region: CopyRegion = { texts: [], values: [] }
  for (const row of rows) regionRow(bound, columnIds, row, shown, region)
  return region
}

/** Тот же регион кусками, уступая главный поток. */
const regionOf = async (
  bound: Bounds,
  columnIds: readonly string[],
  rows: readonly (CopyRow | undefined)[],
  shown: ShownText,
): Promise<CopyRegion> => {
  const slice = timeSlicer()
  const region: CopyRegion = { texts: [], values: [] }
  for (const row of rows) {
    regionRow(bound, columnIds, row, shown, region)
    if (region.texts.length % 256 === 0) await slice()
  }
  return region
}

/** Свой формат — одним регионом: несвязные прямоугольники вставляются как сплошной блок. */
const tesseraData = (regions: readonly CopyRegion[]) =>
  valuesToTesseraFormat(regions.flatMap(region => region.values))

const columnIdsOf = (t: CopyTable): string[] => {
  const ids: string[] = []
  for (const [id, index] of Object.entries(
    t.getCellSelectionColumnIndexes?.() ?? {},
  )) {
    ids[index] = id
  }
  return ids
}

/**
 * Буфер — асинхронным Clipboard API: TSV и HTML, без поддержки HTML — только текст. Свой формат
 * Clipboard API пишет только как `web `-формат, который читает не каждый браузер, — его нет.
 */
const writeClipboard = async (tsv: string, html: string): Promise<void> => {
  if (typeof ClipboardItem === 'function' && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': new Blob([tsv], { type: 'text/plain' }),
          'text/html': new Blob([html], { type: 'text/html' }),
        }),
      ])
      return
    } catch {
      // Богатая запись не прошла — пробуем текст.
    }
  }
  await navigator.clipboard.writeText(tsv)
}

/** Отказ копирования — плашка с повтором; объявляет её плашка (ADR 0116, §5). */
const refuse = (
  table: unknown,
  error: unknown,
  retry: () => void,
  cause: number | undefined,
) => {
  reportAction(table, {
    plugin: 'cellSelection',
    action: 'copyRejected',
    detail: { error: (error as Error | undefined)?.message },
    source: 'auto',
    cause,
  })
  writeServerAction(table, () => ({
    failed: { kind: 'copy', attempt: ++attempts, error, retry },
  }))
}

/** Прежний отказ копирования снимается успехом нового. */
const clearRefusal = (table: unknown) => {
  if (readServerAction(table).failed?.kind === 'copy') {
    writeServerAction(table, ({ pending }) => (pending ? { pending } : {}))
  }
}

export interface CopyRequest {
  /** Данные события `copy`: синхронный путь пишет в них. */
  clipboardData?: Pick<DataTransfer, 'setData'>
  source: 'keyboard' | 'pointer'
}

/**
 * Скопировать выделение. `'copied'` — буфер записан в событии (его надо отменить),
 * `'loading'` — строки догружаются, `'refused'` — отказ, `'none'` — выделения нет.
 */
export const copyCellSelection = (
  table: unknown,
  request: CopyRequest,
): 'copied' | 'loading' | 'refused' | 'none' => {
  const t = table as CopyTable
  const bounds = t.getCellSelectionBounds?.() ?? []
  if (!bounds.length) return 'none'
  waiting.get(t.store)?.abort()
  waiting.delete(t.store)
  const rows = selectedRowCount(bounds)
  const max = t.options.cellSelectionMaxCopyRows ?? DEFAULT_MAX_COPY_ROWS
  const retry = () => void copyCellSelection(table, { source: 'pointer' })
  const cause = reportAction(table, {
    plugin: 'cellSelection',
    action: 'copy',
    detail: () => ({ cells: t.getSelectedCellCount?.(), rows }),
    source: request.source,
  })
  if (rows > max) {
    const labels = announcerLabels(table) ?? ENGLISH_LABELS
    const message = cellSelectionLabels(labels).copyTooManyRows(rows, max)
    refuse(table, new Error(message), retry, cause)
    return 'refused'
  }

  const source = rowSourceOf<CopyRow>(table)
  const loaded =
    !source.keyByIndex ||
    bounds.every(bound => {
      for (let r = bound.minRowIndex; r <= bound.maxRowIndex; r++) {
        if (!source.at(r)) return false
      }
      return true
    })

  if (loaded) {
    const shown = shownTextOf(table)
    const columnIds = columnIdsOf(t)
    const regions = bounds.map(bound => {
      const rows: (CopyRow | undefined)[] = []
      for (let r = bound.minRowIndex; r <= bound.maxRowIndex; r++)
        rows.push(source.at(r))
      return regionNow(bound, columnIds, rows, shown)
    })
    const texts = regions.map(region => region.texts)
    if (!hasSelectedCells(texts)) return 'none'
    const tsv = cellRangesToTsv(texts)
    const html = cellRangesToHtml(texts)
    if (request.clipboardData) {
      request.clipboardData.setData('text/plain', tsv)
      request.clipboardData.setData('text/html', html)
      request.clipboardData.setData(TESSERA_FORMAT, tesseraData(regions))
    } else {
      void writeClipboard(tsv, html).catch(() => {})
    }
    clearRefusal(table)
    announceLabel(table, l =>
      cellSelectionLabels(l).announceCopy(countCells(texts)),
    )
    return 'copied'
  }

  // Догрузка мимо кэша окна (ADR 0146, §4); новое выделение её прерывает.
  const controller = new AbortController()
  waiting.set(t.store, controller)
  const watch = t.atoms.cellSelection?.subscribe(() => controller.abort())
  announceLabel(table, l => cellSelectionLabels(l).announceCopyLoading(rows))
  writeServerAction(table, status => ({
    ...status,
    loadingRows: { kind: 'copy', since: performance.now() },
  }))
  // Отмена человеком или приложением (ADR 0153): тихо, буфер не меняется.
  let cancelled = false
  const unregister = registerPending(table, {
    kind: 'copy',
    id: 'copy',
    cancel: (cancelSource: CancelSource) => {
      if (controller.signal.aborted) return
      cancelled = true
      controller.abort()
      finish()
      reportAction(table, {
        plugin: 'cellSelection',
        action: 'cancel',
        detail: { action: 'copy' },
        source: cancelSource,
        cause,
      })
      announceLabel(table, l => l.announceActionCancelled(l.actionCopy))
    },
  })
  const columnIds = columnIdsOf(t)
  const shown = shownTextOf(table)
  const regions = Promise.all(
    bounds.map(async bound => {
      const fetched = await source.loadRange!(
        bound.minRowIndex,
        bound.maxRowIndex,
        controller.signal,
      )
      return regionOf(bound, columnIds, fetched, shown)
    }),
  ).then(list => list.map(region => region.texts))
  const finish = () => {
    watch?.unsubscribe()
    unregister()
    const current = waiting.get(t.store)
    if (current === controller) waiting.delete(t.store)
    // Новое копирование уже ждёт — его ожидание не снимается.
    else if (current) return
    writeServerAction(table, ({ loadingRows: _rows, ...status }) => ({
      ...status,
      loadingRows: undefined,
    }))
  }
  regions
    .then(async data => {
      controller.signal.throwIfAborted()
      try {
        await writeClipboard(cellRangesToTsv(data), cellRangesToHtml(data))
      } catch {
        const labels = announcerLabels(table) ?? ENGLISH_LABELS
        throw new Error(cellSelectionLabels(labels).copyClipboardDenied)
      }
      finish()
      if (controller.signal.aborted) return
      reportAction(table, {
        plugin: 'cellSelection',
        action: 'copyResolved',
        source: 'auto',
        cause,
      })
      clearRefusal(table)
      announceLabel(table, l =>
        cellSelectionLabels(l).announceCopy(countCells(data)),
      )
    })
    .catch((error: unknown) => {
      finish()
      if (cancelled) return
      if (controller.signal.aborted) {
        reportAction(table, {
          plugin: 'cellSelection',
          action: 'copyCancelled',
          source: 'auto',
          cause,
        })
        return
      }
      refuse(table, error, retry, cause)
    })
  return 'loading'
}
