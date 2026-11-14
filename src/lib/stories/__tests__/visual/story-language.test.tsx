import type { ReactNode } from 'react'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { StoryLocaleProvider } from '../../__mocks__/storyLocale'
import type { StoryLocale, StoryText } from '../../__mocks__/storyText'
import { GuidePanel, type GuideStep, useGuide } from '../../demos/GuidePanel'
import { StoryConsole } from '../../demos/StoryConsole'
import { type ConsoleLog, createConsoleLog } from '../../demos/consoleLog'
import { shellText, type StoryShellKey } from '../../demos/storyShell'

// Язык гайда и консоли (ADR 0225): GT1 — панель гайда, GT2 — консоль, GT9 — узкая и
// минимальная ширина панели на обоих языках. GT3 — модульный `storyConsole`, GT10 — `play`
// истории `Tessera/Common/Console — Switch language`.

const viewport = { width: innerWidth, height: innerHeight }
beforeAll(() => page.viewport(1280, 900))
afterAll(() => page.viewport(viewport.width, viewport.height))

const byTestId = (id: string) =>
  document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!

const TITLE: StoryText = { ru: 'Работа с заказами', en: 'Working with orders' }
const LONG_TITLE: StoryText = {
  ru: 'Очень длинное название сценария, которое не помещается в строку панели',
  en: 'A very long scenario title that does not fit on one line of the panel',
}

const STEPS: readonly GuideStep[] = [
  {
    title: { ru: 'Данные загружаются', en: 'Data is loading' },
    hint: {
      ru: 'Таблица показывает скелет.',
      en: 'The table shows a skeleton.',
    },
  },
  {
    title: { ru: 'Строки пришли', en: 'Rows arrived' },
    hint: {
      ru: 'Строки встают на место скелета.',
      en: 'Rows take the place of the skeleton.',
    },
  },
  {
    title: { ru: 'Сервер отказал', en: 'The server refused' },
    hint: {
      ru: 'Таблица показывает плашку с причиной.',
      en: 'The table shows a banner with the reason.',
    },
  },
]

const Panel = ({
  title = TITLE,
  steps = STEPS,
  changed = false,
}: {
  title?: StoryText
  steps?: readonly GuideStep[]
  changed?: boolean
}) => {
  const guide = useGuide(steps.length)
  return (
    <GuidePanel
      title={title}
      steps={steps}
      step={guide.step}
      onBack={guide.back}
      onNext={guide.next}
      onRestart={guide.restart}
      onJump={guide.jump}
      changed={changed}
      onRestore={() => {}}
      defaultExpanded
    />
  )
}

const inLocale = (locale: StoryLocale, node: ReactNode) => (
  <StoryLocaleProvider value={locale}>{node}</StoryLocaleProvider>
)

describe('язык гайда и консоли (ADR 0225)', () => {
  test('GT1: панель гайда — название, счётчик шага, кнопки и их подсказки, пометка изменённой таблицы, имя области и тексты шагов — на языке истории; смена языка на лету оставляет шаг и не перезапускает гайд', async () => {
    const panel = <Panel changed />
    const screen = await render(inLocale('en', panel))
    const check = async (locale: StoryLocale, step: number) => {
      const text = (key: StoryShellKey, params?: Record<string, unknown>) =>
        shellText(locale, key, params)
      const section = byTestId('guide')
      expect(section.getAttribute('aria-label')).toBe(
        text('guideRegion', { title: TITLE[locale] }),
      )
      const toggle = byTestId('guide-toggle').textContent
      expect(toggle).toContain(text('guideTitle', { title: TITLE[locale] }))
      expect(toggle).toContain(
        text('guideStepOf', { step: step + 1, count: STEPS.length }),
      )
      expect(byTestId('guide-play').textContent).toBe(text('guidePlay'))
      expect(byTestId('guide-back').textContent).toBe(text('guideBack'))
      expect(byTestId('guide-restart').textContent).toBe(text('guideRestart'))
      expect(byTestId('guide-next').textContent).toBe(text('guideNext'))
      expect(byTestId('guide-changed').textContent).toBe(text('guideChanged'))
      expect(byTestId('guide-restore').textContent).toBe(text('guideRestore'))
      const steps = byTestId('guide-steps').textContent
      for (const item of STEPS) {
        expect(steps).toContain(item.title[locale])
        expect(steps).toContain(item.hint[locale])
      }
      expect(
        section.querySelector('[aria-current="step"]')?.textContent,
      ).toContain(STEPS[step]!.title[locale])
      await userEvent.hover(byTestId('guide-restore'))
      await expect
        .poll(() => document.body.textContent)
        .toContain(text('guideRestoreTooltip'))
      await userEvent.unhover(byTestId('guide-restore'))
    }
    await check('en', 0)
    await userEvent.click(byTestId('guide-next'))
    await expect
      .poll(() => byTestId('guide-toggle').textContent)
      .toContain(shellText('en', 'guideStepOf', { step: 2, count: 3 }))
    await screen.rerender(inLocale('ru', panel))
    await check('ru', 1)
    // Последняя кнопка — «Закончить» на последнем шаге — на новом языке.
    await userEvent.click(byTestId('guide-next'))
    await expect
      .poll(() => byTestId('guide-next').textContent)
      .toBe(shellText('ru', 'guideDone'))
    await screen.unmount()
  })

  test('GT2: консоль — заголовок со счётчиком в форме числа языка, фильтры и их поповер, виды и источники записей, «Очистить», шапка журнала и пустой журнал — на языке истории; смена языка не стирает записи', async () => {
    const log: ConsoleLog = createConsoleLog()
    log.action({
      plugin: 'rowSelection',
      action: 'toggleRow',
      source: 'pointer',
    })
    log.write('callback', 'onRowSelectionChange', 'ƒ')
    log.write('state', 'rowSelection', '{}')
    log.write(
      'lifecycle',
      locale => shellText(locale, 'lifecyclePlugins'),
      '+a',
    )
    log.log('server', 'saved')
    const host = (locale: StoryLocale) =>
      inLocale(locale, <StoryConsole log={log} defaultExpanded />)
    const screen = await render(host('en'))
    const check = async (locale: StoryLocale) => {
      const text = (key: StoryShellKey, params?: Record<string, unknown>) =>
        shellText(locale, key, params)
      const section = byTestId('story-console')
      expect(section.getAttribute('aria-label')).toBe(text('consoleTitle'))
      await expect
        .poll(() => byTestId('story-console-toggle').textContent)
        .toBe(`${text('consoleTitle')}· ${text('consoleEvents', { count: 5 })}`)
      expect(byTestId('story-console-filters').textContent).toBe(
        text('consoleFilters'),
      )
      expect(byTestId('story-console-clear').textContent).toBe(
        text('consoleClear'),
      )
      const log = byTestId('story-console-log')
      expect(log.getAttribute('aria-label')).toBe(text('consoleLog'))
      const heads = [...log.querySelectorAll('th')].map(th => th.textContent)
      expect(heads).toEqual([
        text('consoleColumnKind'),
        text('consoleColumnEvent'),
        text('consoleColumnTime'),
        text('consoleColumnDuration'),
      ])
      const rows = [...log.querySelectorAll('tbody tr')].map(
        row => row.textContent ?? '',
      )
      expect(rows).toHaveLength(5)
      expect(rows[0]).toContain(text('consoleKindAction'))
      expect(rows[0]).toContain(text('consoleSourcePointer'))
      expect(rows[1]).toContain(text('consoleKindCallback'))
      expect(rows[2]).toContain(text('consoleKindState'))
      expect(rows[3]).toContain(text('consoleKindLifecycle'))
      expect(rows[3]).toContain(text('lifecyclePlugins'))
      expect(rows[4]).toContain(text('consoleSourceStory'))
      await userEvent.click(byTestId('story-console-filters'))
      await expect
        .poll(() =>
          document.querySelector('[data-testid="story-console-filters-menu"]'),
        )
        .not.toBeNull()
      const popup = document.querySelector<HTMLElement>(
        '[data-testid="story-console-filters-menu"]',
      )!
      expect(popup.getAttribute('aria-label')).toBe(text('consoleFiltersMenu'))
      for (const key of [
        'consoleFilterAction',
        'consoleFilterCallback',
        'consoleFilterState',
        'consoleFilterLifecycle',
        'consoleShowAll',
      ] as const) {
        expect(popup.textContent).toContain(text(key))
      }
      await userEvent.keyboard('{Escape}')
      await expect
        .poll(() =>
          document.querySelector('[data-testid="story-console-filters-menu"]'),
        )
        .toBeNull()
    }
    await check('en')
    await screen.rerender(host('ru'))
    await check('ru')
    await userEvent.click(byTestId('story-console-clear'))
    await expect
      .poll(
        () =>
          document.querySelector<HTMLElement>('[data-console-empty]')
            ?.textContent,
      )
      .toBe(shellText('ru', 'consoleEmpty'))
    await screen.rerender(host('en'))
    await expect
      .poll(
        () =>
          document.querySelector<HTMLElement>('[data-console-empty]')
            ?.textContent,
      )
      .toBe(shellText('en', 'consoleEmpty'))
    await screen.unmount()
  })

  test('GT9: панель гайда на узкой и на минимальной ширине не выходит за карточку на обоих языках', async () => {
    const long: readonly GuideStep[] = STEPS.map(item => ({
      title: {
        ru: `${item.title.ru}: подробное название шага`,
        en: `${item.title.en}: a detailed step title`,
      },
      hint: item.hint,
    }))
    for (const locale of ['en', 'ru'] as const) {
      for (const width of [360, 240]) {
        const screen = await render(
          inLocale(
            locale,
            <div data-testid="sandbox" style={{ width, maxWidth: '100%' }}>
              <Panel title={LONG_TITLE} steps={long} changed />
            </div>,
          ),
        )
        const card = byTestId('guide')
        const box = card.getBoundingClientRect()
        expect(box.width).toBeGreaterThanOrEqual(Math.min(width, 320))
        for (const button of card.querySelectorAll(
          'button:not([data-step-button])',
        )) {
          const { left, right } = button.getBoundingClientRect()
          expect(left, `${locale} ${width}`).toBeGreaterThanOrEqual(box.left)
          expect(right, `${locale} ${width}`).toBeLessThanOrEqual(box.right)
        }
        expect(card.scrollWidth, `${locale} ${width}`).toBeLessThanOrEqual(
          card.clientWidth,
        )
        await screen.unmount()
      }
    }
  })
})
