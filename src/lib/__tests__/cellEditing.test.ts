/**
 * Headless-проверка плагина cellEditing — носителя ЛОКАЛЬНОГО состояния.
 * Проверяет: сгенерированная из `state` v9-фича seed'ит слайс плагина
 * и он записываем; кнопка регистрируется в rightCellSlot, владелец-редактор — в
 * cellSlot; хуки canEdit/onCellEdit/editor из аргументов фабрики читаются живо с дефолтами.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { constructTable } from '@tanstack/react-table'
import { storeReactivityBindings } from '../../../node_modules/@tanstack/table-core/dist/store-reactivity-bindings.js'
import { describe, expect, it, vi } from 'vitest'

import { buildTesseraFeatures, foldEntries, foldHooks } from '../core/features'
import { resolveHooks } from '../core/createHooks'
import { pluginStateKey, setPluginState } from '../core/definePlugin'
import { cellEditing } from '../plugins/cellEditing'

interface Person {
  id: string
  name: string
}

const makeTable = (opts = {}) => {
  const entries = [
    {
      id: 'reactivity',
      features: { coreReactivityFeature: storeReactivityBindings() },
    },
    cellEditing(opts),
  ]

  const features = buildTesseraFeatures(entries as never)
  const folded = foldEntries(entries)

  const table = constructTable({
    features,
    data: [{ id: '1', name: 'A' }] as Person[],
    columns: [{ id: 'name', accessorKey: 'name' }],
    getRowId: (row: Person) => row.id,
    ...folded.options,
    hooks: resolveHooks(foldHooks(entries)),
  } as never) as any

  return { table, folded }
}

describe('cellEditing', () => {
  it("state: сгенерированная фича seed'ит слайс cellEditing = null", () => {
    const { table } = makeTable()
    expect(table.atoms[pluginStateKey('cellEditing')].get()).toBe(null)
  })

  it('локальный слайс записывается через updater-опцию (реактивно)', () => {
    const { table } = makeTable()
    setPluginState(table, 'cellEditing', '1:name')
    expect(table.atoms[pluginStateKey('cellEditing')].get()).toBe('1:name')
  })

  it('кнопка регистрируется в правом слоте ячейки', () => {
    const { folded } = makeTable()
    expect(folded.slots.rightCellSlot.map(s => s.id)).toContain('cellEditing')
  })

  it('владелец контента регистрируется в cellSlot (замещение рендера в правке)', () => {
    const { folded } = makeTable()
    expect(folded.slots.cellSlot.map(s => s.id)).toContain('cellEditing')
  })

  it('editor (BYO) из аргументов фабрики читается живо; не задан — отсутствует в слайсе', () => {
    const editor = () => null
    const withEditor = resolveHooks(
      foldHooks([cellEditing({ editor })] as never),
    ) as any
    expect(withEditor.cellEditing.editor).toBe(editor)

    const withoutEditor = resolveHooks(
      foldHooks([cellEditing()] as never),
    ) as any
    expect(withoutEditor.cellEditing.editor).toBeUndefined()
  })

  it('хуки canEdit/onCellEdit из аргументов фабрики читаются живо; дефолты — no-op/true', () => {
    const onCellEdit = vi.fn()
    const resolved = resolveHooks(
      foldHooks([cellEditing({ onCellEdit })] as never),
    ) as any
    expect(resolved.cellEditing.onCellEdit).toBe(onCellEdit)
    // canEdit по умолчанию → true (кнопка показывается везде, где нет ограничения).
    expect(typeof resolved.cellEditing.canEdit).toBe('function')
    expect(resolved.cellEditing.canEdit({})).toBe(true)
  })

  it('canEdit из аргументов фабрики применяется (предикат по контексту)', () => {
    const canEdit = (ctx: { column: { id: string } }) =>
      ctx.column.id !== 'name'
    const resolved = resolveHooks(
      foldHooks([cellEditing({ canEdit })] as never),
    ) as any
    expect(resolved.cellEditing.canEdit({ column: { id: 'name' } })).toBe(false)
    expect(resolved.cellEditing.canEdit({ column: { id: 'age' } })).toBe(true)
  })
})
