import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'
import { composeStories } from '@storybook/react-vite'

import { columnPinningLabels } from '../../../plugins/columnPinning/labels'
import { calendarLabels } from '../../../shared/calendar/labels'
import { storyLabels } from '../../__mocks__/storyLabels'
import * as alertStories from '../../UI.Alert.stories'
import * as pinStories from '../../UI.PinButton.stories'
import * as timeStories from '../../UI.TimeField.stories'

// Язык тулбара Storybook в историях кита `UI/*` (ADR 0117, SN63–SN64).

/** Истории модуля в тулбаре с выбранным языком. */
const inLocale = <T extends Parameters<typeof composeStories>[0]>(
  module: T,
  locale: 'en' | 'ru',
) => composeStories(module, { initialGlobals: { locale } })

describe('Язык тулбара в историях кита', () => {
  test('SN63: истории кита показывают на языке тулбара тексты из словаря — переданные пропсами и прочитанные компонентом', async () => {
    const ru = storyLabels('ru')
    expect(ru.loadRetry).not.toBe(storyLabels('en').loadRetry)

    // Пропсами: заголовок плашки и подпись повтора история берёт из словаря.
    const { AlertPlayground } = inLocale(alertStories, 'ru')
    const alert = await render(<AlertPlayground />)
    await expect
      .poll(() => document.body.textContent)
      .toContain(ru.loadErrorTitle)
    expect(
      [...document.querySelectorAll('button')].map(b => b.textContent),
    ).toContain(ru.loadRetry)
    await alert.unmount()

    // Сам: кнопка закрепления читает словарь таблицы, его ставит холст историй.
    const { PinButtonPlayground } = inLocale(pinStories, 'ru')
    const pin = await render(<PinButtonPlayground />)
    await expect
      .poll(() =>
        document
          .querySelector('button[aria-label]')
          ?.getAttribute('aria-label'),
      )
      .toBe(columnPinningLabels(ru).pin)
    await pin.unmount()
  })

  test('SN64: свой язык формата истории кита язык тулбара не затирает', async () => {
    const dayPeriod = calendarLabels(storyLabels('en')).timeDayPeriod
    const period = () =>
      document.querySelector(`[aria-label="${dayPeriod}"]`) !== null

    // Английский тулбар: без своего языка — 12 часов, с языком `ru` — 24 часа.
    const { TimeFieldPlayground, TimeField24 } = inLocale(timeStories, 'en')
    const playground = await render(<TimeFieldPlayground />)
    await expect.poll(period).toBe(true)
    await playground.unmount()

    const day = await render(<TimeField24 />)
    await expect
      .poll(() => document.querySelector('[data-testid="story-time"]'))
      .not.toBeNull()
    expect(period()).toBe(false)
    await day.unmount()
  })
})
