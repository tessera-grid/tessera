import { cleanup, render } from 'vitest-browser-react'
import { page, server } from 'vitest/browser'
import { describe, expect, test } from 'vitest'

import baseline from './guide-fresh-baseline.json'
import { loadStories } from './contrast-helpers'
import { DemoStory, guideArgs } from '../../demos/DemoStory'
import { FRESH_ATTR, guideNext, until } from '../../__mocks__/catalogPlay'
import { both } from '../storyText.helpers'
import { parkPointer } from '../pointer'

// Проход гайдов со свежей таблицей (ADR 0117, SN73): каждый гайд проходит свой `play`, но
// перед каждым «Далее» ставится пометка «Таблица изменена». В прежнем режиме шаг сам
// восстанавливает состояние, в атомарном это делает навигатор молчаливым проходом предыдущих
// шагов. Гайды, чьи проверки по природе о непрерывности (таблица не пересоздаётся), — в базе
// с причиной; база только сокращается.

const known = baseline as Record<string, string>

// Настоящий touch-ввод этих гайдов проверяется CDP в Chromium; в других движках его нет.
const CHROMIUM_TOUCH = new Set([
  'DataGrid/Columns/Dragging/ColumnDraggingByTouch',
  'DataGrid/Core/Touch/TouchIconHint',
  'DataGrid/Rows/Dragging/RowDraggingByTouch',
])

/** Только истории, чьё имя содержит строку, — для разбора; база тогда не сверяется. */
const ONLY = import.meta.env.VITE_GUIDE_FRESH_ONLY as string | undefined

/** Пройти `play` со свежей таблицей перед каждым шагом; текст ошибки или `undefined`. */
const walkFresh = async (run: () => Promise<void>) => {
  document.documentElement.setAttribute(FRESH_ATTR, '')
  try {
    await run()
    return undefined
  } catch (error) {
    return (error as Error).message.split('\n')[0]
  } finally {
    document.documentElement.removeAttribute(FRESH_ATTR)
  }
}

// Стенд: шаг 3 без действия держится на прокрутке шага 2 — восстанавливает её только replay.
const SCROLL = 200
const STAND = [
  {
    title: both('Таблица в покое'),
    hint: both('Шаг только показывает таблицу.'),
  },
  {
    title: both('Таблица прокручена'),
    hint: both('Действие прокручивает таблицу.'),
    enter: (root: HTMLElement) => {
      root.querySelector('.data-grid__container')!.scrollTop = SCROLL
    },
  },
  { title: both('Прокрутка на месте'), hint: both('Шаг без действия.') },
]
const scrollTop = () =>
  document.querySelector<HTMLElement>('.data-grid__container')?.scrollTop ?? 0
const playStand = async (canvas: HTMLElement) => {
  await until(() =>
    expect(document.querySelector('.data-grid__body-row')).not.toBeNull(),
  )
  await guideNext(canvas)
  await until(() =>
    expect(Math.abs(scrollTop() - SCROLL)).toBeLessThanOrEqual(1),
  )
  await guideNext(canvas)
  await until(() =>
    expect(Math.abs(scrollTop() - SCROLL)).toBeLessThanOrEqual(1),
  )
}

describe('проход гайдов со свежей таблицей (ADR 0117)', () => {
  test('SN73: каждый шаг каждого гайда достижим из свежей таблицы — прежний режим восстанавливает его действием, атомарный молчаливым replay; проход play с пометкой держит проверки', async () => {
    // Детектор: прежний режим ловит зависимость от прошлого шага, атомарный восстанавливает её.
    const stand = async (atomicSteps = false) => {
      const screen = await render(
        <DemoStory
          title={both('Стенд свежей таблицы')}
          steps={STAND}
          args={guideArgs(
            { dataCount: 200, height: 320 },
            { colorMode: 'light', locale: 'en' },
          )}
          atomicSteps={atomicSteps}
        />,
      )
      return screen
    }
    let screen = await stand()
    await playStand(screen.container)
    await cleanup()
    screen = await stand()
    expect(await walkFresh(() => playStand(screen.container))).toBeDefined()
    await cleanup()
    screen = await stand(true)
    expect(await walkFresh(() => playStand(screen.container))).toBeUndefined()
    await cleanup()

    await page.viewport(900, 720)
    const guides = (await loadStories()).filter(
      ({ path, story, Story }) =>
        Story.parameters.scenario &&
        !path.includes('.dev.stories') &&
        (server.browser === 'chromium' || !CHROMIUM_TOUCH.has(story)) &&
        (!ONLY || `${path} ${story}`.includes(ONLY)),
    )
    const failed: Record<string, string> = {}
    for (const { story, Story } of guides) {
      // eslint-disable-next-line no-console -- локализация зависшего обхода
      console.log('SN73_STORY', story)
      await parkPointer()
      const guide = await render(<Story />)
      let current = ''
      const error = await walkFresh(() =>
        Story.play!({
          canvasElement: guide.container,
          step: async (name: string, play: () => Promise<void>) => {
            current = name
            await play()
          },
        } as never),
      )
      await cleanup()
      await until(() =>
        expect(document.querySelector('[role="menu"]')).toBeNull(),
      )
      if (error) failed[story] = `«${current}»: ${error}`
    }
    // eslint-disable-next-line no-console -- список для базы при её разборе
    console.log(JSON.stringify(failed, null, 2))
    expect(guides.length).toBeGreaterThan(0)
    expect(Object.keys(failed).filter(story => !(story in known))).toEqual([])
    if (ONLY) return
    // База только сокращается.
    expect(Object.keys(known).filter(story => !(story in failed))).toEqual([])
  }, 10_800_000)
})
