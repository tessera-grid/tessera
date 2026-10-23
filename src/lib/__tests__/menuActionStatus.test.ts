import { describe, expect, it, vi } from 'vitest'

import {
  type ActionStatus,
  type MenuAction,
  actionErrorText,
  resolveAvailability,
  runMenuAction,
  startAvailabilityChecks,
} from '../core/headerActions'
import { ENGLISH_LABELS } from '../core/localization'

// Асинхронные действия меню (ADR 0078): текст отказа (MI15) и неизменность
// синхронного контракта (MI22).

const action = (rest: Partial<MenuAction> = {}): MenuAction => ({
  id: 'remove',
  icon: () => null,
  label: () => 'Remove',
  onSelect: () => {},
  ...rest,
})

const fakeTable = () => {
  let status: ActionStatus = {}
  const setActionStatus = vi.fn(
    (updater: (prev: ActionStatus) => ActionStatus) => {
      status = updater(status)
    },
  )
  return {
    atoms: { actionStatus: { get: () => status, set: () => {} } },
    setActionStatus,
    status: () => status,
  }
}

describe('menuActionStatus', () => {
  it('MI15: текст ошибки — errorMessage, иначе Error.message или строка отказа, иначе actionFailedFallback', () => {
    const ctx = {}
    const own = action({
      errorMessage: (_ctx, error) =>
        error instanceof Error && error.message === 'E_LOCK'
          ? 'Locked by Bob'
          : undefined,
    })
    expect(actionErrorText(own, ctx, new Error('E_LOCK'), ENGLISH_LABELS)).toBe(
      'Locked by Bob',
    )
    expect(actionErrorText(own, ctx, new Error('down'), ENGLISH_LABELS)).toBe(
      'down',
    )
    expect(actionErrorText(action(), ctx, 'timeout', ENGLISH_LABELS)).toBe(
      'timeout',
    )
    expect(actionErrorText(action(), ctx, new Error(''), ENGLISH_LABELS)).toBe(
      ENGLISH_LABELS.actionFailedFallback,
    )
    expect(actionErrorText(action(), ctx, { code: 1 }, ENGLISH_LABELS)).toBe(
      ENGLISH_LABELS.actionFailedFallback,
    )
  })

  it('MI22: синхронный disabled и onSelect без результата ведут себя как прежде — состояния actionStatus нет', () => {
    const table = fakeTable()
    const ctx = { table, row: { id: 'r1' }, column: { id: 'name' } }
    const onSelect = vi.fn()
    const sync = action({ onSelect, disabled: () => true })

    runMenuAction(sync, ctx)
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(table.setActionStatus).not.toHaveBeenCalled()

    // Сессия проверки не забирает синхронные значения — рендер читает их живыми.
    const signal = new AbortController().signal
    expect(startAvailabilityChecks([sync], ctx, signal, () => {})).toEqual({})
    expect(resolveAvailability(sync, ctx, {})).toEqual({
      disabled: true,
      checking: false,
      block: { kind: 'forbidden' },
      checkFailed: false,
    })
    let allowed = false
    const live = action({ id: 'live', disabled: () => !allowed })
    expect(resolveAvailability(live, ctx, {}).disabled).toBe(true)
    allowed = true
    expect(resolveAvailability(live, ctx, {}).disabled).toBe(false)
    expect(table.status()).toEqual({})
  })
})
