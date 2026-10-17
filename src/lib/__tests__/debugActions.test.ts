/**
 * Канал действий грида (ADR 0125): без слушателя — ничего не строится, итог промиса —
 * отдельное действие с `cause`, перечень плагинов в ADR — по экспортам `/plugins`.
 * Запуск: npx vitest run --config vitest.node.config.ts debugActions
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import {
  type ActionReport,
  type DebugAction,
  createActionReporter,
  reportOutcome,
} from '../core/debugActions'
import { builtinPluginEntries } from './builtinPlugins'

/** Таблица с каналом: `reportAction` из `commonFeature` и собранные действия. */
const tableWith = (listener?: (action: DebugAction) => void) => {
  const table = {} as {
    reportAction: (report: ActionReport) => number | undefined
  }
  table.reportAction = createActionReporter(() => listener)
  return table
}

describe('канал действий (ADR 0125)', () => {
  it('AL3: без onDebugAction reportAction возвращает undefined и не вызывает detail-функцию', () => {
    const detail = vi.fn(() => ({ big: true }))
    const table = tableWith()
    expect(
      table.reportAction({
        plugin: 'columnSorting',
        action: 'toggleSort',
        detail,
      }),
    ).toBeUndefined()
    expect(detail).not.toHaveBeenCalled()

    // Со слушателем — функция вызывается один раз, номер растёт с 1.
    const seen: DebugAction[] = []
    const listened = tableWith(action => seen.push(action))
    expect(
      listened.reportAction({
        plugin: 'columnSorting',
        action: 'toggleSort',
        detail,
      }),
    ).toBe(1)
    expect(detail).toHaveBeenCalledTimes(1)
    expect(seen[0]).toMatchObject({
      id: 1,
      detail: { big: true },
      source: 'api',
    })
  })

  it('AL7: reportOutcome сообщает итог промиса действием <action>Resolved или <action>Rejected с cause; синхронный результат итога не даёт', async () => {
    const seen: DebugAction[] = []
    const table = tableWith(action => seen.push(action))

    // Причина по умолчанию — последнее действие этой задачи.
    table.reportAction({
      plugin: 'rowDragging',
      action: 'drop',
      source: 'pointer',
    })
    const saved = Promise.resolve()
    // Плагину может прийти копия таблицы — причина та же.
    reportOutcome(
      { ...table },
      { plugin: 'rowDragging', action: 'commitMove' },
      saved,
    )
    const failed = Promise.reject(new Error('Сервер отказал'))
    failed.catch(() => {})
    reportOutcome(
      table,
      { plugin: 'rowDragging', action: 'commitMove', cause: 7 },
      failed,
    )
    reportOutcome(
      table,
      { plugin: 'rowDragging', action: 'commitMove' },
      'sync',
    )
    await saved
    await failed.catch(() => {})
    await Promise.resolve()

    expect(
      seen.map(({ id, action, source, cause, detail }) => ({
        id,
        action,
        source,
        cause,
        detail,
      })),
    ).toEqual([
      {
        id: 1,
        action: 'drop',
        source: 'pointer',
        cause: undefined,
        detail: undefined,
      },
      {
        id: 2,
        action: 'commitMoveResolved',
        source: 'auto',
        cause: 1,
        detail: undefined,
      },
      {
        id: 3,
        action: 'commitMoveRejected',
        source: 'auto',
        cause: 7,
        detail: 'Сервер отказал',
      },
    ])
  })

  it('AL8: у каждого встроенного плагина (экспорта /plugins) есть строка перечня ADR 0125; в перечне нет неизвестных плагинов', () => {
    const adr = readFileSync(
      join(
        __dirname,
        '..',
        '..',
        '..',
        'docs',
        'decisions',
        '0125-debug-actions.md',
      ),
      'utf8',
    )
    const listed = new Set<string>()
    let inTable = false
    for (const line of adr.split(/\r?\n/)) {
      if (!line.startsWith('|')) {
        inTable = false
        continue
      }
      const first = line.split('|')[1]!.trim()
      if (first === 'Плагин') {
        inTable = true
        continue
      }
      if (!inTable || /^-+$/.test(first) || first.startsWith('ядро')) continue
      for (const name of first.split(','))
        listed.add(name.replace(/`/g, '').trim())
    }
    const builtin = builtinPluginEntries().map(entry => entry.id)
    expect(builtin.filter(id => !listed.has(id))).toEqual([])
    expect([...listed].filter(id => !builtin.includes(id))).toEqual([])
  })
})
