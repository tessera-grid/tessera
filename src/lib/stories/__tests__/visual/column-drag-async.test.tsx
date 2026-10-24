import axe from 'axe-core'
import { commands, server, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test, vi } from 'vitest'
import { arcHeadOf, pendingArcOf, revealedHandleWidth } from '../helpers'

import { ENGLISH_LABELS } from '../../../core/localization'
import { composed } from '../stories'
import { AXE_OPTIONS, inBothThemes, toRgba } from './a11y-helpers'
import { withWideViewport } from './column-pinning-helpers'
import {
  ColumnDraggingGrid,
  HeaderGroupsDraggingGrid,
} from './columns-fixtures'

// Асинхронный перенос колонок (ADR 0114): промис `onColumnDragEnd` — ожидание на ручке,
// отказ возвращает колонку к прежним соседям; ручка — кнопка кита, раскрывается по ширине.
// Промисами управляет тест; перетаскивание — настоящей мышью Playwright (TQ3).

type Point = { x: number; y: number }
const pointer = commands as unknown as {
  realDragHold: (from: Point, to: Point, steps?: number) => Promise<void>
  realMouseUp: () => Promise<void>
  realMouseMove: (from: Point, to: Point, steps?: number) => Promise<void>
  reducedMotion: (reduce: boolean) => Promise<void>
  forcedColors: (active: boolean) => Promise<void>
}

const HEAD = '.data-grid__head-cell'
const HANDLE = '.drag__handler--column'
const OVERLAY = '.data-grid-head__cell--overlay'
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const head = (id: string) =>
  document.querySelector<HTMLElement>(
    `${HEAD}[data-column-id="${id}"]:not([data-cell-pinned="left"])`,
  )!
const handleOf = (id: string) => head(id).querySelector<HTMLElement>(HANDLE)!
const wrapperOf = (id: string) => handleOf(id).parentElement!
const titleOf = (id: string) =>
  head(id).querySelector<HTMLElement>('.data-grid__cell-wrapper-title')!
const order = () =>
  [...document.querySelectorAll<HTMLElement>(`${HEAD}[data-column-id]`)]
    .filter(cell => cell.dataset.actionsColumnCell !== 'true')
    .sort(
      (a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left,
    )
    .map(cell => cell.dataset.columnId!)
const announced = () =>
  [...document.querySelectorAll('[aria-live]')]
    .map(region => region.textContent)
    .join('|')
/** Тон подсветки колонки на заголовке и на ячейке тела. */
const tone = (id: string) => head(id).getAttribute('data-column-highlight')
const bodyTone = (id: string) =>
  document
    .querySelector(`.data-grid__body-cell[data-column-id="${id}"]`)
    ?.getAttribute('data-column-highlight') ?? null
const menu = () => document.querySelector<HTMLElement>('[role="menu"]')
const menuItem = (label: string) =>
  [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
    item => item.textContent?.trim() === label,
  )!

interface Deferred {
  resolve: () => void
  reject: (reason: unknown) => void
}
const moves: Deferred[] = []
let asyncMoves = true
const onColumnDragEnd = vi.fn((): void | Promise<void> => {
  if (!asyncMoves) return undefined
  return new Promise<void>((resolve, reject) => moves.push({ resolve, reject }))
})
const settleMoves = async (ok = true, reason?: unknown) => {
  for (const move of moves.splice(0)) {
    if (ok) move.resolve()
    else move.reject(reason)
  }
  await sleep(50)
}

const renderGrid = async (
  args: Record<string, unknown> = {},
  Story: typeof ColumnDraggingGrid = ColumnDraggingGrid,
) => {
  moves.length = 0
  asyncMoves = true
  onColumnDragEnd.mockClear()
  const screen = await render(
    <Story
      columnCount={6}
      enableKeyboardNavigation
      onColumnDragEnd={onColumnDragEnd}
      {...args}
    />,
  )
  await expect.poll(() => order().length).toBeGreaterThan(3)
  return screen
}

/** Навести на заголовок и дождаться, пока ручка раскроется целиком. */
const reveal = async (id: string) => {
  await userEvent.hover(head(id))
  await expect
    .poll(() => wrapperOf(id).getBoundingClientRect().width)
    .toBe(revealedHandleWidth(handleOf(id)))
}

const center = (el: Element): Point => {
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

/** Перетащить колонку `id` правее колонки `targetId` настоящей мышью. */
const dragAfter = async (id: string, targetId: string) => {
  await reveal(id)
  const from = center(handleOf(id))
  const target = head(targetId).getBoundingClientRect()
  await pointer.realDragHold(from, {
    x: target.left + target.width * 0.6,
    y: from.y,
  })
  await pointer.realMouseUp()
  await expect.poll(() => document.querySelector(OVERLAY)).toBeNull()
}

/** Группа «Info» шапки историй: подгруппа и листья, вспыхивающие с ней. */
const GROUP_NODES = ['info', 'more-info', 'age', 'gender', 'visits']

/** Перенести группу на шаг влево из меню её ручки. */
const moveGroupLeft = async (id: string) => {
  const before = order()
  await reveal(id)
  await userEvent.click(handleOf(id))
  await expect.poll(menu).toBeTruthy()
  await userEvent.click(menuItem(ENGLISH_LABELS.moveLeft))
  await expect.poll(order).not.toEqual(before)
}

/** Увести указатель из шапки. */
const away = async () => {
  const r = head(order()[0]!).getBoundingClientRect()
  await pointer.realMouseMove(
    { x: r.left + 20, y: r.top + 10 },
    { x: r.left + 20, y: r.bottom + 300 },
    2,
  )
}

describe('Асинхронный перенос колонок (ADR 0114)', () => {
  test('CO1: onColumnDragEnd может вернуть промис — при броске мышью, с Alt+Shift+стрелками и из меню ручки; синхронный колбэк — успех сразу', async () => {
    await withWideViewport(async () => {
      const screen = await renderGrid()
      try {
        const [a, b, c, d] = order()
        await dragAfter(a!, b!)
        expect(order().indexOf(a!)).toBe(1)
        expect(handleOf(a!).getAttribute('aria-busy'), 'мышь').toBe('true')
        await settleMoves()
        await expect
          .poll(() => handleOf(a!).hasAttribute('aria-busy'))
          .toBe(false)

        head(c!).focus()
        await userEvent.keyboard('{Alt>}{Shift>}{ArrowRight}{/Shift}{/Alt}')
        await expect.poll(() => order().indexOf(c!)).toBe(3)
        expect(handleOf(c!).getAttribute('aria-busy'), 'клавиатура').toBe(
          'true',
        )
        await settleMoves()

        await reveal(d!)
        await userEvent.click(handleOf(d!))
        await expect.poll(menu).toBeTruthy()
        await userEvent.click(menuItem(ENGLISH_LABELS.moveRight))
        await expect.poll(() => order().indexOf(d!)).toBeGreaterThan(2)
        expect(handleOf(d!).getAttribute('aria-busy'), 'меню').toBe('true')
        await settleMoves()

        asyncMoves = false
        const before = order()
        await dragAfter(before[0]!, before[1]!)
        expect(order().indexOf(before[0]!)).toBeGreaterThan(0)
        expect(
          handleOf(before[0]!).hasAttribute('aria-busy'),
          'синхронно',
        ).toBe(false)
        expect(onColumnDragEnd).toHaveBeenCalledTimes(4)
      } finally {
        await screen.unmount()
      }
    })
  })

  test('CO2: пока промис не выполнен — ручка ждёт, у заголовка aria-busy; колонку не переносят ни ручкой, ни меню, ни с клавиатуры; другие колонки переносятся', async () => {
    await withWideViewport(async () => {
      const screen = await renderGrid()
      try {
        const [a, b, c, d] = order()
        await dragAfter(a!, b!)
        expect(handleOf(a!).getAttribute('aria-busy')).toBe('true')
        expect(head(a!).getAttribute('aria-busy')).toBe('true')
        const pending = order()

        // Ручка не тянется.
        const from = center(handleOf(a!))
        await pointer.realDragHold(from, { x: from.x + 300, y: from.y })
        await sleep(150)
        expect(document.querySelector(OVERLAY), 'тянется').toBeNull()
        await pointer.realMouseUp()
        // Меню не открывается.
        await userEvent.click(handleOf(a!), { force: true })
        await sleep(150)
        expect(menu(), 'меню').toBeNull()
        // С клавиатуры не переносится.
        head(a!).focus()
        await userEvent.keyboard('{Alt>}{Shift>}{ArrowRight}{/Shift}{/Alt}')
        await sleep(100)
        expect(order(), 'клавиатура').toEqual(pending)
        expect(onColumnDragEnd).toHaveBeenCalledTimes(1)

        // Другая колонка переносится.
        await dragAfter(c!, d!)
        expect(onColumnDragEnd).toHaveBeenCalledTimes(2)
        await settleMoves()
        await expect.poll(() => head(a!).hasAttribute('aria-busy')).toBe(false)
      } finally {
        await screen.unmount()
      }
    })
  })

  test('CO3: отказ — узел, лист или группа, возвращается к прежним соседям по id, переносы других колонок сохраняются; ручка вспыхивает, отказ объявляется', async () => {
    await withWideViewport(async () => {
      let screen = await renderGrid()
      try {
        const [a, b, c, d, e] = order()
        await dragAfter(a!, c!)
        const failing = moves.splice(0)
        // Пока перенос ждёт, переставили другие колонки.
        await dragAfter(d!, e!)
        await settleMoves()
        const others = order().filter(id => id !== a)
        failing[0]!.reject(new Error('Server said no'))
        // Колонка — перед прежним правым соседом, остальной порядок — как был.
        await expect
          .poll(() => order().indexOf(b!) - order().indexOf(a!))
          .toBe(1)
        expect(order().filter(id => id !== a)).toEqual(others)
        await expect
          .poll(() => handleOf(a!).getAttribute('data-error-flash'))
          .toBe('on')
        await expect
          .poll(announced)
          .toContain(ENGLISH_LABELS.announceColumnMoveFailed('Server said no'))
        await screen.unmount()

        // Группа под вложенной шапкой возвращается блоком листьев.
        screen = await renderGrid({}, HeaderGroupsDraggingGrid)
        const groups = () =>
          [
            ...document.querySelectorAll<HTMLElement>(
              `${HEAD}[data-header-stretched], ${HEAD}`,
            ),
          ]
            .filter(
              cell =>
                cell.querySelector(HANDLE) && cell.getAttribute('aria-colspan'),
            )
            .sort(
              (x, y) =>
                x.getBoundingClientRect().left - y.getBoundingClientRect().left,
            )
            .map(cell => cell.dataset.columnId!)
        const [group] = groups()
        const leavesBefore = order()
        await reveal(group!)
        await userEvent.click(handleOf(group!))
        await expect.poll(menu).toBeTruthy()
        await userEvent.click(menuItem(ENGLISH_LABELS.moveRight))
        await expect.poll(order).not.toEqual(leavesBefore)
        await settleMoves(false, new Error('no'))
        await expect.poll(order).toEqual(leavesBefore)
        await expect
          .poll(() => handleOf(group!).getAttribute('data-error-flash'))
          .toBe('on')
      } finally {
        await screen.unmount()
      }
    })
  })

  test('CO13: колонка после переноса — броском, с Alt+Shift+стрелками и из меню ручки — сразу вспыхивает слоем подсветки колонки тоном arrival; группа — целиком', async () => {
    await withWideViewport(async () => {
      let screen = await renderGrid()
      try {
        const [a, b, c, d] = order()
        await dragAfter(a!, b!)
        expect(tone(a!), 'мышь').toBe('arrival')
        expect(bodyTone(a!), 'ячейки колонки').toBe('arrival')
        expect(tone(b!), 'соседи не вспыхивают').toBeNull()

        head(c!).focus()
        await userEvent.keyboard('{Alt>}{Shift>}{ArrowRight}{/Shift}{/Alt}')
        await expect
          .poll(() => tone(c!), { message: 'клавиатура' })
          .toBe('arrival')

        await reveal(d!)
        await userEvent.click(handleOf(d!))
        await expect.poll(menu).toBeTruthy()
        await userEvent.click(menuItem(ENGLISH_LABELS.moveRight))
        await expect.poll(() => tone(d!), { message: 'меню' }).toBe('arrival')
        await settleMoves()
        await expect.poll(() => tone(a!), { timeout: 4000 }).toBeNull()
        await screen.unmount()

        screen = await renderGrid({}, HeaderGroupsDraggingGrid)
        await moveGroupLeft('info')
        for (const id of GROUP_NODES) {
          await expect.poll(() => tone(id), { message: id }).toBe('arrival')
        }
        expect(tone('name'), 'сосед не вспыхивает').toBeNull()
      } finally {
        await screen.unmount()
      }
    })
  })

  test('CO18: при отказе колонка подсвечивается тоном danger там, где оказалась — после отката на прежнем месте, без отката на новом; группа — целиком', async () => {
    await withWideViewport(async () => {
      let screen = await renderGrid()
      try {
        const [a, b] = order()
        await dragAfter(a!, b!)
        await settleMoves(false, new Error('no'))
        await expect.poll(() => tone(a!)).toBe('danger')
        await expect
          .poll(() => order().indexOf(a!), { message: 'откат' })
          .toBe(0)
        await screen.unmount()

        screen = await renderGrid({ columnDraggingRevertOnReject: false })
        const [x, y] = order()
        await dragAfter(x!, y!)
        await settleMoves(false, new Error('no'))
        await expect.poll(() => tone(x!)).toBe('danger')
        expect(order().indexOf(x!), 'без отката').toBe(1)
        await screen.unmount()

        screen = await renderGrid({}, HeaderGroupsDraggingGrid)
        await moveGroupLeft('info')
        await settleMoves(false, new Error('no'))
        for (const id of GROUP_NODES) {
          await expect.poll(() => tone(id), { message: id }).toBe('danger')
        }
      } finally {
        await screen.unmount()
      }
    })
  })

  test('CO6: ручка — компактная квадратная кнопка кита, в покое не видна и шириной 0, подпись на отступе содержимого; при наведении и клавиатурном фокусе раскрывается переходом размера, заходит в отступ и сдвигает подпись; во время прокрутки и при уменьшенном движении — сразу', async () => {
    await withWideViewport(async () => {
      const screen = await renderGrid()
      try {
        const [a, b] = order()
        await away()
        expect(handleOf(a!).tagName).toBe('BUTTON')
        expect(handleOf(a!).dataset.shape).toBe('square')
        expect(wrapperOf(a!).getBoundingClientRect().width).toBe(0)
        expect(getComputedStyle(wrapperOf(a!)).opacity).toBe('0')
        const restTitle = titleOf(a!).getBoundingClientRect().left
        const content = head(a!).querySelector<HTMLElement>(
          '.data-grid__cell-wrapper-content',
        )!
        const contentStyle = getComputedStyle(content)
        const contentLeft =
          content.getBoundingClientRect().left +
          parseFloat(contentStyle.paddingLeft)
        // В покое подпись — на отступе содержимого: скрытая ручка не оставляет зазора.
        expect(restTitle).toBeCloseTo(contentLeft, 0)
        const { transitionProperty, transitionDuration } = getComputedStyle(
          wrapperOf(a!),
        )
        expect(transitionProperty).toContain('grid-template-columns')
        expect(
          transitionDuration.split(',').some(value => parseFloat(value) > 0),
        ).toBe(true)

        await reveal(a!)
        expect(getComputedStyle(wrapperOf(a!)).opacity).toBe('1')
        // Компактная кнопка заходит в отступ содержимого: слева от неё — отступ ручки,
        // подпись сдвигается ровно на раскрытую обёртку.
        expect(handleOf(a!).dataset.size).toBe('compact')
        const inset = document.createElement('div')
        inset.style.width = 'var(--tsr-comp-drag-handle-inset)'
        content.append(inset)
        const insetPx = inset.getBoundingClientRect().width
        inset.remove()
        expect(
          Math.abs(
            handleOf(a!).getBoundingClientRect().left -
              content.getBoundingClientRect().left -
              insetPx,
          ),
        ).toBeLessThan(1)
        expect(
          titleOf(a!).getBoundingClientRect().left - restTitle,
        ).toBeCloseTo(revealedHandleWidth(handleOf(a!)), 0)
        await away()
        await expect
          .poll(() => wrapperOf(a!).getBoundingClientRect().width)
          .toBe(0)

        // Клавиатурный фокус заголовка раскрывает ручку: стрелкой с соседнего, а не
        // фокусом от скрипта — его `:focus-visible` в Firefox и WebKit не даёт.
        head(a!).focus()
        await userEvent.keyboard('{ArrowRight}')
        expect(document.activeElement).toBe(head(b!))
        await expect
          .poll(() => wrapperOf(b!).getBoundingClientRect().width)
          .toBe(revealedHandleWidth(handleOf(b!)))
        head(b!).blur()

        // Во время прокрутки ширина — без перехода.
        const scroller = document.querySelector<HTMLElement>(
          '.data-grid__container',
        )!
        scroller.setAttribute('data-scrolling', '')
        expect(
          getComputedStyle(wrapperOf(a!)).transitionProperty,
        ).not.toContain('grid-template-columns')
        scroller.removeAttribute('data-scrolling')

        await pointer.reducedMotion(true)
        try {
          expect(
            getComputedStyle(wrapperOf(a!))
              .transitionDuration.split(',')
              .every(value => parseFloat(value) === 0),
          ).toBe(true)
        } finally {
          await pointer.reducedMotion(false)
        }
      } finally {
        await screen.unmount()
      }
    })
  })

  test('CO7: в ожидании и при вспышке ошибки ручка раскрыта и видна без наведения', async () => {
    await withWideViewport(async () => {
      const screen = await renderGrid()
      try {
        const [a, b] = order()
        await dragAfter(a!, b!)
        await away()
        await sleep(400)
        expect(handleOf(a!).getAttribute('aria-busy')).toBe('true')
        expect(wrapperOf(a!).getBoundingClientRect().width, 'ожидание').toBe(
          revealedHandleWidth(handleOf(a!)),
        )
        expect(getComputedStyle(wrapperOf(a!)).opacity).toBe('1')

        await settleMoves(false, new Error('no'))
        await expect
          .poll(() => handleOf(a!).getAttribute('data-error-flash'))
          .toBe('on')
        expect(wrapperOf(a!).getBoundingClientRect().width, 'вспышка').toBe(
          revealedHandleWidth(handleOf(a!)),
        )
        await expect
          .poll(() => handleOf(a!).hasAttribute('data-error-flash'), {
            timeout: 4000,
          })
          .toBe(false)
        await expect
          .poll(() => wrapperOf(a!).getBoundingClientRect().width)
          .toBe(0)
      } finally {
        await screen.unmount()
      }
    })
  })

  test('CO11: axe с контрастом в обеих темах во время ожидания и после отказа; высокая контрастность — свет ожидания ручки Highlight, ошибка — Mark', async () => {
    await withWideViewport(async () => {
      const screen = await renderGrid()
      const sys = (color: string) => {
        const probe = document.createElement('span')
        probe.style.color = color
        document.body.append(probe)
        const value = getComputedStyle(probe).color
        probe.remove()
        return toRgba(value)
      }
      const checkAxe = () =>
        inBothThemes(async () => {
          const result = await axe.run(
            document.querySelector<HTMLElement>(
              '[role="grid"], [role="table"], [role="treegrid"]',
            )!,
            {
              ...AXE_OPTIONS,
              rules: {
                ...AXE_OPTIONS.rules,
                'color-contrast': { enabled: true },
              },
            },
          )
          expect(result.violations).toEqual([])
        })
      // Красный контур держится 300 мс — меньше, чем идут откат колонки и смена режима.
      document
        .querySelector<HTMLElement>('.data-grid-theme')!
        .style.setProperty('--tsr-comp-error-flash-duration', '10s')
      try {
        const [a, b] = order()
        await dragAfter(a!, b!)
        await checkAxe()
        if (server.browser !== 'webkit') {
          await pointer.forcedColors(true)
          // Дуга ожидания ручки (ADR 0127) — цветом Highlight.
          const arc = pendingArcOf(handleOf(a!))!
          expect(getComputedStyle(arc).forcedColorAdjust).toBe('none')
          expect(toRgba(getComputedStyle(arcHeadOf(arc)).stroke)).toEqual(
            sys('Highlight'),
          )
          await pointer.forcedColors(false)
        }
        await settleMoves(false, new Error('no'))
        await expect
          .poll(() => handleOf(a!).getAttribute('data-error-flash'))
          .toBe('on')
        if (server.browser !== 'webkit') {
          await pointer.forcedColors(true)
          const error = getComputedStyle(handleOf(a!)).getPropertyValue(
            '--tsr-comp-error-flash-color',
          )
          expect(toRgba(error.trim())).toEqual(sys('Mark'))
          await pointer.forcedColors(false)
        }
        await checkAxe()
      } finally {
        await pointer.forcedColors(false)
        await screen.unmount()
      }
    })
  })
})
