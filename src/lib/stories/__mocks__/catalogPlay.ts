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

/**
 * Ждёт условие в действии шага гайда (ADR 0117, SN36). Не `waitFor`: тот на время
 * ожидания включает среду `act` React, и консоль Storybook полна предупреждений.
 * Всегда хотя бы одна задача: StrictMode прерывает первый запуск эффекта синхронно, и
 * прерывание видно только после неё.
 */
export const pollUntil = async (
  check: () => boolean,
  signal?: AbortSignal,
  timeout = LOAD_TIMEOUT,
) => {
  const start = performance.now()
  await sleep(0)
  signal?.throwIfAborted()
  while (!check()) {
    if (performance.now() - start > timeout) {
      throw new Error(`Шаг гайда не дождался: ${check.toString()}`)
    }
    await sleep(16)
    signal?.throwIfAborted()
  }
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
 * узел никуда не дошли бы. `signal` — уход с шага гайда: движение обрывается.
 * Ручка или точка `target` за краем окна — страница сперва прокручивается так, что путь
 * между ними по центру окна, `target` — вместе с ней (SN44): указатель за краем включил
 * бы автопрокрутку страницы dnd-kit. Пока указатель идёт к `target`, события настоящей
 * мыши до dnd-kit не доходят (`shieldHeldDrag`): WebKit после прокрутки шлёт `mousemove`
 * в точку курсора, и облако уходило к ней.
 */
export const dragHold = async (
  handle: HTMLElement,
  target: Point,
  steps = 12,
  signal?: AbortSignal,
) => {
  const before = centerOf(handle)
  const outside = (value: number, size: number) => value < 0 || value > size
  if (
    outside(before.y, window.innerHeight) ||
    outside(target.y, window.innerHeight) ||
    outside(before.x, window.innerWidth) ||
    outside(target.x, window.innerWidth)
  ) {
    window.scrollBy({
      top: (before.y + target.y - window.innerHeight) / 2,
      left: (before.x + target.x - window.innerWidth) / 2,
      behavior: 'instant',
    })
  }
  let at = centerOf(handle)
  const to = { x: target.x + at.x - before.x, y: target.y + at.y - before.y }
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
    const lift = shieldHeldDrag()
    try {
      for (let i = 1; i <= count; i++) {
        signal?.throwIfAborted()
        at = {
          x: from.x + ((target.x - from.x) * i) / count,
          y: from.y + ((target.y - from.y) * i) / count,
        }
        fire('pointermove', at)
        await new Promise(resolve => requestAnimationFrame(resolve))
      }
    } finally {
      lift()
    }
  }
  fire('pointerdown', at)
  await moveTo(to)
  return {
    moveTo,
    /** Где сейчас указатель. */
    point: () => at,
    /**
     * Отпускает там, где держит: бросок. Промис — когда dnd-kit перестал глотать клики:
     * нажатие сразу после броска он проглотил бы.
     */
    release: async () => {
      fire('pointerup', at)
      await new Promise(resolve => setTimeout(resolve, DRAG_CLICK_RELEASE))
    },
    /** Escape: перетаскивание отменяется, строка или колонка остаётся на месте. */
    cancel: cancelDrag,
  }
}

/**
 * Пользователь нажал Escape вне полей ввода. От `body`, а не от документа: обработчик клавиш
 * Storybook читает атрибуты цели, у документа их нет.
 */
export const pressEscape = () =>
  document.body.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Escape',
      code: 'Escape',
      bubbles: true,
    }),
  )

/** Escape: удержанное перетаскивание отменяется; без перетаскивания — ничего. */
export const cancelDrag = pressEscape

/** События указателя, по которым dnd-kit ведёт и заканчивает перетаскивание. */
const DRAG_POINTER = ['pointermove', 'pointerup', 'pointercancel']

/** Через сколько dnd-kit после отмены перестаёт глотать клики на документе (50 мс). */
const DRAG_CLICK_RELEASE = 100

/**
 * Пока шаг гайда держит перетаскивание (ADR 0117, SN36), события указателя на узлах
 * страницы не доходят до dnd-kit — он слушает документ: мышь увела бы облако, а
 * нажатие «Далее» стало бы броском. Удержание шлёт события самому документу — их
 * фильтр пропускает. Клик по обвязке гайда (панель, консоль) dnd-kit на время
 * перетаскивания глотает — фильтр отменяет удержание и повторяет клик, когда dnd-kit
 * отпустил документ. Фильтр на странице один, сколько бы удержаний его ни просили;
 * возвращает снятие своей просьбы — повторное ничего не делает.
 */
export const shieldHeldDrag = () => {
  if (shield.holders++ === 0) {
    const html = document.documentElement
    for (const type of DRAG_POINTER) html.addEventListener(type, stopPointer)
    window.addEventListener('click', passClick, true)
  }
  let lifted = false
  return () => {
    if (lifted) return
    lifted = true
    if (--shield.holders > 0) return
    const html = document.documentElement
    for (const type of DRAG_POINTER) html.removeEventListener(type, stopPointer)
    window.removeEventListener('click', passClick, true)
  }
}

const shield = { holders: 0, replaying: false }

const stopPointer = (event: Event) => event.stopPropagation()

const passClick = (event: MouseEvent) => {
  const target = event.target
  if (
    shield.replaying ||
    !(target instanceof HTMLElement) ||
    !target.closest('[data-guide-root]') ||
    target.closest('.data-grid__container')
  ) {
    return
  }
  event.stopImmediatePropagation()
  event.preventDefault()
  cancelDrag()
  setTimeout(() => {
    shield.replaying = true
    target.click()
    shield.replaying = false
  }, DRAG_CLICK_RELEASE)
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
 * Действие шага гайда — после отрисовки строк: ждёт таймером, а не кадрами (в фоновой
 * вкладке кадры стоят). Уход с шага прерывает его — `signal`: иначе цикл прошлого шага
 * спорит за таблицу с циклом нового.
 */
export const afterRows =
  (action: (root: HTMLElement, signal: AbortSignal) => void) =>
  (root: HTMLElement) => {
    const controller = new AbortController()
    const run = () => {
      if (controller.signal.aborted) return
      if (root.querySelector('.data-grid__body-row')) {
        action(root, controller.signal)
      } else setTimeout(run, 50)
    }
    setTimeout(run, 0)
    return () => controller.abort()
  }

/**
 * Действие шага гайда: открыть меню нажатием на его кнопку. Нажатие повторяется, пока
 * меню не откроется, — кнопка готова не сразу после появления строк; таймером, а не
 * кадрами: в фоновой вкладке кадры стоят.
 */
export const openMenuBy = (
  button: () => HTMLElement | null | undefined,
  signal?: AbortSignal,
) => {
  let tries = 0
  const run = () => {
    if (
      signal?.aborted ||
      document.querySelector('[role="menu"][data-open]') ||
      ++tries > 40
    )
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
 * Указатель над кнопкой, как мышь пользователя, — действие шага гайда: тултип открывают
 * события указателя, вид наведения — класс аддона псевдо-состояний (`:hover` скрипт не
 * включит). Возвращает уход указателя.
 */
export const pointAt = (target: HTMLElement) => {
  const box = target.getBoundingClientRect()
  const at = {
    bubbles: true,
    cancelable: true,
    composed: true,
    clientX: box.left + box.width / 2,
    clientY: box.top + box.height / 2,
    pointerType: 'mouse',
    pointerId: 1,
    isPrimary: true,
  }
  const enter = { ...at, relatedTarget: document.body }
  target.classList.add('pseudo-hover')
  target.dispatchEvent(new PointerEvent('pointerover', enter))
  target.dispatchEvent(new MouseEvent('mouseover', enter))
  target.dispatchEvent(new PointerEvent('pointermove', at))
  target.dispatchEvent(new MouseEvent('mousemove', at))
  return () => {
    target.classList.remove('pseudo-hover')
    const out = { ...at, relatedTarget: document.body }
    target.dispatchEvent(new PointerEvent('pointerout', out))
    target.dispatchEvent(new MouseEvent('mouseout', out))
  }
}

/** Текст открытого тултипа. */
export const tooltipText = () =>
  [...document.querySelectorAll<HTMLElement>('[role="tooltip"], [data-side]')]
    .map(el => el.textContent?.trim() ?? '')
    .find(Boolean) ?? ''

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

/** Действие шага гайда (`stepAction`) дошло до состояния шага. */
export const stepDone = (canvas: HTMLElement) =>
  waitFor(
    () => {
      const root = canvas.querySelector<HTMLElement>('[data-guide-root]')!
      expect(root).toHaveAttribute(
        'data-step-action',
        `done:${root.dataset.guideStep}`,
      )
    },
    { timeout: STEP_ACTION_TIMEOUT },
  )

/**
 * Вспышка итога короче шага: наблюдатель ставится до действия и запоминает, что цель
 * `selector` вспыхнула итогом `outcome` (ADR 0134).
 */
export const watchFlash = (
  root: ParentNode,
  selector: string,
  outcome: string,
) => {
  let most = 0
  const check = () => {
    const lit = [...root.querySelectorAll(selector)].filter(
      el => el.getAttribute('data-flash') === outcome,
    ).length
    most = Math.max(most, lit)
  }
  const observer = new MutationObserver(check)
  observer.observe(root as Node, {
    subtree: true,
    attributes: true,
    attributeFilter: ['data-flash'],
  })
  check()
  return {
    seen: () => most > 0,
    /** Сколько целей вспыхнули разом — наибольшее за время наблюдения. */
    most: () => most,
    stop: () => observer.disconnect(),
  }
}

/** Перетаскивание с паузой над группой и ответом «сервера» — дольше загрузки. */
const STEP_ACTION_TIMEOUT = 15_000

/** Номер шага, на котором стоит гайд. */
const currentGuideStep = (panel: HTMLElement) =>
  [...panel.querySelectorAll('[data-testid="guide-steps"] ol > li')].findIndex(
    item => item.getAttribute('aria-current') === 'step',
  )

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
  const from = currentGuideStep(panel)
  await userEvent.click(next)
  // Клик может дойти не сразу: удерживающий шаг повторяет его (`shieldHeldDrag`).
  await until(() => expect(currentGuideStep(panel)).not.toBe(from))
  await until(() => expect(panel).not.toHaveAttribute('data-busy'))
}
