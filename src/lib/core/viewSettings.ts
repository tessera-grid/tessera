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

/** Уровень простого раздела: условие фильтра, уровень сортировки или группировки. */
export interface ViewSettingsLevel {
  id: string
  /** Колонка или своё имя уровня. */
  label: string
  /** «По убыванию, приоритет 1 из 2», текст условия. */
  description?: string
  /** Уровень стоит на скрытой колонке. */
  hidden?: boolean
  /** Доступное имя кнопки снятия. */
  removeLabel: string
  remove: (source: DebugActionSource) => void
}

/** Панель раздела: ленивый компонент со своей разметкой (ADR 0215, §3). */
export interface ViewSettingsPanelProps {
  table: unknown
}

export type ViewSettingsPanel = Preloadable & {
  Component: ComponentType<ViewSettingsPanelProps & { fallback?: ReactNode }>
}

export interface ViewSettingsSection {
  id: string
  /** Место среди разделов: встроенные — 10…50, разделы авторов — после них. */
  order?: number
  /** Владелец в канале действий. */
  plugin: string
  label: (labels: TableLabels) => string
  /** Ключ значка в `icons`. */
  icon: string
  /** Срезы состояния, на которые подписаны кнопка и строка раздела. */
  slices: readonly string[]
  /** Строка раздела есть; по умолчанию — всегда. */
  visible?: (table: unknown) => boolean
  /** Раздел активен: входит в число на кнопке. */
  active: (table: unknown) => boolean
  /** Короткое значение строки (§4). */
  value: (table: unknown, labels: TableLabels) => string
  /** Полное значение для доступного имени строки. */
  description?: (table: unknown, labels: TableLabels) => string
  /** Уровни простого раздела. */
  levels?: (table: unknown, labels: TableLabels) => ViewSettingsLevel[]
  /** Сброс простого раздела — кнопка внизу справа. */
  reset?: {
    label: (labels: TableLabels) => string
    run: (table: unknown, source: DebugActionSource) => void
  }
  /** Своя панель раздела вместо уровней; такой раздел открывается всегда. */
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
 * Короткое значение раздела (§4): сколько включено и сколько черновиков; ничего — «нет».
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
