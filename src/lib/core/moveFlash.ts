/**
 * Вспышки переноса строки и колонки (ADR 0114, §4) — подсветкой ADR 0080: колонка после
 * переноса — тоном `arrival` (цвет прихода строки), строка или колонка при отказе —
 * `danger`. Длительность — прихода строки (ADR 0110): строка и колонка вспыхивают
 * одинаково.
 */
import { readGridToken } from './announcer'
import { highlight, type HighlightTarget } from './highlights/highlightFeature'
import { parseDuration } from '../ui/buttonStates/useErrorFlash'

/** Запасная длительность, если токен темы не прочитан. */
const FALLBACK_MS = 300

export const flashMoved = (
  table: unknown,
  target: HighlightTarget,
  tone: 'arrival' | 'danger',
) => {
  const duration =
    parseDuration(readGridToken(table, '--tsr-comp-row-arrival-duration')) ||
    FALLBACK_MS
  highlight(table, target, { tone, key: 'move', duration })
}
