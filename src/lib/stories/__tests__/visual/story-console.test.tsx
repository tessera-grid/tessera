import axe from 'axe-core'
import { composeStories } from '@storybook/react'
import { commands, page, server, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { RowExpandingLazyDemo } from '../../demos/sessionDemos'
import * as consoleStories from '../../Console.dev.stories'
import * as skeletonStories from '../../DataGrid.DataLoading.Skeleton.stories'
import { StoryComponent } from '../../DataGridStory'
import type { StoryProps } from '../../DataGridStory.types'
import { dataGridMeta } from '../../dataGridMeta'
import { WithConsole } from '../../demos/StoryConsole'
import { type ConsoleLog, createConsoleLog } from '../../demos/consoleLog'
import { settle } from '../../__mocks__/catalogPlay'
import { normalizeArgs } from '../../__mocks__/utils/normalizeArgs'
import { humanClick } from '../helpers'
import { waitForQuietDocument } from '../memory.helpers'
import { measureWork } from '../work.helpers'
import { AXE_OPTIONS } from './a11y-helpers'

// Консоль историй (ADR 0124): CL1, CL3, CL7–CL12. CL5 — в `play` песочницы
// `Tessera/Common/Console`, CL2, CL4, CL6, CL13–CL14 — модульные `storyConsole`.

const { ConsoleGuideEvents } = composeStories(consoleStories)
const { SkeletonDataArrives } = composeStories(skeletonStories)
/** Демо с кнопкой в заголовке консоли: ленивое раскрытие (ADR 0041). */
const RowExpandingLazy = () => (
  <RowExpandingLazyDemo
    {...normalizeArgs({
      ...dataGridMeta.args,
      enableRowExpanding: true,
      rowExpandingMaxDepth: 2,
    } as StoryProps)}
  />
)

const motion = commands as unknown as {
  reducedMotion: (reduce: boolean) => Promise<void>
}

const viewport = { width: innerWidth, height: innerHeight }
beforeAll(() => page.viewport(1280, 900))
afterAll(() => page.viewport(viewport.width, viewport.height))

const byTestId = (id: string) =>
  document.querySelector<HTMLElement>(`[data-testid="${id}"]`)
const toggle = () => byTestId('story-console-toggle')!
const list = () => byTestId('story-console-log')!
const frame = () =>
  new Promise<void>(resolve => requestAnimationFrame(() => resolve()))

/** Относительная яркость цвета CSS в любой записи — через холст. */
const luminance = (color: string) => {
  const context = document.createElement('canvas').getContext('2d')!
  context.fillStyle = color
  context.fillRect(0, 0, 1, 1)
  const [red, green, blue] = [...context.getImageData(0, 0, 1, 1).data].map(
    channel => {
      const value = channel / 255
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    },
  )
  return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!
}

const ARGS = normalizeArgs({
  ...dataGridMeta.args,
  enableColumnSorting: true,
  // Колбэк сортировки: нажатие сортировки пишет в журнал и запись вида «Колбэки».
  onToggleColumnSort: (() => {}) as StoryProps['onToggleColumnSort'],
} as StoryProps)

/** Таблица истории наружу — для счёта пересборок моделей и смены среза из теста. */
const probe = (box: { table?: object }) => ({
  id: 'tableProbe',
  features: {},
  setup: (table: unknown) => {
    box.table = table as object
  },
})

/** Грид истории с консолью (или без неё — `log` не задан). */
const mountHost = async (log?: ConsoleLog) => {
  const box: { table?: object } = {}
  const grid = <StoryComponent {...ARGS} extraPlugins={[probe(box)]} />
  const screen = await render(
    log ? <WithConsole log={log}>{grid}</WithConsole> : grid,
  )
  await waitForQuietDocument()
  return { screen, table: () => box.table! }
}

const sortButton = () =>
  document.querySelector<HTMLElement>(
    '.data-grid__head-cell[data-column-id="country"] .column-sort__button',
  )!

describe('консоль историй (ADR 0124)', () => {
  test('CL1: консоль — под гридом истории с гайдом и демо-истории, свёрнута по умолчанию со счётчиком событий и без списка; заголовок плавно раскрывает и сворачивает её; свёрнутое тело вне фокуса', async () => {
    const guide = await render(<ConsoleGuideEvents />)
    await expect.poll(() => byTestId('story-console')).not.toBeNull()
    const grid = document.querySelector('.data-grid__container')!
    const panel = byTestId('story-console')!
    expect(panel.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      grid.getBoundingClientRect().bottom,
    )
    expect(toggle().getAttribute('aria-expanded')).toBe('false')
    await expect
      .poll(() => toggle().textContent)
      .toMatch(/Консоль\s*· \d+ событи/)
    expect(list().closest('[inert]')).not.toBeNull()
    // Тело свёрнуто: обёртка списка — без высоты.
    expect(list().parentElement!.getBoundingClientRect().height).toBeLessThan(1)

    const height = () => Math.round(panel.getBoundingClientRect().height)
    const sample = async (act: () => void) => {
      const heights: number[] = []
      act()
      const start = performance.now()
      while (performance.now() - start < 500) {
        await frame()
        heights.push(height())
      }
      return heights
    }
    const collapsed = height()
    const opening = await sample(() => toggle().click())
    const open = opening.at(-1)!
    expect(open).toBeGreaterThan(collapsed + 100)
    expect(list().closest('[inert]')).toBeNull()
    const closing = await sample(() => toggle().click())
    const between = (heights: number[]) =>
      heights.filter(value => value > collapsed + 2 && value < open - 2).length
    // Скачок — ни одной промежуточной высоты; под нагрузкой движка кадров перехода мало.
    expect(between(opening)).toBeGreaterThanOrEqual(2)
    expect(between(closing)).toBeGreaterThanOrEqual(2)
    expect(closing.at(-1)).toBe(collapsed)
    expect(list().closest('[inert]')).not.toBeNull()
    await guide.unmount()

    // Область истории выше таблицы: консоль — сразу за рамкой, отступ как у гайда.
    const fixed = await render(<SkeletonDataArrives />)
    await expect.poll(() => byTestId('story-console')).not.toBeNull()
    const tableFrame = [...document.querySelectorAll<HTMLElement>('div')].find(
      element =>
        element.contains(document.querySelector('.data-grid__container')) &&
        getComputedStyle(element).borderTopWidth === '1px' &&
        getComputedStyle(element).borderBottomWidth === '1px',
    )!
    const box = (element: Element) => element.getBoundingClientRect()
    expect(box(byTestId('story-console')!).top - box(tableFrame).bottom).toBe(
      box(tableFrame).top - box(byTestId('guide')!).bottom,
    )
    await fixed.unmount()

    // Демо-история: консоль — под гридом.
    await render(<RowExpandingLazy />)
    await expect.poll(() => byTestId('story-console')).not.toBeNull()
    expect(
      byTestId('story-console')!.getBoundingClientRect().top,
    ).toBeGreaterThanOrEqual(
      document.querySelector('.data-grid__container')!.getBoundingClientRect()
        .bottom,
    )
    expect(toggle().getAttribute('aria-expanded')).toBe('false')
  })

  test('CL3: смена среза состояния пишет запись «Состояние» с ключом и значением; подписка и запись того же значения записей не пишут', async () => {
    const log = createConsoleLog()
    const { table } = await mountHost(log)
    const states = () => log.entries().filter(entry => entry.kind === 'state')
    expect(states()).toEqual([])

    await userEvent.hover(sortButton())
    await humanClick(sortButton())
    await expect
      .poll(() => states().find(entry => entry.name === 'sorting')?.detail)
      .toContain('id:"country"')
    const instance = table() as {
      atoms: { sorting: { get: () => unknown } }
      setSorting: (value: unknown) => void
    }
    const before = log.entries().length
    instance.setSorting(instance.atoms.sorting.get())
    await frame()
    await frame()
    expect(log.entries()).toHaveLength(before)
  })

  test('CL7: записи — таблица «Тип», «Событие», «Время» до секунд, «Длительность» колбэка; новые снизу; список держится у последней записи, пока его не прокрутили вверх; без записей — вместо таблицы текст по центру окна', async () => {
    const log = createConsoleLog()
    await mountHost(log)
    toggle().click()
    // Без записей таблицы с шапкой нет, текст — по центру окна списка.
    log.clear()
    const table = () => list().querySelector('table')!
    const empty = () =>
      list().querySelector<HTMLElement>('[data-console-empty]')!
    const shown = (element: HTMLElement) =>
      getComputedStyle(element).display !== 'none'
    await expect.poll(() => shown(table())).toBe(false)
    expect(shown(empty())).toBe(true)
    expect(empty().textContent).toBe('Событий пока нет')
    await expect
      .poll(() => list().getBoundingClientRect().height, { timeout: 3000 })
      .toBeGreaterThan(200)
    const center = (rect: DOMRect) => ({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    })
    const range = document.createRange()
    range.selectNodeContents(empty())
    const text = center(range.getBoundingClientRect())
    const area = center(list().getBoundingClientRect())
    expect(Math.abs(text.x - area.x)).toBeLessThan(2)
    expect(Math.abs(text.y - area.y)).toBeLessThan(2)
    toggle().click()

    for (let index = 0; index < 40; index++) log.log('server', `page ${index}`)
    log.write('state', 'sorting', '[]')
    log.write('state', 'sorting', '[{id:"country"}]')
    toggle().click()
    const items = () => [
      ...list().querySelectorAll<HTMLElement>('[data-console-kind]'),
    ]
    await expect.poll(() => items().at(-1)?.textContent).toContain('sorting')
    const last = items().at(-1)!
    expect(shown(table())).toBe(true)
    expect(shown(empty())).toBe(false)
    const headers = [...list().querySelectorAll('thead th')].map(
      header => header.textContent,
    )
    expect(headers).toEqual(['Тип', 'Событие', 'Время', 'Длительность'])
    const cells = (row: HTMLElement) =>
      [...row.querySelectorAll<HTMLElement>('td')].map(each =>
        each.textContent!.trim(),
      )
    expect(cells(last)).toEqual([
      'Состояние',
      'sorting [{id:"country"}] ×2',
      expect.stringMatching(/^\d{2}:\d{2}:\d{2}$/),
      '',
    ])
    expect(cells(items().at(-2)!).slice(0, 2)).toEqual([
      'Действие',
      'server page 39 · история',
    ])
    log.write('callback', 'onSave', '1')
    log.measured(log.entries().at(-1)!.id, 12.4)
    await expect.poll(() => cells(items().at(-1)!)[3]).toBe('12 мс')
    const atBottom = () =>
      list().scrollTop + list().clientHeight >= list().scrollHeight - 4
    await expect.poll(atBottom).toBe(true)

    // Прокрутили вверх — новые записи не уводят список вниз.
    list().scrollTop = 0
    list().dispatchEvent(new Event('scroll'))
    log.log('server', 'later')
    await expect.poll(() => items().at(-1)?.textContent).toContain('later')
    expect(list().scrollTop).toBe(0)
    // Вернулись вниз — список снова следует за записями.
    list().scrollTop = list().scrollHeight
    list().dispatchEvent(new Event('scroll'))
    log.log('server', 'latest')
    await expect.poll(() => items().at(-1)?.textContent).toContain('latest')
    await expect.poll(atBottom).toBe(true)
  })

  test('CL8: поповер «Фильтры» — строки видов «Действия», «Колбэки», «Состояние», «Жизненный цикл» с галочками и «Показать все»: снятая галочка скрывает записи вида, поставленная — показывает; «Очистить» очищает журнал', async () => {
    const log = createConsoleLog()
    await mountHost(log)
    await userEvent.hover(sortButton())
    await humanClick(sortButton())
    toggle().click()
    // Раскрытие сдвигает «Фильтры» между нажатием и отпусканием — клик уходит мимо.
    await settle()
    const kinds = () =>
      new Set(
        [...list().querySelectorAll<HTMLElement>('[data-console-kind]')].map(
          row => row.dataset.consoleKind,
        ),
      )
    await expect
      .poll(() => [...kinds()].sort())
      .toEqual(['action', 'callback', 'lifecycle', 'state'])
    const all = kinds()

    await humanClick(byTestId('story-console-filters')!)
    const row = (kind: string) =>
      document.querySelector<HTMLElement>(`[data-console-filter="${kind}"]`)!
    const rows = () => [
      ...document.querySelectorAll<HTMLElement>('[data-console-filter]'),
    ]
    await expect.poll(() => rows().length).toBe(4)
    expect(rows().map(item => item.textContent)).toEqual([
      'Действия',
      'Колбэки',
      'Состояние',
      'Жизненный цикл',
    ])
    expect(
      rows().every(
        item =>
          item.querySelector('[aria-checked]')?.getAttribute('aria-checked') ===
          'true',
      ),
    ).toBe(true)

    // Снятая галочка скрывает записи только своего вида.
    await humanClick(row('state'))
    await expect.poll(() => kinds().has('state')).toBe(false)
    expect(kinds()).toEqual(new Set(['action', 'callback', 'lifecycle']))
    // Поставленная — показывает их снова: записи скрыты, а не удалены.
    await humanClick(row('state'))
    await expect.poll(() => kinds()).toEqual(all)

    for (const kind of ['state', 'lifecycle', 'action']) {
      // eslint-disable-next-line no-await-in-loop
      await humanClick(row(kind))
    }
    await expect.poll(() => kinds()).toEqual(new Set(['callback']))
    const showAll = [
      ...byTestId('story-console-filters-menu')!.querySelectorAll<HTMLElement>(
        'button',
      ),
    ].find(button => button.textContent === 'Показать все')!
    await humanClick(showAll)
    await expect.poll(() => kinds()).toEqual(all)

    await userEvent.keyboard('{Escape}')
    await expect.poll(() => byTestId('story-console-filters-menu')).toBeNull()
    await humanClick(byTestId('story-console-clear')!)
    await expect.poll(() => kinds().size).toBe(0)
    expect(log.entries()).toEqual([])
    expect(list().textContent).toContain('Событий пока нет')
  })

  test('CL15: действие грида из onDebugAction — строка вида «Действие» с номером, плагином, действием, деталями и источником; итог с cause ссылается на номер исходного действия', async () => {
    const log = createConsoleLog()
    await mountHost(log)
    toggle().click()
    // Скрытая кнопка заголовка шириной ноль, пока указатель не на заголовке.
    await userEvent.hover(sortButton().closest('.data-grid__head-cell')!)
    await userEvent.hover(sortButton())
    await humanClick(sortButton())
    const actionRows = () => [
      ...list().querySelectorAll<HTMLElement>('tr[data-console-kind="action"]'),
    ]
    await expect
      .poll(() => actionRows().at(-1)?.textContent)
      .toMatch(/#\d+ columnSorting «[^»]+» \{column:"country"\} · мышь/)
    const sorted = actionRows().at(-1)!
    expect(sorted.dataset.consoleChild).toBeUndefined()
    // Итог ссылается на номер исходного действия.
    log.action({ plugin: 'rowActions', action: 'deleteRow', id: 41 })
    log.action({
      plugin: 'rowActions',
      action: 'deleteRowRejected',
      source: 'auto',
      cause: 41,
    })
    await expect
      .poll(() => actionRows().at(-1)?.textContent)
      .toMatch(/rowActions · deleteRowRejected · грид ← #41/)
  })

  test('CL16: шаг гайда и смена аргумента Storybook — действия истории', async () => {
    const guide = await render(<ConsoleGuideEvents />)
    await expect.poll(() => byTestId('story-console')).not.toBeNull()
    await expect
      .poll(() => list().textContent)
      .toContain('Шаг 1 · Таблица открыта')
    toggle().click()
    byTestId('guide-toggle')!.click()
    await expect.poll(() => byTestId('guide-next')).not.toBeNull()
    byTestId('guide-next')!.click()
    await expect
      .poll(() => list().textContent, { timeout: 3000 })
      .toContain('Шаг 2 · Включена сортировка')
    await guide.unmount()

    // Смена аргумента — «Контрол <ключ>: было → стало», перед её последствиями.
    const log = createConsoleLog()
    const view = await render(
      <WithConsole log={log} args={{ ...ARGS, enableRowDragging: true }}>
        <StoryComponent {...ARGS} enableRowDragging />
      </WithConsole>,
    )
    await waitForQuietDocument()
    await view.rerender(
      <WithConsole log={log} args={{ ...ARGS, enableRowDragging: false }}>
        <StoryComponent {...ARGS} enableRowDragging={false} />
      </WithConsole>,
    )
    await expect
      .poll(() =>
        log
          .entries()
          .filter(entry => entry.kind === 'action')
          .map(entry => entry.name),
      )
      .toContain('Контрол enableRowDragging: true → false')
    const names = log.entries().map(entry => entry.name)
    expect(
      names.indexOf('Контрол enableRowDragging: true → false'),
    ).toBeLessThan(names.lastIndexOf('Плагины'))
  })

  test('CL9: консоль не добавляет гриду работы — коммиты React, отрисованные компоненты и пересборки моделей строк при сортировке с консолью и без неё одинаковы', async ({
    skip,
  }) => {
    skip(
      server.browser !== 'chromium',
      'measureWork — трейс CDP, только Chromium (ADR 0099)',
    )
    await motion.reducedMotion(true)
    try {
      const sortWork = async (log?: ConsoleLog) => {
        const { screen, table } = await mountHost(log)
        const grid = document.querySelector<HTMLElement>(
          '.data-grid__container',
        )!
        await userEvent.hover(sortButton())
        await waitForQuietDocument()
        // Полоса дорастает в следующем кадре после смены списка (ADR 0202, §1а): замер — до
        // покоя, иначе рост попадает в одну сторону сравнения.
        const work = await measureWork(
          grid,
          async () => {
            await humanClick(sortButton())
            await waitForQuietDocument(300)
          },
          { table: table(), models: ['coreRowModel', 'sortedRowModel'] },
        )
        if (log) {
          expect(log.entries().some(entry => entry.name === 'sorting')).toBe(
            true,
          )
        }
        await screen.unmount()
        return work
      }
      const without = await sortWork()
      const withConsole = await sortWork(createConsoleLog())
      expect(withConsole.commits).toBe(without.commits)
      expect(withConsole.rendered).toBe(without.rendered)
      expect(withConsole.builds).toEqual(without.builds)
    } finally {
      await motion.reducedMotion(false)
    }
  })

  test('CL10: раскрытая консоль — область «Консоль», список — role="log" без живого объявления; axe с color-contrast у консоли и поповера «Фильтры» в светлой и тёмной темах', async () => {
    // Тема — классом на предке, как у декоратора Storybook: порталы её не наследуют.
    for (const dark of [false, true]) {
      {
        // eslint-disable-next-line no-await-in-loop
        const screen = await render(
          <div className={dark ? 'dark' : undefined}>
            <ConsoleGuideEvents />
          </div>,
        )
        // eslint-disable-next-line no-await-in-loop
        await expect.poll(() => byTestId('story-console')).not.toBeNull()
        toggle().click()
        // eslint-disable-next-line no-await-in-loop
        await expect
          .poll(() => list().querySelectorAll('[data-console-kind]').length)
          .toBeGreaterThan(0)
        const panel = byTestId('story-console')!
        expect(panel.tagName).toBe('SECTION')
        expect(panel.getAttribute('aria-label')).toBe('Консоль')
        expect(list().getAttribute('role')).toBe('log')
        expect(list().getAttribute('aria-live')).toBe('off')
        // eslint-disable-next-line no-await-in-loop
        const { violations } = await axe.run(panel, {
          ...AXE_OPTIONS,
          rules: { ...AXE_OPTIONS.rules, 'color-contrast': { enabled: true } },
        })
        expect(violations, dark ? 'dark' : 'light').toEqual([])
        // Поповер «Фильтры» — тоже без нарушений.
        byTestId('story-console-filters')!.click()
        // eslint-disable-next-line no-await-in-loop
        await expect
          .poll(() => byTestId('story-console-filters-menu'))
          .not.toBeNull()
        // eslint-disable-next-line no-await-in-loop
        const menu = await axe.run(byTestId('story-console-filters-menu')!, {
          ...AXE_OPTIONS,
          rules: { ...AXE_OPTIONS.rules, 'color-contrast': { enabled: true } },
        })
        expect(menu.violations, `menu ${dark ? 'dark' : 'light'}`).toEqual([])
        // Поповер — в теме истории: тёмный фон в тёмной теме, светлый — в светлой.
        const popupLight = luminance(
          getComputedStyle(byTestId('story-console-filters-menu')!)
            .backgroundColor,
        )
        if (dark) expect(popupLight).toBeLessThan(0.2)
        else expect(popupLight).toBeGreaterThan(0.6)
        // eslint-disable-next-line no-await-in-loop
        await screen.unmount()
      }
    }
  })

  test('CL11: кнопки демо-истории — в заголовке консоли, видны и нажимаются в свёрнутом виде', async () => {
    await render(<RowExpandingLazy />)
    await expect.poll(() => byTestId('story-console-actions')).not.toBeNull()
    expect(toggle().getAttribute('aria-expanded')).toBe('false')
    const button = [
      ...byTestId('story-console-actions')!.querySelectorAll('button'),
    ].find(each => each.textContent === 'Fail next load')!
    expect(button.closest('[inert]')).toBeNull()
    expect(button.getBoundingClientRect().height).toBeGreaterThan(0)
    await humanClick(button)
    // Свёрнутый список инертен: его `innerText` WebKit отдаёт пустым.
    await expect.poll(() => list().textContent).toContain('next load will fail')
  })

  test('CL12: в каталоге счётчик событий скрыт — снимок свёрнутой консоли не зависит от числа событий', async () => {
    await render(<ConsoleGuideEvents />)
    await expect.poll(() => byTestId('story-console')).not.toBeNull()
    const count = toggle().querySelector<HTMLElement>('[data-console-count]')!
    expect(getComputedStyle(count).visibility).toBe('visible')
    document.documentElement.classList.add('tsr-catalog')
    try {
      expect(getComputedStyle(count).visibility).toBe('hidden')
      // Другое число событий: видимая часть заголовка и высота консоли — те же.
      const title = toggle().querySelector('strong')!
      const panel = byTestId('story-console')!
      const before = {
        title: title.getBoundingClientRect().toJSON(),
        height: panel.getBoundingClientRect().height,
      }
      count.textContent = '· 99999 событий'
      expect(title.getBoundingClientRect().toJSON()).toEqual(before.title)
      expect(panel.getBoundingClientRect().height).toBe(before.height)
      expect(getComputedStyle(count).visibility).toBe('hidden')
    } finally {
      document.documentElement.classList.remove('tsr-catalog')
    }
  })
})
