/**
 * «Настройки вида» без таблицы (ADR 0215): место кнопки (VW1), договор раздела автора (VW8), снятые
 * сводки и кнопка «Колонки» (VW9). VW10, VW15 — `viewSettings.dom`.
 * Запуск: npx vitest run --project unit viewSettings
 */
import { describe, expect, it } from 'vitest'

import { definePlugin } from '../core/definePlugin'
import { foldEntries } from '../core/features'
import { resolveToolbarSides } from '../core/toolbar'
import {
  type ViewSettingsSection,
  viewSettingsSectionsOf,
  withViewSettingsButton,
} from '../core/viewSettings'
import {
  columnFiltering,
  columnSorting,
  columnVisibility,
  dataExport,
  rowGrouping,
} from '../plugins'
import { columnVisibilityInertReason } from '../plugins/columnVisibility/inertReason'
import { tableLabels } from '../stories/__tests__/labels'
import { preloadable } from '../util/preloadable'
import { ENTRY, exportedTypeNames, firstParamProps } from './publicTypes'

const TYPES_TIMEOUT = 120_000

const ids = (sections: readonly ViewSettingsSection[]) =>
  sections.map(section => section.id)

/** Стороны тулбара с кнопкой «Настроек вида»: [группа, [id кнопок]]. */
const layoutOf = (
  entries: Parameters<typeof foldEntries>[0],
  options: Record<string, unknown> = {},
) => {
  const folded = foldEntries(entries)
  const host = {
    options: { viewSettingsSections: folded.viewSettingsSections, ...options },
  }
  const { start, end } = resolveToolbarSides(
    withViewSettingsButton(folded.slots.toolbarSlot, host, () => null),
  )
  const flat = (groups: typeof start) =>
    groups.map(group => [group.id, group.items.map(item => item.id)])
  return { start: flat(start), end: flat(end) }
}

describe('«Настройки вида» без таблицы (ADR 0215)', () => {
  it('VW1: кнопка есть, когда в наборе есть раздел; без разделов, при enableToolbar: false и viewSettingsToolbar: false её нет; viewSettingsToolbar задаёт группу, порядок и сторону', () => {
    const withSections = [columnSorting(), dataExport()]
    expect(layoutOf(withSections).end).toEqual([
      ['view', ['viewSettingsButton']],
      ['data', ['exportButton']],
    ])
    expect(layoutOf([dataExport()]).end).toEqual([['data', ['exportButton']]])
    expect(layoutOf(withSections, { enableToolbar: false }).end).toEqual([
      ['data', ['exportButton']],
    ])
    expect(layoutOf(withSections, { viewSettingsToolbar: false }).end).toEqual([
      ['data', ['exportButton']],
    ])
    expect(
      layoutOf(withSections, {
        viewSettingsToolbar: { group: 'data', order: 30, align: 'start' },
      }).start,
    ).toEqual([['data', ['viewSettingsButton']]])
  })

  it(
    'VW8: договор раздела публичный — поле viewSettingsSections у definePlugin, тип ViewSettingsSection из /plugins; раздел автора простой или со своей панелью, со своим значком, значением и порядком',
    () => {
      expect(exportedTypeNames(ENTRY.plugins)).toContain('ViewSettingsSection')
      const simple: ViewSettingsSection = {
        id: 'mine',
        plugin: 'mine',
        icon: 'filterActive',
        slices: [],
        label: () => 'Mine',
        active: () => true,
        value: () => 'on',
        levels: () => [
          { id: 'one', label: 'One', removeLabel: 'Remove', remove: () => {} },
        ],
      }
      const panel: ViewSettingsSection = {
        id: 'panel',
        order: 15,
        plugin: 'mine',
        icon: 'columns',
        slices: [],
        label: () => 'Panel',
        active: () => false,
        value: () => '—',
        panel: preloadable(() => Promise.resolve(() => null)),
      }
      const author = definePlugin<{ enabled?: boolean }>()({
        id: 'mine',
        diagnose: () => undefined,
        viewSettingsSections: [simple, panel],
      })
      const folded = foldEntries([
        author(),
        columnFiltering(),
        columnSorting(),
        rowGrouping(),
        columnVisibility(),
      ])
      const host = {
        options: { viewSettingsSections: folded.viewSettingsSections },
      }
      // Раздел без порядка — после встроенных, с порядком — на своём месте.
      expect(ids(viewSettingsSectionsOf(host))).toEqual([
        'filter',
        'panel',
        'sorting',
        'grouping',
        'columns',
        'mine',
      ])
      const sections = viewSettingsSectionsOf(host)
      const mine = sections.find(section => section.id === 'mine')!
      expect(mine.icon).toBe('filterActive')
      expect(mine.value(host, tableLabels)).toBe('on')
      expect(mine.levels?.(host, tableLabels).map(level => level.id)).toEqual([
        'one',
      ])
      expect(sections.find(section => section.id === 'panel')!.panel).toBe(
        panel.panel,
      )
    },
    TYPES_TIMEOUT,
  )

  it(
    'VW9: сводок «Фильтры», «Сортировка», «Группировка» и кнопки «Колонки» нет; у их фабрик нет аргумента toolbar; columnVisibility инертен с noToolbar, когда «Настроек вида» нет',
    () => {
      const folded = foldEntries([
        columnFiltering(),
        columnSorting(),
        rowGrouping(),
        columnVisibility(),
      ])
      expect(folded.slots.toolbarSlot).toEqual([])
      for (const name of [
        'columnFiltering',
        'columnSorting',
        'rowGrouping',
        'columnVisibility',
      ])
        expect(
          firstParamProps(ENTRY.plugins, name).map(prop => prop.name),
          name,
        ).not.toContain('toolbar')
      const reason = (options: Record<string, unknown>) =>
        columnVisibilityInertReason({ options })
      expect(reason({})).toBeUndefined()
      expect(reason({ enableToolbar: false })).toBe('noToolbar')
      expect(reason({ viewSettingsToolbar: false })).toBe('noToolbar')
    },
    TYPES_TIMEOUT,
  )
})
