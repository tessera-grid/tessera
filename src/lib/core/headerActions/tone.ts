import type { ActionTone, MenuAction } from './types'

/** Тон действия в контексте (ADR 0206): значение поля или ответ его функции. */
export const toneOf = <TCtx>(
  action: Pick<MenuAction<TCtx>, 'tone'>,
  ctx: TCtx,
): ActionTone | undefined =>
  typeof action.tone === 'function' ? action.tone(ctx) : action.tone
