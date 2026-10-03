/**
 * Показ панелей вне скролла — тулбара и нижней панели (ADR 0046, PB1–PB3): флаг
 * важнее, без флага панель есть, пока есть хоть один активный слот.
 */
export const resolvePanelVisible = (
  flag: boolean | undefined,
  slotCount: number,
): boolean => flag ?? slotCount > 0
