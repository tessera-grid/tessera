import { faker } from '@faker-js/faker'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { STORY_NOW } from '../../__mocks__/clock'
import { composed } from '../stories'
import { waitForGrid } from './core-helpers'

// Каталог визуальных состояний (ADR 0093): истории рисуются одинаково при каждой
// загрузке — от этого зависят снимки и axe по каталогу.

const DAY = 24 * 60 * 60 * 1000

/** Тексты шапки и тела грида — то, что меняют случайные данные и «сегодня». */
const gridTexts = () =>
  [
    ...document.querySelectorAll(
      '.data-grid__head-cell, .data-grid__body-cell',
    ),
  ].map(cell => cell.textContent?.trim() ?? '')

const frame = () => new Promise(resolve => requestAnimationFrame(resolve))

const renderTexts = async () => {
  // 25 колонок — больше мока: имена дополнительных колонок генерирует faker.
  const screen = await render(
    <composed.DataGridPlayground columnCount={25} dataCount={30} />,
  )
  await waitForGrid()
  // Колонки виртуализированы: тексты собираются по всей ширине прокруткой.
  const scroller = document.querySelector<HTMLElement>('.data-grid__container')!
  const texts: string[] = []
  for (let left = 0; ; left += scroller.clientWidth) {
    scroller.scrollLeft = left
    await frame()
    await frame()
    texts.push(...gridTexts())
    if (left >= scroller.scrollWidth - scroller.clientWidth) break
  }
  await screen.unmount()
  // Сколько колонок нарисовано к снимку, зависит от дозаполнения полосы окна (ADR 0202):
  // сравнивается всё, что прошло за проход по ширине.
  return [...new Set(texts)].sort()
}

describe('Каталог визуальных состояний', () => {
  test('VR3: две отрисовки одной истории дают одни и те же данные и даты, даже если между ними работали другие истории: дата страницы закреплена и идёт от неё, моки и имена дополнительных колонок — с зерном, шрифт Inter загружен', async () => {
    // Дата закреплена, но часы идут: задержки по Date.now() работают.
    const first = Date.now()
    expect(first - STORY_NOW).toBeGreaterThanOrEqual(0)
    expect(first - STORY_NOW).toBeLessThan(DAY)
    expect(new Date().toISOString().slice(0, 10)).toBe('2026-06-15')
    await new Promise(resolve => setTimeout(resolve, 30))
    expect(Date.now()).toBeGreaterThan(first)
    expect(new Date(2020, 0, 1) instanceof Date).toBe(true)

    const before = await renderTexts()
    // Другая история успела потянуть faker — состояние генератора сдвинулось.
    faker.string.alpha(64)
    const after = await renderTexts()
    expect(before.length).toBeGreaterThan(0)
    expect(after).toEqual(before)

    // Ленивые даты фильтра: строки «назад от сейчас» — от закреплённой даты.
    const { dateFilteringData } = await import('../../__mocks__/filteringData')
    expect(dateFilteringData[20]!.createdAt.slice(0, 10)).toBe('2026-06-15')

    await document.fonts.ready
    expect(document.fonts.check('14px Inter')).toBe(true)
  })
})
