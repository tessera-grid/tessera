/**
 * Значение редактора даты (ADR 0175, ED15): свой формат типа пишется через `formatDate`,
 * без него — формат базового типа.
 * Запуск: npx vitest run --config vitest.node.config.ts dateEditValue
 */
import { describe, expect, it } from 'vitest'

import { dateValueOf } from '../plugins/cellEditing/DateEditor'

const pad = (n: number) => String(n).padStart(2, '0')
/** Свой формат дня `DD.MM.YYYY` — по UTC, как читается `dateString`. */
const ruDay = (date: Date) =>
  `${pad(date.getUTCDate())}.${pad(date.getUTCMonth() + 1)}.${date.getUTCFullYear()}`

describe('значение редактора даты (ADR 0175)', () => {
  it('ED15: тип даты задаёт formatDate(date) — редактор пишет значение через него: момент у дат со временем, полночь дня по UTC у dateString, полночь в поясе таблицы у date; без поля — формат базового типа', () => {
    const day = { day: '2026-03-20', time: '14:30' }

    expect(dateValueOf('dateString', day, '15.03.2026', undefined, ruDay)).toBe(
      '20.03.2026',
    )
    const atUtc: Date[] = []
    dateValueOf('dateString', day, null, 'Asia/Tokyo', date => {
      atUtc.push(date)
      return 'x'
    })
    expect(atUtc[0]!.toISOString()).toBe('2026-03-20T00:00:00.000Z')

    const moments: Date[] = []
    dateValueOf('dateTimeString', day, null, 'Asia/Tokyo', date => {
      moments.push(date)
      return date.getTime()
    })
    expect(moments[0]!.toISOString()).toBe('2026-03-20T05:30:00.000Z')

    const midnights: Date[] = []
    dateValueOf('date', day, null, 'Asia/Tokyo', date => {
      midnights.push(date)
      return date
    })
    expect(midnights[0]!.toISOString()).toBe('2026-03-19T15:00:00.000Z')

    // Без поля — формат базового типа.
    expect(dateValueOf('dateString', day, '2026-03-15', undefined)).toBe(
      '2026-03-20',
    )
    expect(
      dateValueOf('dateString', { day: null, time: '' }, 'x', undefined, ruDay),
    ).toBe(null)
  })
})
