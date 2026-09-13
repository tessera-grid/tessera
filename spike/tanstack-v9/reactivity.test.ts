/**
 * СПАЙК v9 — ЗАПУСКАЕМОЕ доказательство гранулярности состояния (ядро мотивации
 * миграции: снос собственного Pub-Sub, ADR 0007).
 *
 * Таблица строится HEADLESS через `constructTable` + `storeReactivityBindings()`
 * (не-render-phase биндинг: атомы нотифицируют синхронно, без хоста-React).
 * Проверяем: изменение ОДНОГО среза (`sorting`) не трогает идентичность другого
 * (`columnVisibility`). Именно на референсной стабильности незатронутого среза
 * держится `useSelector(table.atoms.columnVisibility)` — он бы НЕ перерисовался.
 *
 * Запуск:  npx vitest run --config spike/tanstack-v9/vitest.config.ts
 */
import {
  columnVisibilityFeature,
  constructTable,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_alphanumeric,
  tableFeatures,
} from '@tanstack/table-v9'
// storeReactivityBindings не реэкспортится react-адаптером — берём из вложенного
// core по прямому пути (приём спайка; в реальной миграции ядро даст свой биндинг).
// @ts-expect-error — deep-import по файловому пути (минует exports-гейт), без типов
import { storeReactivityBindings } from '../../node_modules/@tanstack/table-v9/node_modules/@tanstack/table-core/dist/store-reactivity-bindings.js'
import { describe, expect, it } from 'vitest'

interface Person {
  id: string
  name: string
}

const makeTable = () => {
  const features = tableFeatures({
    coreReactivityFeature: storeReactivityBindings(),
    rowSortingFeature,
    columnVisibilityFeature,
    sortedRowModel: createSortedRowModel(),
    sortFns: { alphanumeric: sortFn_alphanumeric },
  })

  return constructTable({
    features,
    data: [
      { id: '1', name: 'Борис' },
      { id: '2', name: 'Анна' },
    ] as Person[],
    columns: [{ id: 'name', accessorKey: 'name', sortFn: 'alphanumeric' }],
    getRowId: (row: Person) => row.id,
  } as never) as any
}

describe('v9 гранулярность состояния (замена Pub-Sub)', () => {
  it('смена sorting не меняет идентичность среза columnVisibility', () => {
    const table = makeTable()

    const before = table.store.state
    table.setSorting([{ id: 'name', desc: false }])
    const after = table.store.state

    // Затронутый срез — новая идентичность.
    expect(after.sorting).not.toBe(before.sorting)
    expect(after.sorting).toEqual([{ id: 'name', desc: false }])
    // Незатронутый срез — ТА ЖЕ идентичность → подписчик на него не перерисуется.
    expect(after.columnVisibility).toBe(before.columnVisibility)
  })

  it('per-slice атом нотифицирует только свой срез', () => {
    const table = makeTable()

    let sortingNotifs = 0
    let visibilityNotifs = 0
    table.atoms.sorting.subscribe(() => {
      sortingNotifs++
    })
    table.atoms.columnVisibility.subscribe(() => {
      visibilityNotifs++
    })

    // База после подписки (subscribe может эмитить текущее значение).
    const sortingBase = sortingNotifs
    const visibilityBase = visibilityNotifs

    table.setSorting([{ id: 'name', desc: true }])

    expect(sortingNotifs).toBeGreaterThan(sortingBase)
    expect(visibilityNotifs).toBe(visibilityBase)
  })

  it('сортировка реально переупорядочивает модель строк', () => {
    const table = makeTable()

    table.setSorting([{ id: 'name', desc: false }])
    const names = table.getRowModel().rows.map((r: any) => r.original.name)

    expect(names).toEqual(['Анна', 'Борис'])
  })
})
