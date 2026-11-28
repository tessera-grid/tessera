/**
 * Разделы «Настроек вида» — факт ядра (ADR 0215, §5): что плагин показывает в настройках вида — короткое
 * значение строки, уровни простого раздела или свою панель — и как это снять. Кнопку и поповер
 * рисует грид по факту, не зная плагинов; плагин автора вкладывает раздел тем же полем.
 */
import type { ComponentType, ReactNode } from 'react'

import type { ToolbarSlot } from './createSlots'
import type { DebugActionSource } from './debugActions'
import type { TableLabels } from './localization'
import type { ToolbarPlacement } from './toolbar'
import type { Preloadable } from '../util/preloadable'

/** A level of a simple section: a filter condition, a sort or grouping level. */
export interface ViewSettingsLevel {
  id: string
  /** The column or a custom level name. */
  label: string
  /** "Descending, priority 1 of 2", the condition text. */
  description?: string
  /** The level is on a hidden column. */
  hidden?: boolean
  /** Accessible name of the remove button. */
  removeLabel: string
  remove: (source: DebugActionSource) => void
}

/** A section panel: a lazy component with its own markup (ADR 0215, §3). */
export interface ViewSettingsPanelProps {
  table: unknown
}

export type ViewSettingsPanel = Preloadable & {
  Component: ComponentType<ViewSettingsPanelProps & { fallback?: ReactNode }>
}

export interface ViewSettingsSection {
  id: string
  /** Place among sections: built-in ones are 10…50, authors' sections come after them. */
  order?: number
  /** The owner in the debug-action channel. */
  plugin: string
  label: (labels: TableLabels) => string
  /** Icon key in `icons`. */
  icon: string
  /** State slices the section's button and row subscribe to. */
  slices: readonly string[]
  /** The section row exists; always by default. */
  visible?: (table: unknown) => boolean
  /** The section is active: counted in the number on the button. */
  active: (table: unknown) => boolean
  /** Short value of the row (§4). */
  value: (table: unknown, labels: TableLabels) => string
  /** Full value for the row's accessible name. */
  description?: (table: unknown, labels: TableLabels) => string
  /** Levels of a simple section. */
  levels?: (table: unknown, labels: TableLabels) => ViewSettingsLevel[]
  /** Reset of a simple section — the button at the bottom right. */
  reset?: {
    label: (labels: TableLabels) => string
    run: (table: unknown, source: DebugActionSource) => void
  }
  /** A custom section panel instead of levels; such a section can always be opened. */
  panel?: ViewSettingsPanel
}

/** Ранг раздела автора без `order`: после встроенных. */
export const AUTHOR_SECTION_ORDER = 100

const NONE: readonly ViewSettingsSection[] = []

interface ViewTable {
  options?: {
    viewSettingsSections?: ViewSettingsSection[]
    viewSettingsToolbar?: ToolbarPlacement | false
    enableToolbar?: boolean
  }
}

/** Разделы включённых плагинов по рангу. */
export const viewSettingsSectionsOf = (
  table: unknown,
): readonly ViewSettingsSection[] => {
  const sections = (table as ViewTable).options?.viewSettingsSections
  if (!sections?.length) return NONE
  return [...sections].sort(
    (a, b) =>
      (a.order ?? AUTHOR_SECTION_ORDER) - (b.order ?? AUTHOR_SECTION_ORDER),
  )
}

/** Видимые разделы: строки первого уровня. */
export const shownViewSettingsSections = (table: unknown) =>
  viewSettingsSectionsOf(table).filter(
    section => section.visible?.(table) ?? true,
  )

/** Кнопка «Настройки вида» есть: есть разделы, тулбар не запрещён, место не снято (VW1). */
export const viewSettingsShown = (table: unknown) => {
  const options = (table as ViewTable).options
  return (
    viewSettingsSectionsOf(table).length > 0 &&
    options?.enableToolbar !== false &&
    options?.viewSettingsToolbar !== false
  )
}

/** Место кнопки «Настройки вида»: группа `view` справа, поверх — `viewSettingsToolbar`. */
export const viewSettingsPlacement = (table: unknown) => {
  const placement = (table as ViewTable).options?.viewSettingsToolbar
  return {
    group: 'view',
    order: 0,
    ...(placement ? definedOnly(placement) : {}),
  }
}

/**
 * Кнопки тулбара вместе с кнопкой «Настроек вида» на её месте (VW1): кнопка — грида, а не плагина,
 * есть, пока есть разделы; компонент кнопки даёт грид.
 */
export const withViewSettingsButton = (
  slot: ToolbarSlot,
  table: unknown,
  component: ToolbarSlot[number]['component'],
): ToolbarSlot =>
  viewSettingsShown(table)
    ? [
        ...slot,
        {
          id: 'viewSettingsButton',
          slot: 'toolbarSlot',
          component,
          ...viewSettingsPlacement(table),
        } as ToolbarSlot[number],
      ]
    : slot

const definedOnly = ({ group, order, align }: ToolbarPlacement) => ({
  ...(group !== undefined && { group }),
  ...(order !== undefined && { order }),
  ...(align !== undefined && { align }),
})

/**
 * Short value of a section (§4): how many are enabled and how many drafts; nothing — "none".
 */
export const countViewSettingsValue = (
  labels: TableLabels,
  active: number,
  drafts = 0,
) => {
  if (active === 0 && drafts === 0) return labels.viewSettingsNone
  const parts = []
  if (active > 0) parts.push(labels.viewSettingsActiveCount(active))
  if (drafts > 0) parts.push(labels.viewSettingsDraftCount(drafts))
  return parts.join(', ')
}

/** Значение раздела с одним переключателем. */
export const toggleViewSettingsValue = (
  labels: TableLabels,
  active: boolean,
) => (active ? labels.viewSettingsOn : labels.viewSettingsNone)
