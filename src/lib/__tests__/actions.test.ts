/**
 * Фаза E — headless-проверка плагинов действий/меню (rowActions, headerActionMenu,
 * rowActionMenu). Это декларации + setup, поэтому проверяем свёртку foldEntries и
 * логику setup напрямую, без constructTable.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { describe, expect, it, vi } from 'vitest'

import { ROW_ACTIONS_COLUMN_ID } from '../core/createColumns/actionColumnParams'
import { foldEntries } from '../core/features'
import { headerActionMenu } from '../plugins/headerActionMenu'
import { rowActionMenu } from '../plugins/rowActionMenu'
import { rowActions } from '../plugins/rowActions'

describe('Фаза E — headerActionMenu / rowActionMenu', () => {
  it('headerActionMenu: дефолтная декларация (auto, 3, rightHeaderSlot)', () => {
    const { actionMenu } = foldEntries([headerActionMenu()])
    expect(actionMenu.rightHeaderSlot).toEqual({ mode: 'auto', threshold: 3 })
  })

  it('headerActionMenu: кастомные mode/threshold/slots', () => {
    const { actionMenu } = foldEntries([
      headerActionMenu({ mode: 'always', threshold: 5, slots: ['leftHeaderSlot', 'rightHeaderSlot'] }),
    ])
    expect(actionMenu.leftHeaderSlot).toEqual({ mode: 'always', threshold: 5 })
    expect(actionMenu.rightHeaderSlot).toEqual({ mode: 'always', threshold: 5 })
  })

  it('rowActionMenu: декларация для actionRowSlot (auto, 2)', () => {
    const { actionMenu } = foldEntries([rowActionMenu()])
    expect(actionMenu.actionRowSlot).toEqual({ mode: 'auto', threshold: 2 })
  })
})

describe('Фаза E — rowActions', () => {
  it('foldEntries: сервисная колонка действий (trailing, pin end always)', () => {
    const { serviceColumns, setups } = foldEntries([rowActions()])
    const column = serviceColumns.find(c => c.id === ROW_ACTIONS_COLUMN_ID)
    expect(column).toMatchObject({
      id: ROW_ACTIONS_COLUMN_ID,
      side: 'trailing',
      order: 0,
      pin: { side: 'end', when: 'always' },
    })
    expect(setups).toHaveLength(1)
  })

  it('setup: ширина по умолчанию (без rowActionMenu) через setColumnAutoSizing', () => {
    const { setups } = foldEntries([rowActions({ width: 140 })])
    const setColumnAutoSizing = vi.fn()
    setups[0]({ options: { actionMenu: {} }, setColumnAutoSizing })

    const updater = setColumnAutoSizing.mock.calls[0][0]
    expect(updater({})[ROW_ACTIONS_COLUMN_ID]).toBe(140)
  })

  it('setup: сужение до collapsedWidth, когда actionRowSlot схлопнут', () => {
    // Комбинация rowActions + rowActionMenu: actionMenu.actionRowSlot присутствует.
    const folded = foldEntries([rowActions({ collapsedWidth: 48 }), rowActionMenu()])
    const setColumnAutoSizing = vi.fn()
    folded.setups[0]({ options: { actionMenu: folded.actionMenu }, setColumnAutoSizing })

    const updater = setColumnAutoSizing.mock.calls[0][0]
    expect(updater({})[ROW_ACTIONS_COLUMN_ID]).toBe(48)
  })
})
