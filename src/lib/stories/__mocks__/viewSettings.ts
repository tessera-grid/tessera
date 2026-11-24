/**
 * «Настройки вида» в историях (ADR 0215): кнопка, поповер и разделы — по `data-*`. Действия — шаги для
 * опроса гайда: зовутся повторно, пока не вернут `true`.
 */
import type { TesseraFeatureEntry } from '../../core/features'
export const viewSettingsButton = (root: ParentNode) =>
  root.querySelector<HTMLElement>('[data-testid="view-settings-button"]')

export const viewSettingsPopover = () =>
  document.querySelector<HTMLElement>(
    '[data-testid="view-settings-popover"][data-open]',
  )

/** Текущий уровень поповера: снимок уходящего уровня — на своём слое, без `data-popup-level`. */
export const viewSettingsLevel = () =>
  viewSettingsPopover()?.querySelector<HTMLElement>('[data-popup-level]') ??
  null

export const viewSettingsRow = (id: string) =>
  viewSettingsLevel()?.querySelector<HTMLElement>(
    `[data-view-settings-section="${id}"]`,
  ) ?? null

export const viewSettingsSectionOpen = (id: string) =>
  viewSettingsLevel()?.querySelector<HTMLElement>(
    `[data-view-settings-open="${id}"]`,
  ) ?? null

/** Открыть «Настройки вида» и их раздел; `true` — раздел открыт. */
export const openViewSettingsSection = (root: ParentNode, id: string) => {
  if (viewSettingsSectionOpen(id)) return true
  const row = viewSettingsRow(id)
  if (row) row.click()
  else if (!viewSettingsPopover()) {
    const button = viewSettingsButton(root)
    if (button?.getAttribute('aria-expanded') !== 'true') button?.click()
  } else
    viewSettingsLevel()
      ?.querySelector<HTMLElement>('[data-popup-level-back]')
      ?.click()
  return false
}

/** Закрыть «Настройки вида»; `true` — закрыт. */
export const closeViewSettings = (root: ParentNode) => {
  if (!viewSettingsPopover()) return true
  viewSettingsButton(root)?.click()
  return false
}

/** Колонка скрыта приложением ещё до первого кадра таблицы. */
export const hiddenOnMount = (id: string): TesseraFeatureEntry => ({
  id: `hiddenOnMount:${id}`,
  setup: table => {
    ;(
      table as { setColumnVisibility: (next: Record<string, boolean>) => void }
    ).setColumnVisibility({ [id]: false })
  },
})
