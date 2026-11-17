import { expect } from 'storybook/test'

import { until } from './catalogPlay'

/** Плашка итога применения над таблицей, пока она не уходит (ADR 0227, §1). */
export const applyNotice = (root: ParentNode) => {
  const element = root.querySelector<HTMLElement>(
    '[data-testid="table-notice"]',
  )
  return element && !element.hasAttribute('data-leaving') ? element : null
}

/** Плашка «всё сохранено» — в тоне успеха. */
export const applySavedNotice = (root: ParentNode) =>
  applyNotice(root)?.getAttribute('data-tone') === 'success'

/** Плашка частичного итога: в нейтральном тоне, с действием. */
export const applyPartlyNotice = (root: ParentNode) =>
  !!applyNotice(root)?.querySelector('[data-testid="table-notice-action"]') &&
  applyNotice(root)?.getAttribute('data-tone') === 'neutral'

/**
 * Появление плашки доведено до конца: снимок шага застаёт её целиком, а вспышки ячеек
 * остаются.
 */
export const applyNoticeEntered = async (root: ParentNode) => {
  for (const animation of applyNotice(root)?.getAnimations({
    subtree: true,
  }) ?? [])
    animation.finish()
  await until(() =>
    expect(getComputedStyle(applyNotice(root)!).opacity).toBe('1'),
  )
}
