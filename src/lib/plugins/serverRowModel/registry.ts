/**
 * Плагин модели `serverRowModel` (ADR 0138): строки тела — блоками с сервера, кэш у
 * грида. Свой источник строк ядру — опцией `getRowSource`; `data` не читается.
 */
import type { RowData, TableFeatures } from '@tanstack/react-table'
import { definePlugin, readPluginHooks } from '../../core/definePlugin'
import type { RowSource } from '../../core/rowSource'
import {
  DEFAULT_BLOCK_SIZE,
  DEFAULT_MAX_BLOCKS,
  SERVER_ROW_MODEL,
  type ServerSource,
  serverSourceOf,
} from './source'
import { serverRowModelFeature } from './serverRowModelFeature'
import type { ServerRowModelHooks } from './types'
import { serverRowModelLabels } from './labels'

export interface ServerRowModelOptions {
  /** `false` — плагин отключён. */
  enabled?: boolean
  /** Загрузить строки `[start, end)`; читается живо. */
  getRows?: ServerRowModelHooks['getRows']
  /** Строк в блоке; договор на время жизни таблицы. */
  blockSize?: number
  /** Сколько блоков держать в кэше; давно не нужные сверх него вытесняются. */
  maxBlocks?: number
  /** Строк в группе — из строки-группы ответа (ADR 0144); читается живо. */
  getGroupChildCount?: ServerRowModelHooks['getGroupChildCount']
  /** Строк данных в группе для подписи (ADR 0184); читается живо. */
  getGroupRowCount?: ServerRowModelHooks['getGroupRowCount']
}

/** Источник таблицы; у клиентского (плагин выключен или инертен) хранилища нет. */
const sourceOfTable = (table: unknown) =>
  (
    table as { getRowSource: () => RowSource }
  ).getRowSource() as Partial<ServerSource>

export const serverRowModel = definePlugin<ServerRowModelOptions>()({
  id: SERVER_ROW_MODEL,
  labels: [serverRowModelLabels],
  actions: {
    loadBlock: labels => serverRowModelLabels(labels).actionLoadBlock,
    rowTransaction: labels => serverRowModelLabels(labels).actionRowTransaction,
  },
  lifetime: ['blockSize'],
  // Без загрузчика строк брать неоткуда (ADR 0138, SD37).
  diagnose: table =>
    readPluginHooks<ServerRowModelHooks>(table as never, SERVER_ROW_MODEL)
      .getRows
      ? undefined
      : 'noGetRows',
  // `table.refreshRows` и `table.setRowData` (§7).
  features: { serverRowModelFeature },
  hooks: o => ({
    getRows: o.getRows,
    getGroupChildCount: o.getGroupChildCount,
    getGroupRowCount: o.getGroupRowCount,
  }),
  state: () => 0,
  // Отключённый плагин отдаёт нейтральные значения: v9 сливает опции с прежними.
  options: o => {
    const enabled = o.enabled !== false
    return {
      enableServerRowModel: enabled,
      getRowSource: enabled && o.getRows ? serverSourceOf : undefined,
      serverRowModelBlockSize: o.blockSize ?? DEFAULT_BLOCK_SIZE,
      serverRowModelMaxBlocks: o.maxBlocks ?? DEFAULT_MAX_BLOCKS,
      // Клиентская модель строк здесь не рисует: новая `data` выделение по индексам не
      // сбрасывает, новую выборку отслеживает само выделение (ADR 0146, §6).
      autoResetCellSelection: enabled ? false : undefined,
    }
  },
  // Кэш переживает смену аргументов: cleanup лишь отменяет запросы в пути.
  setup: o => table => {
    const source = sourceOfTable(table)
    if (!source.store) return
    source.setMaxBlocks?.(o.maxBlocks ?? DEFAULT_MAX_BLOCKS)
    source.resume?.()
    return () => source.suspend?.()
  },
})

/* eslint-disable @typescript-eslint/no-unused-vars -- generics карт обязаны
   повторять сигнатуры v9, иначе declaration merging не склеится */
declare module '@tanstack/react-table' {
  interface TableOptions_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    /** Опции таблицы, которые выставляет плагин (ADR 0167). */
    serverRowModelPlugin: {
      enableServerRowModel?: boolean
      serverRowModelBlockSize?: number
      serverRowModelMaxBlocks?: number
    }
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */
