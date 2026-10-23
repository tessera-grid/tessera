import type { Args } from '@storybook/react'
import {
  STORY_RENDERED,
  UPDATE_STORY_ARGS,
} from 'storybook/internal/core-events'
import { addons } from 'storybook/preview-api'
import { expect, userEvent, waitFor } from 'storybook/test'

import { guideSteps } from '../demos/GuideStory'
import {
  PLAY_ARGS,
  type TwinSource,
  forcedTwin,
  registerStepTwin,
} from './catalog'

// Помощники `play` историй-состояний каталога (ADR 0093, VR4–VR8): история доводит
// грид до состояния и заканчивается в покое — по нему каталог проверяет axe и
// Chromatic снимает снимок.

const LOAD_TIMEOUT = 5000

export const sleep = (ms: number) =>
  new Promise(resolve => setTimeout(resolve, ms))

/** Конечные анимации доиграны: снимок и axe не застают промежуточный кадр. */
export const settle = async () => {
  await new Promise(resolve => requestAnimationFrame(resolve))
  for (const animation of document.getAnimations()) {
    if (animation.effect?.getTiming().iterations !== Infinity) {
      animation.finish()
    }
  }
  await new Promise(resolve => requestAnimationFrame(resolve))
}

/** Ждёт, пока проверка пройдёт: задержки демо-«сервера» длиннее таймаута `waitFor`. */
export const until = <T>(check: () => T) =>
  waitFor(check, { timeout: LOAD_TIMEOUT })

/**
 * Снимает фокус, оставленный действиями `play`: снимок состояния — без кольца фокуса.
 * `holder` — узел, куда фокус приходит не сразу (закрытый редактор отдаёт его ячейке).
 */
export const releaseFocus = async (holder?: () => Element) => {
  if (holder) {
    await until(() =>
      expect(holder().contains(document.activeElement)).toBe(true),
    )
  }
  const focused = document.activeElement
  if (focused instanceof HTMLElement) focused.blur()
  await until(() => expect(document.activeElement).toBe(document.body))
}

type StepRun = (label: string, run: () => unknown) => unknown
interface PlayContext {
  step: StepRun
  id?: string
  canvasElement?: HTMLElement
}
type Play = (context: PlayContext) => Promise<void>

/** Проигрывание гайда дошло до шага близнеца. */
const STEP_REACHED = Symbol('step-reached')

/**
 * Близнец шага `step` (с 1) истории сценария для снимка в высокой контрастности
 * (ADR 0130, DG3): `play` истории проходит гайд и останавливается после этого шага.
 * Псевдо-состояние шага (`pseudo`) — наведение, которое в гайде делает человек, —
 * близнец ставит сам.
 */
export const forcedStep = <S extends TwinSource>(
  meta: TwinSource,
  story: S,
  step: number,
  base: TwinSource = {},
): S => {
  registerStepTwin(meta, story, step)
  const twin = forcedTwin(meta, story, base)
  const play = story.play as Play
  return {
    ...twin,
    parameters: { ...twin.parameters, guideStep: step },
    play: async (context: PlayContext) => {
      let done = 0
      let reached = ''
      try {
        await play({
          ...context,
          step: async (label, run) => {
            await context.step(label, run)
            done++
            if (done !== step) return
            reached = label
            throw STEP_REACHED
          },
        })
      } catch (error) {
        if (error !== STEP_REACHED) throw error
      }
      const root = context.canvasElement?.querySelector('[data-guide-root]')
      const pseudo = root
        ? guideSteps.get(root)?.find(item => item.title === reached)?.pseudo
        : undefined
      if (pseudo && context.id) await applyPseudoStates(context.id, pseudo)
      await settle()
    },
  }
}

export interface Point {
  x: number
  y: number
}

export const centerOf = (el: Element): Point => {
  const box = el.getBoundingClientRect()
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
}

/**
 * Берёт ручку и держит над точкой `to`, не отпуская (ADR 0130, DG4): события указателя
 * для `PointerSensor` dnd-kit, без Playwright. Нажатие — на ручку, движение и отпускание
 * — на документ: ручка строки, ушедшей в слот, перемонтируется, и события на её прежний
 * узел никуда не дошли бы.
 */
export const dragHold = async (handle: HTMLElement, to: Point, steps = 12) => {
  let at = centerOf(handle)
  const fire = (type: string, point: Point) =>
    (type === 'pointerdown' ? handle : handle.ownerDocument).dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true,
        button: 0,
        buttons: type === 'pointerup' ? 0 : 1,
        clientX: point.x,
        clientY: point.y,
      }),
    )
  /** Ведёт указатель к точке за `count` кадров, не отпуская. */
  const moveTo = async (target: Point, count = steps) => {
    const from = at
    for (let i = 1; i <= count; i++) {
      at = {
        x: from.x + ((target.x - from.x) * i) / count,
        y: from.y + ((target.y - from.y) * i) / count,
      }
      fire('pointermove', at)
      await new Promise(resolve => requestAnimationFrame(resolve))
    }
  }
  fire('pointerdown', at)
  await moveTo(to)
  return {
    moveTo,
    /** Где сейчас указатель. */
    point: () => at,
    /** Отпускает там, где держит: бросок. */
    release: () => fire('pointerup', at),
    /** Escape: перетаскивание отменяется, строка или колонка остаётся на месте. */
    cancel: () =>
      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Escape',
          code: 'Escape',
          bubbles: true,
        }),
      ),
  }
}

export type HeldDrag = Awaited<ReturnType<typeof dragHold>>

export const waitForRows = (canvas: HTMLElement) =>
  until(() =>
    expect(canvas.querySelector('.data-grid__body-row')).not.toBeNull(),
  )

export const byTestId = (id: string) =>
  document.querySelector<HTMLElement>(`[data-testid="${id}"]`)

/**
 * Текст записей консоли истории (ADR 0124), и свёрнутой: как `innerText` — запись строкой,
 * ячейки через табуляцию. `innerText` свёрнутой инертной консоли WebKit отдаёт пустым.
 */
export const consoleText = () => {
  const log = byTestId('story-console-log')
  if (!log) return ''
  return [...log.children]
    .filter(part => (part as HTMLElement).style.display !== 'none')
    .flatMap(part =>
      part instanceof HTMLTableElement
        ? [...part.rows].map(row =>
            [...row.cells].map(cell => cell.textContent).join('\t'),
          )
        : [part.textContent ?? ''],
    )
    .join('\n')
}

/** Строки тела в порядке модели, а не монтирования. */
export const orderedRows = (canvas: HTMLElement) =>
  [...canvas.querySelectorAll<HTMLElement>('.data-grid__body-row')].sort(
    (a, b) => Number(a.dataset.index) - Number(b.dataset.index),
  )

/** Строка тела по индексу в модели. */
export const rowAt = (canvas: HTMLElement, index: number) =>
  canvas.querySelector<HTMLElement>(
    `.data-grid__body-row[data-index="${index}"]`,
  )!

/** Текст ячейки колонки в первой строке модели. */
export const firstRowText = (canvas: HTMLElement, column: string) =>
  orderedRows(canvas)[0]
    ?.querySelector(`[data-column-id="${column}"]`)
    ?.textContent?.trim()

/**
 * Меняет аргументы истории посреди `play`: живой Storybook и Chromatic обрабатывают
 * событие сами, в проектах каталога его слушает `PlayArgs` (`__mocks__/catalog.tsx`).
 */
export const updateArgs = async (storyId: string, updatedArgs: Args) => {
  const channel = addons.getChannel()
  channel.emit(UPDATE_STORY_ARGS, { storyId, updatedArgs })
  channel.emit(PLAY_ARGS, { storyId, updatedArgs })
  await settle()
}

export const headCell = (canvas: HTMLElement, column: string) =>
  canvas.querySelector<HTMLElement>(
    `.data-grid__head-cell[data-column-id="${column}"]`,
  )!

/** Кнопка меню колонки — по признаку, а не по подписи: подпись зависит от языка. */
export const headKebab = (canvas: ParentNode, column: string) =>
  canvas.querySelector<HTMLElement>(
    `.data-grid__head-cell[data-column-id="${column}"] [data-action-menu]`,
  )

/** Кнопка меню строки — по признаку, а не по подписи. */
export const rowKebab = (row: ParentNode | undefined) =>
  row?.querySelector<HTMLElement>('[data-action-menu="row"]') ?? null

/**
 * Действие шага гайда: открыть меню нажатием на его кнопку. Нажатие повторяется, пока
 * меню не откроется, — кнопка готова не сразу после появления строк; таймером, а не
 * кадрами: в фоновой вкладке кадры стоят.
 */
export const openMenuBy = (button: () => HTMLElement | null | undefined) => {
  let tries = 0
  const run = () => {
    if (document.querySelector('[role="menu"][data-open]') || ++tries > 40)
      return
    if (!document.querySelector('[role="menu"]')) button()?.click()
    setTimeout(run, 100)
  }
  setTimeout(run, 0)
}

export const bodyRow = (canvas: HTMLElement, row: string) =>
  canvas.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${row}"]`,
  )!

export const bodyCell = (canvas: HTMLElement, row: string, column: string) =>
  bodyRow(canvas, row).querySelector<HTMLElement>(
    `.data-grid__body-cell[data-column-id="${column}"]`,
  )!

/**
 * Класс аддона псевдо-состояний для состояния из `parameters.catalogPseudo`. Не `pseudo`:
 * его аддон пишет в глобалы, и наведение переходит на строки следующих историй.
 */
const PSEUDO_CLASS: Record<string, string> = {
  hover: 'pseudo-hover',
  focus: 'pseudo-focus',
  focusVisible: 'pseudo-focus-visible',
  active: 'pseudo-active',
}

/**
 * Псевдо-состояния на смонтированных узлах (ADR 0093, VR8). Аддон переписывает правила
 * в эффекте, который Storybook запускает событием отрисовки этой истории, — в проектах
 * каталога и в тестах его нет, поэтому оно шлётся здесь; классы аддон ставит до того,
 * как виртуализатор смонтирует строки, — их ставит `play`.
 */
export const applyPseudoStates = async (
  storyId: string,
  pseudo: Record<string, string | string[] | undefined>,
) => {
  addons.getChannel().emit(STORY_RENDERED, storyId)
  for (const [state, selectors] of Object.entries(pseudo)) {
    const className = PSEUDO_CLASS[state]
    if (!className || !selectors) continue
    for (const selector of [selectors].flat()) {
      for (const element of document.querySelectorAll(selector)) {
        element.classList.add(className)
      }
    }
  }
  await settle()
}

/** Ждёт открытый поповер с ролью и отдаёт его. */
export const waitForPopup = (role: string) =>
  waitFor(
    () => {
      const popup = document.querySelector<HTMLElement>(`[role="${role}"]`)
      expect(popup).not.toBeNull()
      return popup!
    },
    { timeout: LOAD_TIMEOUT },
  )

/**
 * Открывает меню или панель кнопкой: наведение грузит ленивый модуль (ADR 0061), клик
 * открывает уже загруженный — клик без наведения ждал бы загрузки в обход истории.
 */
export const openPopup = async (
  trigger: () => HTMLElement | null,
  role = 'dialog',
) => {
  // Кнопку ищем на каждой попытке: заглушку до загрузки модуля сменяет настоящая.
  await waitFor(() => expect(trigger()).not.toBeNull(), {
    timeout: LOAD_TIMEOUT,
  })
  await userEvent.hover(trigger()!)
  for (let attempt = 0; attempt < 8; attempt++) {
    await sleep(300)
    if (document.querySelector(`[role="${role}"]`)) break
    const current = trigger()
    if (current && current.getAttribute('aria-expanded') !== 'true') {
      await userEvent.click(current)
    }
  }
  const popup = await waitForPopup(role)
  await settle()
  return popup
}

/** Открытый поповер целиком внутри холста истории (VR6). */
export const expectPopupInCanvas = (
  canvas: HTMLElement,
  popup: HTMLElement,
) => {
  const frame = canvas.firstElementChild!.getBoundingClientRect()
  const box = popup.getBoundingClientRect()
  expect(box.width).toBeGreaterThan(0)
  expect(box.top).toBeGreaterThanOrEqual(frame.top)
  expect(box.left).toBeGreaterThanOrEqual(frame.left)
  expect(box.bottom).toBeLessThanOrEqual(frame.bottom)
  expect(box.right).toBeLessThanOrEqual(frame.right)
}

/**
 * Шаг сценария (ADR 0117, §6): раскрыть панель сценария, нажать «Далее» и дождаться
 * смены шага — как человек. Переход на последний шаг выполняет и его (SN16).
 */
export const guideNext = async (canvas: HTMLElement) => {
  const panel = canvas.querySelector<HTMLElement>('[data-testid="guide"]')!
  const toggle = panel.querySelector<HTMLElement>(
    '[data-testid="guide-toggle"]',
  )!
  if (toggle.getAttribute('aria-expanded') !== 'true') {
    await userEvent.click(toggle)
  }
  const next = panel.querySelector<HTMLButtonElement>(
    '[data-testid="guide-next"]',
  )!
  await until(() => expect(next).toBeEnabled())
  await userEvent.click(next)
  await until(() => expect(panel).not.toHaveAttribute('data-busy'))
}
