/**
 * Варианты справочника по строке поиска (ADR 0048, §5; ADR 0175, ED8): новый запрос отменяет
 * прошлый, отказ оставляет прежние варианты и даёт повтор. Его берут панель фильтра вариантов
 * и редакторы вариантов.
 */
import { useCallback, useEffect, useState } from 'react'

import {
  type ColumnOption,
  type LoadOptions,
  rememberOptionLabels,
} from '../../core/columnOptions'
import { rejectionText } from '../../util/thenable'

export type LoadedOptions =
  | { status: 'loading'; options: ColumnOption[] }
  | { status: 'ready'; options: ColumnOption[] }
  | { status: 'error'; options: ColumnOption[]; reason?: string }

export const useLoadedOptions = (
  table: object,
  columnId: string,
  loadOptions: LoadOptions | undefined,
  query: string,
) => {
  const [loaded, setLoaded] = useState<LoadedOptions>({
    status: 'loading',
    options: [],
  })
  const [attempt, setAttempt] = useState(0)

  // Новый запрос — сразу «загрузка» с прежними вариантами, ещё в этом рендере.
  const request = [table, columnId, loadOptions, query, attempt]
  const [lastRequest, setLastRequest] = useState(request)
  if (request.some((value, index) => value !== lastRequest[index])) {
    setLastRequest(request)
    setLoaded(prev => ({ status: 'loading', options: prev.options }))
  }

  useEffect(() => {
    if (!loadOptions) return
    const controller = new AbortController()
    loadOptions(query, { signal: controller.signal }).then(
      options => {
        if (controller.signal.aborted) return
        rememberOptionLabels(table, columnId, options)
        setLoaded({ status: 'ready', options })
      },
      (error: unknown) => {
        if (controller.signal.aborted) return
        setLoaded(prev => ({
          status: 'error',
          options: prev.options,
          reason: rejectionText(error),
        }))
      },
    )
    return () => controller.abort()
  }, [table, columnId, loadOptions, query, attempt])

  const retry = useCallback(() => setAttempt(n => n + 1), [])
  return loadOptions ? { ...loaded, retry } : undefined
}
