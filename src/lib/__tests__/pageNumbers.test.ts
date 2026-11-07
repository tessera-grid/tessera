/**
 * Ряд номеров страниц и подписи (ADR 0192, PJ1, PJ11).
 * Запуск: npx vitest run --config vitest.node.config.ts pageNumbers
 */
import { describe, expect, it } from 'vitest'

import { DEFAULT_LABELS, resolveLabels } from '../core/localization'
import { paginationLabels } from '../plugins/pagination/labels'
import { pageSlots, parsePageInput } from '../plugins/pagination/model'
import { RU_LABELS } from '../stories/__mocks__/localization.ru'

/** Ряд в номерах страниц: `…` — многоточие. */
const row = (pageIndex: number, pageCount: number) =>
  pageSlots(pageIndex, pageCount)
    .map(slot => (typeof slot === 'number' ? slot + 1 : '…'))
    .join(' ')

describe('Номера страниц', () => {
  it('PJ1: ряд — первая, последняя, текущая и её соседи, многоточия; не больше семи мест, при семи страницах и больше — ровно семь', () => {
    expect(row(0, 0)).toBe('')
    expect(row(0, 1)).toBe('1')
    expect(row(3, 7)).toBe('1 2 3 4 5 6 7')
    expect(row(0, 40)).toBe('1 2 3 4 5 … 40')
    expect(row(3, 40)).toBe('1 2 3 4 5 … 40')
    expect(row(4, 40)).toBe('1 … 4 5 6 … 40')
    expect(row(6, 40)).toBe('1 … 6 7 8 … 40')
    expect(row(35, 40)).toBe('1 … 35 36 37 … 40')
    expect(row(36, 40)).toBe('1 … 36 37 38 39 40')
    expect(row(39, 40)).toBe('1 … 36 37 38 39 40')

    for (const pageCount of [7, 8, 9, 10, 40, 1_000_000]) {
      for (
        let index = 0;
        index < pageCount;
        index += Math.ceil(pageCount / 50)
      ) {
        const slots = pageSlots(index, pageCount)
        expect(slots).toHaveLength(7)
        expect(slots).toContain(index)
        expect(slots).toContain(0)
        expect(slots).toContain(pageCount - 1)
        const pages = slots.filter(slot => typeof slot === 'number')
        expect(new Set(pages).size).toBe(pages.length)
      }
    }
  })

  it('разбор поля: граница, разделители разрядов, не число', () => {
    expect(parsePageInput('7', 40)).toBe(6)
    expect(parsePageInput('1 000', 2000)).toBe(999)
    expect(parsePageInput('1,000', 2000)).toBe(999)
    expect(parsePageInput('1000', 40)).toBe(39)
    expect(parsePageInput('0', 40)).toBe(0)
    expect(parsePageInput('', 40)).toBeUndefined()
    expect(parsePageInput('abc', 40)).toBeUndefined()
    expect(parsePageInput('-3', 40)).toBeUndefined()
  })

  it('PJ11: имена кнопок и подпись поля — ключи словаря localization, номера — по языку таблицы', () => {
    const en = paginationLabels(DEFAULT_LABELS)
    expect(en.goToPage(7)).toBe('Go to page 7')
    expect(en.pageNumber(1000)).toBe('1,000')
    expect(en.pageOfTotal(1000)).toBe('of 1,000')
    expect(en.pageInput).toBe('Page number')

    const ru = paginationLabels(resolveLabels(RU_LABELS, 'ru-RU'))
    expect(ru.goToPage(7)).toBe('Перейти на страницу 7')
    expect(ru.pageNumber(1000)).toBe('1 000')
    expect(ru.pageOfTotal(40)).toBe('из 40')
    expect(ru.pageInput).toBe('Номер страницы')
  })
})
