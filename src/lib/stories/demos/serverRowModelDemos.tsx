/**
 * Серверная модель строк (ADR 0138): «сервер» отдаёт строки `[start, end)` с задержкой,
 * таблица держит их блоками в кэше. Режимы `Playground` — объём, известный и неизвестный
 * итог, отказ первой попытки блока, размер блока и кэша.
 */
import { useState } from 'react'

import type { ServerRowsRequest, ServerRowsResponse } from '../../plugins'
import { StoryComponent } from '../DataGridStory'
import type { StoryProps } from '../DataGridStory.types'
import {
  type FilteringItem,
  filteringColumns,
  filteringItemAt,
} from '../__mocks__/filteringData'

export const SERVER_FAILURE = 'Server error: 503 Service Unavailable'

export interface ServerRowModelDemoProps extends StoryProps {
  /** Время ответа «сервера», мс. */
  serverDelayMs?: number
  /** Строк на «сервере». */
  serverTotal?: number
  /** Сервер сообщает итог; иначе конец списка — короткий блок. */
  knownTotal?: boolean
  /** Первая попытка каждого блока, кроме первого, падает, повтор проходит. */
  failFirstAttempt?: boolean
  /** Строк в блоке. */
  blockSize?: number
  /** Блоков в кэше таблицы. */
  maxBlocks?: number
}

/** Ответ «сервера» на запрос: строки диапазона и итог, если он известен. */
export const serverAnswer = (
  { start, end }: Pick<ServerRowsRequest, 'start' | 'end'>,
  total: number,
  knownTotal: boolean,
): ServerRowsResponse<FilteringItem> => ({
  rows: Array.from(
    { length: Math.max(0, Math.min(end, total) - start) },
    (_, k) => filteringItemAt(start + k),
  ),
  rowCount: knownTotal ? total : undefined,
})

export const ServerRowModelDemo = ({
  serverDelayMs = 600,
  serverTotal = 300_000,
  knownTotal = true,
  failFirstAttempt = false,
  blockSize = 100,
  maxBlocks = 100,
  ...args
}: ServerRowModelDemoProps) => {
  const [failed] = useState(() => new Set<number>())

  // Аргументы-функции плагинов ядро читает живо (ADR 0039): useCallback не нужен.
  const getRows = ({ start, end, signal }: ServerRowsRequest) =>
    new Promise<ServerRowsResponse<FilteringItem>>((resolve, reject) => {
      window.setTimeout(() => {
        if (signal.aborted) return
        if (failFirstAttempt && start > 0 && !failed.has(start)) {
          failed.add(start)
          reject(new Error(SERVER_FAILURE))
          return
        }
        resolve(serverAnswer({ start, end }, serverTotal, knownTotal))
      }, serverDelayMs)
    })

  return (
    <StoryComponent
      {...args}
      columnsOverride={filteringColumns}
      dataOverride={NO_ROWS}
      enableServerRowModel
      serverRowModelGetRows={getRows}
      rowCount={knownTotal ? serverTotal : undefined}
      serverRowModelBlockSize={blockSize}
      serverRowModelMaxBlocks={maxBlocks}
    />
  )
}

const NO_ROWS: FilteringItem[] = []
