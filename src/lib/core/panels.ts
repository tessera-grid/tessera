/**
 * Показ панелей вне скролла — тулбара и нижней панели (ADR 0046, PB1–PB3): флаг
 * важнее, без флага панель есть, пока есть хоть один активный слот, который её
 * вызывает (`showsPanel`, ADR 0082).
 */
export const resolvePanelVisible = (
  flag: boolean | undefined,
  slotCount: number,
): boolean => flag ?? slotCount > 0

/** Записи слота, которые вызывают панель: без `showsPanel: false` (ADR 0082, BT3). */
export const countPanelSlots = (
  slot: readonly { showsPanel?: boolean }[],
): number => slot.filter(item => item.showsPanel !== false).length
