/**
 * Полнота панели Controls историй DataGrid: у каждого тумблера `FeatureToggles` есть
 * контрол в общей мете, кроме перечисленных ниже с причиной. Новый тумблер без
 * контрола роняет тест — панель не отстаёт от фич.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

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

  it('у каждого значения по умолчанию есть контрол', () => {
    expect(
      Object.keys(dataGridDefaultArgs).filter(
        name => !(name in dataGridArgTypes),
      ),
    ).toEqual([])
  })
})
