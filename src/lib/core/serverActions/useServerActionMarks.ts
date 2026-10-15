/**
 * Ожидание и отказ серверного действия у его причины (ADR 0116, §3, §5): контрол
 * подписан только на то, касается ли его срез `serverAction`, — смена чужой причины
 * его не перерисовывает.
 */
import { useSelector } from '@tanstack/react-store'

import { shallowEqual } from '../reactivity'
import type {
  ServerActionCause,
  ServerActionKind,
  ServerActionStatus,
} from './serverActionFeature'

type Source = {
  get: () => ServerActionStatus
  subscribe: (listener: (value: ServerActionStatus) => void) => {
    unsubscribe: () => void
  }
}

const IDLE: ServerActionStatus = {}
const NONE: Source = {
  get: () => IDLE,
  subscribe: () => ({ unsubscribe: () => {} }),
}

export interface ServerActionMarks {
  pending: boolean
  /** Ключ вспышки отказа — номер отказавшей попытки. */
  flash?: number
  /** Отказ, начатый этим контролом, — до успеха следующего действия или закрытия плашки. */
  failure?: { kind: ServerActionKind; error: unknown }
}

/**
 * Свет ожидания контрола — `aria-busy` и `data-pending`, а не `pending` кнопки: тот
 * глушит нажатия, а действие во время ожидания разрешено (ADR 0116, §2).
 */
export const pendingAttributes = (pending: boolean) =>
  pending ? { 'aria-busy': true, 'data-pending': '' } : {}

export const useServerActionMarks = (
  table: unknown,
  matches: (cause: ServerActionCause) => boolean,
): ServerActionMarks => {
  const source =
    (table as { atoms?: { serverAction?: Source } } | undefined)?.atoms
      ?.serverAction ?? NONE
  return useSelector(
    source,
    ({ pending, failed }) => {
      const mine = !!failed?.cause && matches(failed.cause)
      return {
        pending: !!pending?.cause && matches(pending.cause),
        flash: mine ? failed!.attempt : undefined,
        failure: mine ? failed : undefined,
      }
    },
    { compare: shallowEqual },
  )
}
