// @vitest-environment happy-dom
/**
 * Журнал отказов (ADR 0177, этап 2; JR4–JR5): объявление новых записей и уход решённых,
 * подписи журнала из словаря. JR1–JR3, JR6 — визуальные (`visual/failure-log`).
 * Запуск: npx vitest run --config vitest.node.config.ts failureLog
 */
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'

import { registerAnnouncer } from '../core/announcer'
import type { Failure } from '../core/failures/failuresFeature'
import {
  ENGLISH_LABELS,
  resolveLabels,
} from '../core/localization/resolveLabels'
import { unknownLabelKeys } from '../core/localization/pluginLabels'
import { useCreateTable } from '../core/useCreateTable'
import { failureLog } from '../plugins'
import { objectTargetText } from '../shared/objectTarget'
import ru from '../stories/__mocks__/localization.ru.json'
import { failureLogLabels } from '../plugins/failureLog/labels'

;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

const ROWS = ['r1', 'r2', 'r3'].map(id => ({ id, name: id }))
const columns = [{ id: 'name', accessorKey: 'name', header: 'Name' }]

let captured: any
let root: Root | undefined

afterEach(() => {
  act(() => root?.unmount())
  root = undefined
})

const Host = () => {
  captured = useCreateTable({
    columns: columns as never,
    data: ROWS,
    getRowId: (row: { id: string }) => row.id,
    plugins: [failureLog()],
  } as never)
  return null
}

const mount = () => {
  root = createRoot(document.createElement('div'))
  act(() => root!.render(createElement(Host)))
}

const tick = () => act(() => new Promise(resolve => setTimeout(resolve, 10)))

describe('Журнал отказов (ADR 0177)', () => {
  it('JR4: запись уходит сама, когда отказ решён; новая запись объявляется скринридеру', async () => {
    mount()
    const said: string[] = []
    registerAnnouncer(captured, {
      say: message => said.push(message),
      labels: ENGLISH_LABELS,
    })

    // Две записи в одном кадре — одно объявление с числом записей.
    act(() => {
      void captured
        .trackCellAction(
          { cell: ['r1', 'name'] },
          Promise.reject(new Error('No')),
        )
        .catch(() => {})
    })
    await tick()
    act(() => {
      captured.reportFailure({
        label: 'Archive',
        target: { row: 'r2' },
        reason: 'Locked',
      })
      captured.reportFailure({
        label: 'Archive',
        target: { row: 'r3' },
        reason: 'Locked',
      })
    })
    await tick()
    const logged = said.filter(text => text.startsWith('Failures in the log'))
    expect(logged).toEqual([
      failureLogLabels(ENGLISH_LABELS).announceFailureLogged(1),
      failureLogLabels(ENGLISH_LABELS).announceFailureLogged(3),
    ])

    // Решённый отказ уходит сам и объявления не даёт.
    await act(async () => {
      await captured.trackCellAction(
        { cell: ['r1', 'name'] },
        Promise.resolve(),
      )
    })
    await tick()
    expect(
      (captured.getFailures() as Failure[]).map(failure => failure.target),
    ).toEqual([{ row: 'r2' }, { row: 'r3' }])
    expect(
      said.filter(text => text.startsWith('Failures in the log')),
    ).toHaveLength(2)
  })

  it('JR5: подписи журнала — ключи словаря localization', () => {
    mount()
    // Ключи журнала — у плагина (ADR 0182, §8), цели — у ядра.
    const keys = [
      'failureLog.failureLog',
      'failureLog.failureLogEmpty',
      'failureLog.failureLogEmptyDescription',
      'failureLog.failureLogButton',
      'failureLog.failureClearAll',
      'failureLog.failureShow',
      'failureLog.failureClose',
      'failureTargetCell',
      'failureTargetRow',
      'failureTargetTable',
      'failureLog.announceFailureLogged',
    ]
    // Словарь знает ключи журнала; русский словарь историй задаёт каждый.
    expect(
      unknownLabelKeys(Object.fromEntries(keys.map(k => [k, 'x'])), [
        failureLogLabels,
      ]),
    ).toEqual([])
    for (const key of keys) expect(ru).toHaveProperty([key])

    const labels = resolveLabels(
      {
        failureTargetCell: '{column} / №{row}',
        failureTargetRow: 'Ряд {row}',
        failureTargetTable: 'Вся таблица',
        'failureLog.failureLogButton': 'Ошибок: {count}',
      },
      'ru-RU',
    )
    const failure = (target: Failure['target']): Failure => ({
      key: 'k',
      label: 'Действие',
      target,
      reason: 'r',
      time: 0,
    })
    expect(
      objectTargetText(
        captured,
        failure({ cell: ['r2', 'name'] }).target,
        labels,
      ),
    ).toBe('Name / №2')
    expect(
      objectTargetText(captured, failure({ row: 'r3' }).target, labels),
    ).toBe('Ряд 3')
    expect(
      objectTargetText(captured, failure({ table: true }).target, labels),
    ).toBe('Вся таблица')
    expect(failureLogLabels(labels).failureLogButton(4)).toBe('Ошибок: 4')
  })
})
