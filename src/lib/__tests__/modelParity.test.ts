/**
 * Страж паритета клиентской и серверной моделей строк (ADR 0187; PY1–PY5): база против публичных
 * типов и диагностики на обеих моделях, плюс проверка самих сверок на испорченной базе.
 * Запуск: npx vitest run --config vitest.node.config.ts modelParity
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { serverRowModel } from '../plugins'

import { pluginFactories, pluginFactoryNames } from './builtinPlugins'
import {
  argumentProblems,
  behaviourProblems,
  debtProblems,
  differenceRecordProblems,
  inertProblems,
  type ModelStatus,
} from './modelParity.check'
import { BEHAVIOUR_DIFFERENCES, MODEL_PARITY } from './modelParity.baseline'
import { ENTRY, firstParamProps } from './publicTypes'
import { hostTable } from './tableHost'

const TYPES_TIMEOUT = 120_000
const ROOT = join(__dirname, '..', '..', '..')
const DECISIONS = join(ROOT, 'docs', 'decisions')
const COLUMNS = [{ id: 'name', accessorKey: 'name' }]

const adrFiles = readdirSync(DECISIONS)
const adrExists = (adr: number) =>
  adrFiles.some(file => file.startsWith(`${String(adr).padStart(4, '0')}-`))

const knownProblems = () => {
  const roadmap = readFileSync(join(ROOT, 'docs', 'roadmap.md'), 'utf8')
  return roadmap.split('## Известные проблемы')[1]?.split('\n## ')[0] ?? ''
}

const statusOf = (table: unknown, id: string) => {
  const entry = (
    table as {
      getPluginDiagnostics: () => {
        id: string
        status: string
        reason?: string
      }[]
    }
  )
    .getPluginDiagnostics()
    .find(item => item.id === id)
  return entry?.status === 'inert' ? `inert:${entry.reason}` : entry?.status
}

const modelStatuses = () => {
  const statuses: Record<string, ModelStatus> = {}
  for (const [name, factory] of pluginFactories()) {
    if (name === 'serverRowModel') continue
    const { id } = factory() as { id: string }
    statuses[name] = {
      client: String(
        statusOf(hostTable({ columns: COLUMNS, plugins: [factory()] }), id),
      ),
      server: String(
        statusOf(
          hostTable({
            columns: COLUMNS,
            data: [],
            plugins: [
              serverRowModel({ getRows: () => ({ rows: [], rowCount: 0 }) }),
              factory(),
            ],
          }),
          id,
        ),
      ),
    }
  }
  return statuses
}

describe('паритет моделей строк (ADR 0187)', () => {
  it(
    'PY1: каждый публичный аргумент каждой фабрики /plugins есть в базе, запись без аргумента роняет страж',
    () => {
      const actual = Object.fromEntries(
        pluginFactoryNames().map(name => [
          name,
          firstParamProps(ENTRY.plugins, name).map(prop => prop.name),
        ]),
      )
      expect(argumentProblems(MODEL_PARITY, actual)).toEqual([])
      expect(
        argumentProblems(
          { one: { same: ['a', 'gone'] } },
          { one: ['a', 'fresh'], two: [] },
        ).sort(),
      ).toEqual([
        'one.fresh: аргумента нет в базе',
        'one.gone: запись без аргумента',
        'two: нет в базе',
      ])
    },
    TYPES_TIMEOUT,
  )

  it('PY2: запись differs несёт причину и существующий ADR', () => {
    expect(differenceRecordProblems(MODEL_PARITY, adrExists)).toEqual([])
    expect(
      differenceRecordProblems(
        {
          one: {
            differs: {
              noReason: { reason: ' ', adr: 138 },
              noAdr: { reason: 'Причина различия', adr: 9999 },
            },
          },
        },
        adrExists,
      ),
    ).toEqual(['one.noReason: нет причины', 'one.noAdr: нет ADR 9999'])
  })

  it('PY3: запись debt ссылается на строку «Известных проблем» roadmap', () => {
    const known = knownProblems()
    expect(known).not.toBe('')
    expect(debtProblems(MODEL_PARITY, known)).toEqual([])
    expect(
      debtProblems(
        {
          one: {
            debt: {
              lost: { reason: 'Причина различия', roadmap: 'Нет такой записи' },
              found: {
                reason: 'Причина различия',
                roadmap: 'Свои модели строк опираются на внутренности TanStack',
              },
            },
          },
        },
        known,
      ),
    ).toEqual(['one.lost: нет в «Известных проблемах»'])
  })

  it('PY4: каждая фабрика монтируется на обеих моделях; инертность только в SSRM требует записи, запись — инертности', () => {
    expect(inertProblems(MODEL_PARITY, modelStatuses())).toEqual([])
    const inert = { reason: 'Причина различия', adr: 138 }
    expect(
      inertProblems(
        { stale: { inertOnServer: inert }, ok: { inertOnServer: inert } },
        {
          silent: { client: 'active', server: 'inert:serverRowModel' },
          stale: { client: 'active', server: 'active' },
          ok: { client: 'active', server: 'inert:serverRowModel' },
          split: { client: 'inert:noActions', server: 'active' },
        },
      ),
    ).toEqual([
      'silent: инертна в SSRM (inert:serverRowModel) без записи',
      'stale: запись об инертности устарела',
      'split: статусы моделей разошлись: inert:noActions / active',
    ])
  })

  it('PY5: различия поведения без аргумента несут те же поля, имена не повторяются', () => {
    expect(behaviourProblems(BEHAVIOUR_DIFFERENCES, adrExists)).toEqual([])
    expect(
      behaviourProblems(
        [
          { name: 'one', reason: 'Причина различия', adr: 138 },
          { name: 'one', reason: 'Причина различия', adr: 138 },
          { name: 'two', reason: '', adr: 9999 },
        ],
        adrExists,
      ),
    ).toEqual(['two: нет причины', 'two: нет ADR 9999', 'one: записано дважды'])
  })
})
