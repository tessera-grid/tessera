/**
 * Полнота панели Controls историй DataGrid: у каждого тумблера `FeatureToggles` есть
 * контрол в общей мете, кроме перечисленных ниже с причиной. Новый тумблер без
 * контрола роняет тест — панель не отстаёт от фич.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import type { TesseraFeatureEntry } from '../core/features'
import {
  type FeatureToggles,
  argsToPlugins,
} from '../stories/__mocks__/utils/argsToPlugins'
import {
  dataGridArgTypes,
  dataGridDefaultArgs,
} from '../stories/__mocks__/utils/dataGridControls'

/** Тумблеры без контрола: функции и колбэки контролом не задать. */
const WITHOUT_CONTROL: Record<string, string> = {
  rowExpandingHasChildren: 'функция',
  rowExpandingLoadChildren: 'функция',
  cellEditingCanEdit: 'функция',
  paginationServer: 'без имитации сервера ломает показ — своя история',
  paginationRowCount: 'только вместе с paginationServer',
  onColumnResizeEnd: 'колбэк',
  onColumnResizeCancel: 'колбэк',
  onColumnDragEnd: 'колбэк',
  onColumnDragCancel: 'колбэк',
  onRowDragEnd: 'колбэк',
  onRowDragCancel: 'колбэк',
  onCellEdit: 'колбэк',
  onEditCancel: 'колбэк',
  onConflict: 'колбэк',
}

/** Ключи интерфейса `FeatureToggles` из исходника маппера. */
const featureToggles = () => {
  const source = readFileSync(
    new URL('../stories/__mocks__/utils/argsToPlugins.ts', import.meta.url),
    'utf8',
  )
  const start = source.indexOf('export interface FeatureToggles')
  const body = source.slice(start, source.indexOf('\n}', start))
  return [...body.matchAll(/\n {2}(\w+)\??:/g)].map(match => match[1]!)
}

const entriesOf = (toggles: FeatureToggles): readonly TesseraFeatureEntry[] =>
  argsToPlugins(toggles)

describe('панель Controls историй DataGrid', () => {
  it('у каждого тумблера FeatureToggles есть контрол, кроме функций и колбэков', () => {
    const toggles = featureToggles()
    expect(toggles.length).toBeGreaterThan(40)
    const missing = toggles.filter(
      name => !(name in dataGridArgTypes) && !(name in WITHOUT_CONTROL),
    )
    expect(missing).toEqual([])
    const stale = Object.keys(WITHOUT_CONTROL).filter(
      name => !toggles.includes(name) || name in dataGridArgTypes,
    )
    expect(stale).toEqual([])
  })

  it('значения по умолчанию дают ту же настройку плагинов, что фабрики без аргументов', () => {
    const allOn = Object.fromEntries(
      featureToggles()
        .filter(name => name.startsWith('enable'))
        .map(name => [name, true]),
    )
    const bare = entriesOf(allOn)
    const withDefaults = entriesOf({ ...dataGridDefaultArgs, ...allOn })
    // Замыкания фабрик новые на каждый вызов — функции сравниваются по имени.
    const configured = (entries: readonly TesseraFeatureEntry[]) =>
      JSON.stringify(
        entries.map(entry => ({
          id: entry.id,
          options: entry.options,
          actionMenu: entry.actionMenu,
          slots: entry.slots?.map(slot => slot.id),
        })),
        (_, value: unknown) =>
          typeof value === 'function'
            ? `fn:${value.name}`
            : value === undefined
              ? 'undefined'
              : value,
        2,
      )
    expect(configured(withDefaults)).toEqual(configured(bare))
  })

  it('тумблер enableMultiSort выключает мультисорт и при заданном multiSortOptions', () => {
    const sorting = entriesOf({
      enableColumnSorting: true,
      enableMultiSort: false,
      multiSortOptions: { max: 2 },
    }).find(entry => entry.id === 'columnSorting')!
    expect(sorting.options?.enableMultiSort).toBe(false)
  })

  it('у каждого значения по умолчанию есть контрол', () => {
    expect(
      Object.keys(dataGridDefaultArgs).filter(
        name => !(name in dataGridArgTypes),
      ),
    ).toEqual([])
  })
})
