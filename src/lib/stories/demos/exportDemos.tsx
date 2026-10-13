/**
 * Демо экспорта (ADR 0044): серверный режим с журналом колбэков. Грид показывает одну
 * страницу из 1000 строк; `all`, `view` и `selected` уходят в `onExport` («сервер»
 * отвечает с задержкой), `page` скачивает клиент и пишет `onExported`.
 */
import { useCallback, useRef, useState } from 'react'

import { useLatest } from '../../core/useLatest'

import type { ExportRequest } from '../../plugins'
import { StoryComponent } from '../DataGridStory'
import type { StoryProps } from '../DataGridStory.types'
import { makeData } from '../__mocks__/data'
import {
  CallbackLog,
  WithLog,
  describeEvent,
  useCallbackLog,
} from './CallbackLog'

export interface ExportServerDemoProps extends StoryProps {
  /** Время «серверной» выгрузки, мс. */
  serverDelayMs?: number
  /** `always` — серверная выгрузка каждый раз падает. */
  serverFailMode?: 'never' | 'always'
}

const PAGE_SIZE = 25
const TOTAL_ROWS = 1000

export const ExportServerDemo = ({
  serverDelayMs = 2000,
  serverFailMode = 'never',
  ...args
}: ExportServerDemoProps) => {
  const { entries, log, clear } = useCallbackLog()
  const [page] = useState(() => makeData({ shape: 'flat', count: PAGE_SIZE }))
  const settings = useLatest({ serverDelayMs, serverFailMode })

  const onExport = useCallback(
    (request: ExportRequest) => {
      log(
        'onExport',
        describeEvent({
          rows: request.settings.rows,
          columns: request.settings.columns,
          format: request.format.id,
          rowIds: request.rowIds,
        }),
      )
      return new Promise<void>((resolve, reject) => {
        window.setTimeout(() => {
          if (settings.current.serverFailMode === 'always') {
            log('server', `export "${request.settings.rows}" failed`)
            reject(new Error('Export failed'))
            return
          }
          log('server', `export "${request.settings.rows}" ready`)
          resolve()
        }, settings.current.serverDelayMs)
      })
    },
    [log, settings],
  )
  const onExported = useCallback(
    (request: ExportRequest) =>
      log(
        'onExported',
        describeEvent({
          rows: request.settings.rows,
          rowCount: request.rowCount,
          filename: request.filename,
        }),
      ),
    [log],
  )

  return (
    <WithLog log={<CallbackLog entries={entries} onClear={clear} />}>
      <StoryComponent
        {...args}
        dataOverride={page}
        paginationServer
        paginationRowCount={TOTAL_ROWS}
        dataExportServer={true}
        onExport={onExport}
        onExported={onExported}
      />
    </WithLog>
  )
}
