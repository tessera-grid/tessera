// Подписка на срез `actionStatus` (ADR 0078). Кнопка действия бывает и вне грида — без
// таблицы срез пустой.
import { useSelector } from '@tanstack/react-store'

import { shallowEqual } from '../reactivity'
import type { ActionStatus } from './actionStatusFeature'

type Source = {
  get: () => ActionStatus
  subscribe: (listener: (value: ActionStatus) => void) => {
    unsubscribe: () => void
  }
}

const EMPTY: ActionStatus = {}
const NONE: Source = {
  get: () => EMPTY,
  subscribe: () => ({ unsubscribe: () => {} }),
}

export const useActionStatus = <T>(
  table: unknown,
  select: (status: ActionStatus) => T,
): T => {
  const source =
    (table as { atoms?: { actionStatus?: Source } } | undefined)?.atoms
      ?.actionStatus ?? NONE
  return useSelector(source, select, { compare: shallowEqual })
}
