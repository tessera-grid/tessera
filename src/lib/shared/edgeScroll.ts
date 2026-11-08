/**
 * Автопрокрутка у края области во время протяжки (ADR 0029, ADR 0197): ширина краевой
 * зоны и скорость — общие у выделения ячеек и ширины колонки.
 */

/** Ширина краевой зоны (px) и максимальная скорость прокрутки (px/кадр). */
export const EDGE_ZONE = 48
const MAX_SPEED = 22

/** Скорость пропорциональна заходу в краевую зону, за краем — потолок. */
export const edgeSpeed = (penetration: number) =>
  Math.max(0, Math.min(1, penetration / EDGE_ZONE)) * MAX_SPEED
