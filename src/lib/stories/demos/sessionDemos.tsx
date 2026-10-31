/**
 * Демо сессий действий (ADR 0040) и асинхронного контракта (ADR 0041): грид с
 * журналом колбэков рядом. Данные демо держит само — как приложение, которое
 * владеет `data` и пишет в неё по колбэкам.
 */
import { useCallback, useRef, useState } from 'react'

import type { CellComponentProps } from '../../core/createSlots'
import { useLatest } from '../../util/useLatest'
import type { CellEditCancel, CellEditCommit, RowDragEnd } from '../../plugins'
import type { Row } from '../../types'
import { StoryComponent } from '../DataGridStory'
import type { StoryProps } from '../DataGridStory.types'
import { makeData } from '../__mocks__/data'
import { WithConsole } from './StoryConsole'
import { createConsoleLog, describeEvent } from './consoleLog'

type DemoRow = Record<string, unknown> & { id: string }

/** Какие колонки демо разрешает править (как в остальных историях). */
const EDITABLE_COLUMNS = ['age', 'visits', 'gender']
export const canEditDemoCell = (ctx: CellComponentProps) =>
  EDITABLE_COLUMNS.includes(ctx.column.id)

const panelRow = { display: 'flex', gap: 8, alignItems: 'center' } as const

/** Живое значение аргумента для колбэка, созданного один раз. */

/** Отказ демо-«сервера»: `always` — каждый запрос отклоняется. */
export type ServerFailMode = 'never' | 'always'

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
  const [consoleLog] = useState(createConsoleLog)
  const log = consoleLog.log
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
    <WithConsole
      log={consoleLog}
      args={args}
      actions={
        <>
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
        </>
      }
    >
      <StoryComponent {...args} dataOverride={data} onExpandRow={onExpandRow} />
    </WithConsole>
  )
}

// --- Перенос в ленивом дереве (ADR 0112) ---------------------------------------
// Сервер хранит дерево; клиенту уходят корни и дети по запросу. Перенос сохраняется
// с задержкой, «Reject next move» и `moveFailMode` — отказ и откат строки.

const ROOT = ''
type DemoNode = DemoRow & { childCount?: number; subRows?: DemoNode[] }

export interface RowDraggingLazyTreeDemoProps extends StoryProps {
  /** Задержка ответа `loadChildren`, мс. */
  loadDelayMs?: number
  /** Задержка сохранения переноса, мс. */
  moveDelayMs?: number
  /** `always` — сервер отклоняет каждый перенос. */
  moveFailMode?: ServerFailMode
}

export const RowDraggingLazyTreeDemo = ({
  loadDelayMs = 900,
  moveDelayMs = 900,
  moveFailMode = 'never',
  ...args
}: RowDraggingLazyTreeDemoProps) => {
  const [consoleLog] = useState(createConsoleLog)
  const log = consoleLog.log
  // «Сервер»: узлы по id и порядок детей по id родителя (корни — `ROOT`).
  const [server] = useState(() => {
    const nodes = new Map<string, DemoNode>()
    const children = new Map<string, string[]>()
    const walk = (list: DemoNode[], parentId: string) => {
      children.set(
        parentId,
        list.map(({ subRows, ...node }) => {
          nodes.set(node.id, node)
          if (subRows) walk(subRows, node.id)
          return node.id
        }),
      )
    }
    walk(
      makeData({
        shape: 'tree',
        count: 12,
        depth: 3,
        breadth: 3,
      }) as DemoNode[],
      ROOT,
    )
    const listOf = (parentId: string) =>
      (children.get(parentId) ?? []).map(id => ({
        ...nodes.get(id)!,
        childCount: children.get(id)?.length ?? 0,
      }))
    return { children, listOf }
  })
  const [roots] = useState(() => server.listOf(ROOT))
  const failNext = useRef({ load: false, move: false })
  const settings = useLatest({ loadDelayMs, moveDelayMs, moveFailMode })

  const hasChildren = useCallback(
    (row: Row<any, any>) => ((row.original as DemoNode).childCount ?? 0) > 0,
    [],
  )
  const loadChildren = useCallback(
    (row: Row<any, any>) => {
      log('loadChildren', describeEvent({ rowId: row.id }))
      return new Promise<DemoNode[]>((resolve, reject) => {
        window.setTimeout(() => {
          if (failNext.current.load) {
            failNext.current.load = false
            log('server', `children of ${row.id} failed to load`)
            reject(new Error('Server unavailable'))
            return
          }
          const rows = server.listOf(row.id)
          log('server', `children of ${row.id}: ${rows.length}`)
          resolve(rows)
        }, settings.current.loadDelayMs)
      })
    },
    [log, server, settings],
  )
  const onRowDragEnd = useCallback(
    (end: RowDragEnd) => {
      log('onRowDragEnd', `${describeEvent({ ...end })} → saving…`)
      return new Promise<void>((resolve, reject) => {
        window.setTimeout(() => {
          if (
            settings.current.moveFailMode === 'always' ||
            failNext.current.move
          ) {
            failNext.current.move = false
            log('server', `rejected the move of ${end.rowId}`)
            reject(new Error('Server rejected the move'))
            return
          }
          const from = server.children.get(end.previousParentId ?? ROOT) ?? []
          from.splice(from.indexOf(end.rowId), 1)
          const to = server.children.get(end.parentId ?? ROOT) ?? []
          to.splice(end.index, 0, end.rowId)
          server.children.set(end.parentId ?? ROOT, to)
          log(
            'server',
            `moved ${end.rowId} to ${end.parentId ?? 'root'} #${end.index}`,
          )
          resolve()
        }, settings.current.moveDelayMs)
      })
    },
    [log, server, settings],
  )

  const failButton = (kind: 'load' | 'move', label: string) => (
    <button
      type="button"
      onClick={() => {
        failNext.current[kind] = true
        log('server', `the next ${kind} will fail`)
      }}
    >
      {label}
    </button>
  )

  return (
    <WithConsole
      log={consoleLog}
      args={args}
      actions={
        <>
          <div style={panelRow}>
            {failButton('move', 'Reject next move')}
            {failButton('load', 'Fail next load')}
          </div>
        </>
      }
    >
      <StoryComponent
        {...args}
        dataOverride={roots}
        rowExpandingHasChildren={hasChildren}
        rowExpandingLoadChildren={loadChildren}
        onRowDragEnd={onRowDragEnd}
      />
    </WithConsole>
  )
}
