/**
 * Плагин модели `serverRowModel` (ADR 0138): строки тела — блоками с сервера, кэш у
 * грида. Свой источник строк ядру — опцией `getRowSource`; `data` не читается.
 */
import { definePlugin, readPluginHooks } from '../../core/definePlugin'
import type { RowSource } from '../../core/rowSource'
import {
  DEFAULT_BLOCK_SIZE,
  DEFAULT_MAX_BLOCKS,
  SERVER_ROW_MODEL,
  type ServerSource,
  serverSourceOf,
} from './source'
import type { ServerRowModelHooks } from './types'

export interface ServerRowModelOptions {
  /** `false` — плагин отключён. */
  enabled?: boolean
  /** Загрузить строки `[start, end)`; читается живо. */
  getRows?: ServerRowModelHooks['getRows']
  /** Всего строк, если известно до первого ответа. */
  rowCount?: number
  /** Строк в блоке; договор на время жизни таблицы. */
  blockSize?: number
  /** Сколько блоков держать в кэше; давно не нужные сверх него вытесняются. */
  maxBlocks?: number
}

/** Источник таблицы; у клиентского (плагин выключен или инертен) хранилища нет. */
const sourceOfTable = (table: unknown) =>
  (
    table as { getRowSource: () => RowSource }
  ).getRowSource() as Partial<ServerSource>

export const serverRowModel = definePlugin<ServerRowModelOptions>()({
  id: SERVER_ROW_MODEL,
  lifetime: ['blockSize'],
  // Без загрузчика строк брать неоткуда (ADR 0138, SD37).
  diagnose: table =>
    readPluginHooks<ServerRowModelHooks>(table as never, SERVER_ROW_MODEL)
      .getRows
      ? undefined
      : 'noGetRows',
  hooks: o => ({ getRows: o.getRows }),
  state: () => 0,
  // Отключённый плагин отдаёт нейтральные значения: v9 сливает опции с прежними.
  options: o => {
    const enabled = o.enabled !== false
    return {
      enableServerRowModel: enabled,
      getRowSource: enabled && o.getRows ? serverSourceOf : undefined,
      serverRowModelBlockSize: o.blockSize ?? DEFAULT_BLOCK_SIZE,
      serverRowModelMaxBlocks: o.maxBlocks ?? DEFAULT_MAX_BLOCKS,
      serverRowModelRowCount: enabled ? o.rowCount : undefined,
    }
  },
  // Кэш переживает смену аргументов: cleanup лишь отменяет запросы в пути.
  setup: o => table => {
    const { store } = sourceOfTable(table)
    if (!store) return
    store.setMaxBlocks(o.maxBlocks ?? DEFAULT_MAX_BLOCKS)
    store.resume()
    return () => store.suspend()
  },
})
