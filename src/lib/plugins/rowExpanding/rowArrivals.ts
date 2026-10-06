/**
 * Отметки прихода ленивых детей (ADR 0056): новые дети асинхронного ответа получают
 * момент прихода; строка с отметкой подсвечена, пока не выйдет
 * `--tsr-comp-row-arrival-duration`.
 */
import { createExpiringMarks } from '../../core/expiringMarks'
import { readRowArrivals, setRowArrivals } from './lazyChildrenFeature'

const arrivals = createExpiringMarks({
  read: readRowArrivals,
  write: setRowArrivals,
  token: '--tsr-comp-row-arrival-duration',
  fallback: 300,
})

/** Отметить пришедшие строки моментом «сейчас». */
export const markArrivals = arrivals.mark

/** Удалить отметки строк (ушедших из данных). */
export const dropArrivals = arrivals.drop
