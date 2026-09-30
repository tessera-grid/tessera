/**
 * Демо сессий действий (ADR 0040) и асинхронного контракта (ADR 0041): грид с
 * журналом колбэков рядом. Данные демо держит само — как приложение, которое
 * владеет `data` и пишет в неё по колбэкам.
 */
import { useCallback, useRef, useState } from 'react'

import type { CellComponentProps } from '../../core/createSlots'
import type { CellEditCancel, CellEditCommit } from '../../plugins'
import type { Row } from '../../types'
import { StoryComponent } from '../DataGridStory'
import type { StoryProps } from '../DataGridStory.types'
import { makeData } from '../__mocks__/data'
import {
  CallbackLog,
  WithLog,
  describeEvent,
  useCallbackLog,
} from './CallbackLog'

type DemoRow = Record<string, unknown> & { id: string }

/** Какие колонки демо разрешает править (как в остальных историях). */
const EDITABLE_COLUMNS = ['age', 'visits', 'gender']
export const canEditDemoCell = (ctx: CellComponentProps) =>
  EDITABLE_COLUMNS.includes(ctx.column.id)

const writeCell = (
  rows: DemoRow[],
  { rowId, columnId, value }: CellEditCommit,
) => rows.map(row => (row.id === rowId ? { ...row, [columnId]: value } : row))

const panelRow = { display: 'flex', gap: 8, alignItems: 'center' } as const

/** Живое значение аргумента для колбэка, созданного один раз. */
const useLatest = <T,>(value: T) => {
  const ref = useRef(value)
  ref.current = value
  return ref
}

// --- 1. Правка с сервером (ADR 0041) ------------------------------------------

export type ServerFailMode = 'never' | 'always'

export interface CellEditingServerDemoProps extends StoryProps {
  /** Задержка ответа сервера, мс. */
  serverDelayMs?: number
  /** `always` — сервер отклоняет каждое сохранение. */
  serverFailMode?: ServerFailMode
}

export const CellEditingServerDemo = ({
  serverDelayMs = 1500,
  serverFailMode = 'never',
  ...args
}: CellEditingServerDemoProps) => {
  const { entries, log, clear } = useCallbackLog()
  const [data, setData] = useState<DemoRow[]>(
    () => makeData({ shape: 'flat', count: 30 }) as DemoRow[],
  )
  const failNext = useRef(false)
  const settings = useLatest({ serverDelayMs, serverFailMode })

  const onCellEdit = useCallback(
    (commit: CellEditCommit) => {
      log('onCellEdit', `${describeEvent({ ...commit })} → saving…`)
      return new Promise<void>((resolve, reject) => {
        window.setTimeout(() => {
          const { serverFailMode: mode } = settings.current
          if (mode === 'always' || failNext.current) {
            failNext.current = false
            log('server', `rejected ${commit.columnId} of ${commit.rowId}`)
            reject(new Error('Server rejected the value'))
            return
          }
          // Данные обновляются до выполнения промиса — старое значение не мелькнёт.
          setData(prev => writeCell(prev, commit))
          log('server', `saved ${commit.columnId} of ${commit.rowId}`)
          resolve()
        }, settings.current.serverDelayMs)
      })
    },
    [log, settings],
  )

  const onEditCancel = useCallback(
    (end: CellEditCancel) => log('onEditCancel', describeEvent({ ...end })),
    [log],
  )

  return (
    <WithLog
      log={
        <CallbackLog entries={entries} onClear={clear}>
          <div style={panelRow}>
            <button
              type="button"
              onClick={() => {
                failNext.current = true
                log('server', 'the next save will be rejected')
              }}
            >
              Reject next save
            </button>
          </div>
        </CallbackLog>
      }
    >
      <StoryComponent
        {...args}
        dataOverride={data}
        cellEditingCanEdit={canEditDemoCell}
        onCellEdit={onCellEdit}
        onEditCancel={onEditCancel}
      />
    </WithLog>
  )
}

// --- 2. Сессии правки (ADR 0040) ----------------------------------------------

export interface CellEditingSessionsDemoProps extends StoryProps {
  /** `block` — значение, изменённое извне во время правки, не сохраняется. */
  conflictMode?: 'commit' | 'block'
}

export const CellEditingSessionsDemo = ({
  conflictMode = 'commit',
  ...args
}: CellEditingSessionsDemoProps) => {
  const { entries, log, clear } = useCallbackLog()
  const [data, setData] = useState<DemoRow[]>(
    () => makeData({ shape: 'flat', count: 300 }) as DemoRow[],
  )

  const onCellEdit = useCallback(
    (commit: CellEditCommit) => {
      log('onCellEdit', describeEvent({ ...commit }))
      setData(prev => writeCell(prev, commit))
    },
    [log],
  )
  const onEditCancel = useCallback(
    (end: CellEditCancel) => log('onEditCancel', describeEvent({ ...end })),
    [log],
  )
  // Значение меняется «извне» — как обновление в реальном времени с сервера.
  const changeExternally = () => {
    const [first, ...rest] = data
    const age = Number(first.age) + 1
    log('external', `${first.id} age → ${age}`)
    setData([{ ...first, age }, ...rest])
  }

  return (
    <WithLog
      log={
        <CallbackLog entries={entries} onClear={clear}>
          <div style={panelRow}>
            {/* Не забирает фокус: иначе потеря фокуса сохранила бы правку до
                изменения извне (ADR 0040, §3), и конфликта не случилось бы. */}
            <button
              type="button"
              onMouseDown={event => event.preventDefault()}
              onClick={changeExternally}
            >
              Change first row age externally
            </button>
          </div>
        </CallbackLog>
      }
    >
      <StoryComponent
        {...args}
        dataOverride={data}
        cellEditingCanEdit={canEditDemoCell}
        onCellEdit={onCellEdit}
        onEditCancel={onEditCancel}
        onConflict={conflictMode}
      />
    </WithLog>
  )
}

// --- 3. Колбэки перетаскивания и ресайза (ADR 0040) ---------------------------

export const SessionCallbacksDemo = (args: StoryProps) => {
  const { entries, log, clear } = useCallbackLog()
  const logged =
    (name: string) =>
    (payload: object): void =>
      log(name, describeEvent({ ...payload }))
  const [callbacks] = useState(() => ({
    onRowDragEnd: logged('onRowDragEnd'),
    onRowDragCancel: logged('onRowDragCancel'),
    onColumnDragEnd: logged('onColumnDragEnd'),
    onColumnDragCancel: logged('onColumnDragCancel'),
    onColumnResizeEnd: logged('onColumnResizeEnd'),
    onColumnResizeCancel: logged('onColumnResizeCancel'),
  }))

  return (
    <WithLog log={<CallbackLog entries={entries} onClear={clear} />}>
      <StoryComponent {...args} {...callbacks} />
    </WithLog>
  )
}

// --- 4. Ленивое раскрытие (ADR 0041) ------------------------------------------

export interface RowExpandingLazyDemoProps extends StoryProps {
  /** Задержка «подгрузки» потомков, мс. */
  loadDelayMs?: number
  /** `always` — подгрузка каждый раз падает. */
  loadFailMode?: ServerFailMode
}

export const RowExpandingLazyDemo = ({
  loadDelayMs = 1200,
  loadFailMode = 'never',
  ...args
}: RowExpandingLazyDemoProps) => {
  const { entries, log, clear } = useCallbackLog()
  const [data] = useState(() =>
    makeData({ shape: 'tree', count: 12, depth: 2, breadth: 3 }),
  )
  const failNext = useRef(false)
  const settings = useLatest({ loadDelayMs, loadFailMode })

  const onExpandRow = useCallback(
    (row: Row<any, any>, expanded: boolean) => {
      log('onExpandRow', describeEvent({ rowId: row.id, expanded }))
      if (!expanded) {
        return
      }
      return new Promise<void>((resolve, reject) => {
        window.setTimeout(() => {
          if (settings.current.loadFailMode === 'always' || failNext.current) {
            failNext.current = false
            log('server', `children of ${row.id} failed to load`)
            reject(new Error('Load failed'))
            return
          }
          log('server', `children of ${row.id} loaded`)
          resolve()
        }, settings.current.loadDelayMs)
      })
    },
    [log, settings],
  )

  return (
    <WithLog
      log={
        <CallbackLog entries={entries} onClear={clear}>
          <div style={panelRow}>
            <button
              type="button"
              onClick={() => {
                failNext.current = true
                log('server', 'the next load will fail')
              }}
            >
              Fail next load
            </button>
          </div>
        </CallbackLog>
      }
    >
      <StoryComponent {...args} dataOverride={data} onExpandRow={onExpandRow} />
    </WithLog>
  )
}
