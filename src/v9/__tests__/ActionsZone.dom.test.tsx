// @vitest-environment happy-dom
/**
 * Cutover — render-тест v9 ActionsZone (happy-dom): дескрипторы слота рисуются
 * инлайн-кнопками; при достижении порога — схлопывание в кебаб-триггер.
 * Base UI кебаб-попап — на cutover; здесь проверяем решение о подаче.
 * Запуск: npx vitest run --config vitest.v9.config.ts
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { constructTable } from '@tanstack/table-v9'
import { storeReactivityBindings } from '../../../node_modules/@tanstack/table-v9/node_modules/@tanstack/table-core/dist/store-reactivity-bindings.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { buildTesseraFeatures, foldEntries } from '../core/features'
import { columnSorting } from '../plugins/columnSorting'
import { columnPinning } from '../plugins/columnPinning'
import { headerActionMenu } from '../plugins/headerActionMenu'
import { ActionsZone } from '../grid/headerActions/ActionsZone'
import { DEFAULT_LABELS } from '../../lib/core/localization'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const makeTable = (extra: any[] = []) => {
  const entries = [
    { id: 'reactivity', slot: { coreReactivityFeature: storeReactivityBindings() } },
    columnSorting(),
    columnPinning(),
    ...extra,
  ]
  const features = buildTesseraFeatures(entries as never)
  const folded = foldEntries(entries)
  return constructTable({
    features,
    data: [{ id: '1', name: 'X' }],
    columns: [{ id: 'name', accessorKey: 'name', cell: (i: any) => String(i.getValue()) }],
    getRowId: (row: any) => row.id,
    hooks: {
      columnSorting: { onToggleColumnSort: () => {} },
      columnPinning: { onTogglePin: () => {} },
    },
    slots: folded.slots,
    slotActions: folded.slotActions,
    actionMenu: folded.actionMenu,
    ...folded.options,
  } as never) as any
}

const headerContext = (table: any) =>
  table.getHeaderGroups()[0].headers[0].getContext()

let container: HTMLElement
let root: ReturnType<typeof createRoot>
beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('Cutover — ActionsZone (v9, happy-dom)', () => {
  it('без плагина-меню: дескрипторы (pin, sort) рисуются инлайн', () => {
    const table = makeTable()
    act(() => {
      root.render(<ActionsZone slot="rightHeaderSlot" context={headerContext(table)} />)
    })
    // Две инлайн-кнопки (pin + sort), кебаба нет.
    expect(container.querySelectorAll('button[aria-label]').length).toBe(2)
    expect(container.querySelector('[data-kebab-trigger]')).toBeNull()
  })

  it('порог достигнут (headerActionMenu threshold 2): схлопывание в кебаб', () => {
    const table = makeTable([headerActionMenu({ threshold: 2 })])
    act(() => {
      root.render(<ActionsZone slot="rightHeaderSlot" context={headerContext(table)} />)
    })
    // Схлопывание → реальный Base UI-кебаб (триггер-кнопка с aria-label headerMenu),
    // инлайн-кнопки pin/sort ушли в меню (портал, до открытия не в DOM).
    const kebab = container.querySelector(
      `button[aria-label="${DEFAULT_LABELS.headerMenu}"]`,
    )
    expect(kebab).toBeTruthy()
    // Инлайн-дескрипторов в зоне не осталось (только триггер кебаба).
    expect(container.querySelectorAll('button[aria-label]').length).toBe(1)
  })
})
