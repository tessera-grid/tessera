/**
 * Размещение встроенных кнопок тулбара аргументом фабрики (ADR 0205; TO1–TO3, TO6): поля
 * `toolbar` поверх слота, раскладка по правилам ADR 0051, `toolbar: false` и инертность, тип и
 * контролы историй. TO4 — `toolbarPlacement.dom`, TO5 — визуальный `toolbar-placement`.
 * Запуск: npx vitest run --config vitest.node.config.ts toolbarPlacement
 */
import { describe, expect, it } from 'vitest'

import type { PluginSlot } from '../core/createSlots'
import { foldEntries } from '../core/features'
import { resolveToolbarSides } from '../core/toolbar'
import { withViewSettingsButton } from '../core/viewSettings'
import {
  columnFiltering,
  columnVisibility,
  dataExport,
  failureLog,
  quickSearch,
  unsavedChanges,
} from '../plugins'
import { hideHeaderAction } from '../plugins/columnVisibility/hideHeaderAction'
import {
  dataGridArgTypes,
  dataGridDefaultArgs,
} from '../stories/__mocks__/utils/dataGridControls'
import { ENTRY, exportNames, firstParamProps, typeProps } from './publicTypes'
import { hostTable } from './tableHost'

const TYPES_TIMEOUT = 120_000

type ToolbarPluginSlot = Extract<PluginSlot, { slot: 'toolbarSlot' }>
type Entry = Parameters<typeof foldEntries>[0][number]

/** Фабрики с кнопкой тулбара (ADR 0205, «Решение»). */
const FACTORIES = {
  quickSearch,
  dataExport,
  unsavedChanges,
  failureLog,
} as unknown as Record<string, (options?: object) => Entry>

const toolbarSlotsOf = (entry: Entry) =>
  foldEntries([entry]).slots.toolbarSlot as ToolbarPluginSlot[]

const placementOf = (slot: ToolbarPluginSlot) => ({
  id: slot.id,
  group: slot.group,
  order: slot.order,
  align: slot.align,
})

const button = (id: string, extra: Partial<ToolbarPluginSlot> = {}): Entry => ({
  id: `app-${id}`,
  slots: [{ id, slot: 'toolbarSlot', component: () => null, ...extra }],
})

/** Стороны тулбара как [группа, [id кнопок]] — слева и справа. */
const layoutOf = (entries: Entry[]) => {
  // Кнопку «Настроек вида» ставит грид — тем же помощником (ADR 0215, VW1).
  const folded = foldEntries(entries)
  const table = {
    options: { viewSettingsSections: folded.viewSettingsSections },
  }
  const { start, end } = resolveToolbarSides(
    withViewSettingsButton(folded.slots.toolbarSlot, table, () => null),
  )
  const ids = (groups: typeof start) =>
    groups.map(group => [group.id, group.items.map(item => item.id)])
  return { start: ids(start), end: ids(end) }
}

describe('Размещение кнопок тулбара (ADR 0205)', () => {
  it('TO1: фабрики с кнопкой тулбара принимают toolbar: { group?, order?, align? }: заданное поле перекрывает размещение кнопки, незаданное — прежнее', () => {
    for (const [name, factory] of Object.entries(FACTORIES)) {
      const [own] = toolbarSlotsOf(factory())
      expect(own, name).toBeDefined()
      const base = placementOf(own!)

      const [group] = toolbarSlotsOf(factory({ toolbar: { group: 'app' } }))
      expect(placementOf(group!), name).toEqual({ ...base, group: 'app' })

      const [ordered] = toolbarSlotsOf(
        factory({ toolbar: { order: 'last', align: 'end' } }),
      )
      expect(placementOf(ordered!), name).toEqual({
        ...base,
        order: 'last',
        align: 'end',
      })

      const [all] = toolbarSlotsOf(
        factory({ toolbar: { group: 'mine', order: 7, align: 'start' } }),
      )
      expect(placementOf(all!), name).toEqual({
        id: base.id,
        group: 'mine',
        order: 7,
        align: 'start',
      })

      // Пустой объект — прежнее место.
      const [same] = toolbarSlotsOf(factory({ toolbar: {} }))
      expect(placementOf(same!), name).toEqual(base)
    }
  })

  it('TO2: перенесённая кнопка стоит по правилам раскладки ADR 0051: ранги встроенных групп прежние, в группе приложения — на месте групп приложения, внутри группы — по order', () => {
    // Выгрузка влево, в конец группы поиска.
    expect(
      layoutOf([
        dataExport({
          toolbar: { group: 'search', align: 'start', order: 'last' },
        }),
        columnVisibility(),
        columnFiltering(),
        quickSearch(),
      ]),
    ).toEqual({
      start: [['search', ['quickSearchField', 'exportButton']]],
      end: [['view', ['viewSettingsButton']]],
    })

    // Кнопка «Экспорт» в группе приложения: группа — на месте групп приложения (после встроенных,
    // перед журналом отказов, ADR 0051), кнопки в ней — по order.
    const app = [
      button('density', { group: 'app', order: 5 }),
      button('help', { group: 'app', order: 20 }),
    ]
    expect(
      layoutOf([
        dataExport({ toolbar: { group: 'app', order: 10 } }),
        ...app,
        failureLog(),
      ]).end,
    ).toEqual([
      ['app', ['density', 'exportButton', 'help']],
      ['failures', ['failureLogButton']],
    ])

    // Ранги встроенных групп не зависят от того, какие кнопки в них стоят: «Экспорт» в группе
    // `view` первым — группа `view` по-прежнему перед `data`.
    expect(
      layoutOf([
        unsavedChanges({ toolbar: { group: 'data', order: -1 } }),
        dataExport({ toolbar: { group: 'view', order: -1 } }),
        columnVisibility(),
      ]).end,
    ).toEqual([
      ['view', ['exportButton', 'viewSettingsButton']],
      ['data', ['unsavedChangesButton']],
    ])
  })

  it("TO3: toolbar: false — кнопки нет; плагин без другого интерфейса инертен с причиной 'noToolbar', у плагина с другими путями они остаются", () => {
    for (const [name, factory] of Object.entries(FACTORIES))
      expect(toolbarSlotsOf(factory({ toolbar: false })), name).toEqual([])

    const headerCtx = (table: any) =>
      table
        .getHeaderGroups()
        .flatMap((group: any) => group.headers)
        .find((h: any) => h.column.id === 'name')
        .getContext()
    const columns = [{ id: 'name', accessorKey: 'name', header: 'Name' }]

    // «Колонки» — единственный способ вернуть скрытое: без «Настроек вида» плагин инертен (ADR 0215).
    const visibility = columnVisibility()
    const withoutButton = hostTable({
      columns,
      viewSettingsToolbar: false,
      plugins: [visibility],
    })
    expect(visibility.diagnose?.(withoutButton)).toBe('noToolbar')
    expect(hideHeaderAction.visible!(headerCtx(withoutButton))).toBe(false)
    const withButton = hostTable({ columns, plugins: [columnVisibility()] })
    expect(columnVisibility().diagnose?.(withButton)).toBeUndefined()
    expect(hideHeaderAction.visible!(headerCtx(withButton))).toBe(true)

    // У остальных есть другие пути: кнопка фильтра в шапке, программная выгрузка и поиск,
    // кнопки сортировки и группировки в шапке, отметки черновиков и отказов в ячейках.
    for (const name of Object.keys(FACTORIES)) {
      const entry = FACTORIES[name]!({ toolbar: false }) as Entry & {
        diagnose?: (table: unknown) => unknown
      }
      const table = hostTable({ columns, plugins: [entry] })
      expect(entry.diagnose?.(table), name).toBeUndefined()
    }
    const exportTable = hostTable({
      columns,
      plugins: [dataExport({ toolbar: false })],
    }) as unknown as { exportData?: unknown }
    expect(typeof exportTable.exportData).toBe('function')
  })

  it(
    'TO6: тип ToolbarPlacement экспортируется из /plugins; у историй — контрол <фабрика>Toolbar по правилу ADR 0106, страж storyControls',
    () => {
      expect(exportNames(ENTRY.plugins)).toContain('ToolbarPlacement')
      expect(
        typeProps(ENTRY.plugins, 'ToolbarPlacement').map(prop => prop.name),
      ).toEqual(['group', 'order', 'align'])
      for (const name of Object.keys(FACTORIES)) {
        const toolbar = firstParamProps(ENTRY.plugins, name).find(
          prop => prop.name === 'toolbar',
        )
        expect(toolbar?.type, name).toBe('false | ToolbarPlacement')
        const control = `${name}Toolbar`
        expect(dataGridArgTypes, control).toHaveProperty(control)
        // По умолчанию — место библиотеки: аргумента нет.
        expect(
          (dataGridDefaultArgs as Record<string, unknown>)[control],
          control,
        ).toBeUndefined()
      }
    },
    TYPES_TIMEOUT,
  )
})
