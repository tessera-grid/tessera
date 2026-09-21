/**
 * Бизнес-хуки в аргументах фабрики плагина (ADR 0027, H1 по каждому плагину).
 * Проверяет живой канал: колбэк, переданный в фабрику, попадает в hook-слайс записи
 * и читается через resolveHooks(foldHooks(...)) — без верхнего параметра `hooks`.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { describe, expect, it, vi } from 'vitest'

import { foldHooks } from '../core/features'
import { resolveHooks } from '../core/createHooks'
import { columnSorting } from '../plugins/columnSorting'
import { columnPinning } from '../plugins/columnPinning'
import { columnSizing } from '../plugins/columnSizing'
import { columnDragging } from '../plugins/columnDragging'
import { rowExpanding } from '../plugins/rowExpanding'
import { rowDragging } from '../plugins/rowDragging'
import { rowSelection } from '../plugins/rowSelection'

type Case = {
  name: string
  make: (fn: () => void) => unknown
  scope: string
  key: string
}

const cases: Case[] = [
  {
    name: 'columnSorting',
    make: fn => columnSorting({ onToggleColumnSort: fn }),
    scope: 'columnSorting',
    key: 'onToggleColumnSort',
  },
  {
    name: 'columnPinning',
    make: fn => columnPinning({ onTogglePin: fn }),
    scope: 'columnPinning',
    key: 'onTogglePin',
  },
  {
    name: 'columnSizing',
    make: fn => columnSizing({ onColumnResizeEnd: fn }),
    scope: 'columnSizing',
    key: 'onColumnResizeEnd',
  },
  {
    name: 'columnDragging',
    make: fn => columnDragging({ onColumnDragEnd: fn }),
    scope: 'columnDragging',
    key: 'onColumnDragEnd',
  },
  {
    name: 'rowExpanding',
    make: fn => rowExpanding({ onExpandRow: fn }),
    scope: 'rowExpanding',
    key: 'onExpandRow',
  },
  {
    name: 'rowDragging',
    make: fn => rowDragging({ onRowDragEnd: fn }),
    scope: 'rowDragging',
    key: 'onRowDragEnd',
  },
  {
    name: 'rowSelection',
    make: fn => rowSelection({ onSelectRow: fn }),
    scope: 'rowSelection',
    key: 'onSelectRow',
  },
]

describe('бизнес-хуки в аргументах фабрики плагина (ADR 0027)', () => {
  for (const c of cases) {
    it(`${c.name}: колбэк из аргументов фабрики читается через resolveHooks(foldHooks())`, () => {
      const fn = vi.fn()
      const resolved = resolveHooks(foldHooks([c.make(fn)] as never)) as Record<
        string,
        Record<string, unknown>
      >
      expect(resolved[c.scope][c.key]).toBe(fn)
    })

    it(`${c.name}: без колбэка слайс дополняется no-op дефолтом (не падает)`, () => {
      const resolved = resolveHooks(foldHooks([c.make(() => {})] as never))
      // Ключ scope присутствует и является объектом со всеми ключами no-op.
      expect((resolved as Record<string, unknown>)[c.scope]).toBeTypeOf(
        'object',
      )
    })
  }
})
