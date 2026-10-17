/**
 * Реестр заглушек пустой таблицы (ADR 0123): выбор записи, записи ядра и плагинов,
 * порядок встроенных. Запуск: npx vitest run --config vitest.node.config.ts stubs
 */
import { describe, expect, it } from 'vitest'

import { foldEntries } from '../core/features'
import {
  type StubContext,
  type StubEntry,
  resolveStub,
  stubEntriesOf,
} from '../core/stubs'
import { columnFiltering } from '../plugins/columnFiltering'
import { columnFilteringModel } from '../plugins/columnFilteringModel'
import { columnVisibility } from '../plugins/columnVisibility'
import { quickSearch } from '../plugins/quickSearch'
import { quickSearchModel } from '../plugins/quickSearchModel'

const entry = (
  id: string,
  priority: number,
  when: StubEntry['when'],
): StubEntry => ({
  id,
  priority,
  placement: 'grid',
  when,
  title: () => id,
})

const CONTEXT: StubContext = {
  table: {},
  rowCount: 0,
  loadError: { shown: false, error: undefined, pending: false },
}

/** Таблица с записями плагинов из набора, как её видит грид. */
const tableOf = (plugins: unknown[]) => ({
  options: { stubEntries: foldEntries(plugins as never).stubEntries },
})
const idsOf = (plugins: unknown[]) =>
  stubEntriesOf(tableOf(plugins)).map(item => item.id)

describe('реестр заглушек (ADR 0123)', () => {
  it('ES1: грид показывает первую по приоритету запись с выполненным when; без подходящей — никакой', () => {
    const entries = [
      entry('first', 1, () => false),
      entry('second', 2, () => true),
      entry('third', 3, () => true),
    ]
    expect(resolveStub(entries, CONTEXT)?.id).toBe('second')
    expect(
      resolveStub([entry('none', 1, () => false)], CONTEXT),
    ).toBeUndefined()
    // Падение условия записи плагина не роняет выбор: запись пропускается.
    const broken = entry('broken', 0, () => {
      throw new Error('plugin bug')
    })
    expect(resolveStub([broken, ...entries], CONTEXT)?.id).toBe('second')
  })

  it('ES2: записи ядра — loadError, noColumns, noData; filtered — только с моделью фильтрации или поиска, columnsHidden — только с columnVisibility', () => {
    expect(idsOf([]).sort()).toEqual(['loadError', 'noColumns', 'noData'])
    expect(idsOf([columnFilteringModel()])).toContain('filtered')
    expect(idsOf([quickSearchModel()])).toContain('filtered')
    // Интерфейсы включают модели; запись одна на набор.
    expect(
      idsOf([columnFiltering(), quickSearch()]).filter(id => id === 'filtered'),
    ).toHaveLength(1)
    expect(idsOf([columnVisibility()])).toContain('columnsHidden')
    expect(idsOf([columnVisibility()])).not.toContain('filtered')
    expect(idsOf([columnFilteringModel()])).not.toContain('columnsHidden')
    // Выключенный плагин свою запись не приносит.
    expect(idsOf([columnVisibility({ enabled: false })])).not.toContain(
      'columnsHidden',
    )
  })

  it('ES3: порядок встроенных — loadError → columnsHidden → noColumns → filtered → noData', () => {
    expect(
      idsOf([columnFiltering(), quickSearch(), columnVisibility()]),
    ).toEqual(['loadError', 'columnsHidden', 'noColumns', 'filtered', 'noData'])
  })
})
