/**
 * История сценария (ADR 0117, §6): панель шагов над гридом истории. Шаг меняет пропсы
 * грида — накопительно, от первого шага до текущего — и может выполнить действие при
 * входе в него (прокрутку). «Сначала» перемонтирует грид, как новое открытие.
 */
import {
  type SyntheticEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import type { TesseraFeatureEntry } from '../../core/features'
import { INPUT_MODALITY_ATTR } from '../../core/inputModality'
import { scrollToRow } from '../../core/scrollToRow/scrollToRowFeature'
import { useIsomorphicLayoutEffect } from '../../util/useIsomorphicLayoutEffect'
import { useLatest } from '../../util/useLatest'
import {
  createGuideDemo,
  HOVER_MS,
  isLiveStorybook,
  keyLabel,
  PRESS_MS,
  sleep,
  TYPE_MS,
} from './guideDemo'
import { StoryComponent } from '../DataGridStory'
import type { StoryProps } from '../DataGridStory.types'
import { dataGridMeta } from '../dataGridMeta'
import type { CatalogState } from '../__mocks__/catalog'
import { getData } from '../__mocks__/data'
import { normalizeArgs } from '../__mocks__/utils/normalizeArgs'
import { type GuideStep, GuidePanel, useGuide } from './GuidePanel'
import { StoryLocaleProvider } from '../__mocks__/storyLocale'
import {
  type StoryLocale,
  type StoryText,
  storyLocaleOf,
  textOf,
} from '../__mocks__/storyText'
import { shellText } from './storyShell'
import {
  createFocusGuard,
  type FocusGuard,
  keepsFocus,
  OWN_CHROME,
  GUIDE_FRESH,
  STEP_ACTION_DONE,
} from './guideFocus'
import { StoryConsole } from './StoryConsole'
import { type ConsoleLog, createConsoleLog } from './consoleLog'
import { useArgsActions } from './useArgsActions'

/**
 * Что знает шаг: аргументы истории, ответ «сервера» — строки мока по ним — и
 * приложение: колбэк грида меняет через него пропсы до нового открытия грида; `log` —
 * консоль истории, куда пишут свои элементы приложения.
 */
export interface GuideContext {
  args: StoryProps
  rows: NonNullable<StoryProps['dataOverride']>
  app: GuideApp
  log: ConsoleLog
}

export interface GuideStoryStep extends GuideStep {
  /** Пропсы грида с этого шага: поверх аргументов истории и прежних шагов. */
  props?: (context: GuideContext) => Partial<StoryProps>
  /**
   * Действие при входе в шаг — то, что сделал бы пользователь (прокрутка); `app` — то,
   * что делает приложение посреди шага (данные меняются извне). Возвращённая функция
   * снимает то, что действие оставило, при уходе с шага.
   */
  enter?: (root: HTMLElement, app: GuideApp) => unknown
  /** Шаг открывает грид заново: опции на время жизни таблицы (`initialPageSize`). */
  remount?: boolean
  /** Состояния каталога, которые показывает шаг: матрица контраста — во всех сочетаниях. */
  states?: CatalogState[]
  /**
   * Псевдо-состояние шага (`{ hover: '<селектор>' }`): человек наводит сам, матрица
   * контраста ставит классы `pseudo-*`.
   */
  pseudo?: Record<string, string | string[]>
  /** Короткое состояние (вспышка): матрица контраста проверяет его сразу после шага. */
  immediate?: boolean
  /**
   * Шаг про клавиатуру: фокус, который поставило его действие, и признак клавиатурного
   * ввода остаются — кольцо фокуса входит в состояние шага (SN57).
   */
  keyboard?: boolean
}

/**
 * Приложение посреди шага: пропсы поверх пропсов шагов до следующего открытия грида —
 * «Сначала», шага с `remount` или шага назад.
 */
export interface GuideApp {
  update: (change: (props: Partial<StoryProps>) => Partial<StoryProps>) => void
}

/** Что действие шага знает о своём времени: уход с шага прерывает его. */
export interface StepRun {
  signal: AbortSignal
  /** Снять при уходе с шага то, что действие оставило (удержанное перетаскивание). */
  onLeave: (undo: () => void) => void
}

/**
 * Действие шага, идущее во времени (ADR 0117, SN36): перетаскивание, ожидание ответа
 * «сервера». Уход с шага прерывает его — `signal` — и снимает оставленное. Пока оно
 * идёт, у корня гайда `data-step-action="running"`, когда дошло — `"done:<номер шага>"`:
 * отметка прошлого шага не сходит за отметку нового.
 */
export const stepAction =
  (
    run: (root: HTMLElement, step: StepRun, app: GuideApp) => Promise<unknown>,
  ) =>
  (root: HTMLElement, app: GuideApp) => {
    const controller = new AbortController()
    const undo: (() => void)[] = []
    const step = root.dataset.guideStep
    root.setAttribute('data-step-action', 'running')
    run(root, { signal: controller.signal, onLeave: fn => undo.push(fn) }, app)
      .then(() => {
        if (!controller.signal.aborted) {
          root.dispatchEvent(new Event(STEP_ACTION_DONE))
          root.setAttribute('data-step-action', `done:${step}`)
        }
      })
      // Сбой действия виден в консоли — каталог роняет историю с `console.error`.
      .catch((error: unknown) => {
        if (!controller.signal.aborted) console.error(error)
      })
    return () => {
      controller.abort()
      root.removeAttribute('data-step-action')
      for (const fn of undo.reverse()) fn()
    }
  }

/** Клавиши, которые таблицу не меняют: вход по Tab и одиночные модификаторы. */
const PASSIVE_KEYS = new Set(['Tab', 'Shift', 'Control', 'Alt', 'Meta'])

/** Ввод человека, который до таблицы не доходит, пока идёт действие шага (SN43). */
const SHIELDED = [
  'pointerdown',
  'mousedown',
  'click',
  'touchstart',
  'wheel',
  'keydown',
]

/**
 * События действия шага, которые доходят до ячейки тела только в виду (SN45): нажатие,
 * меню, наведение, клавиша. Движение и отпускание прокрутку не запускают — иначе
 * перетаскивание к краю таблицы крутило бы её к ячейкам, — а ждут вместе с ними.
 */
const REVEALING = new Set([
  'pointerdown',
  'mousedown',
  'click',
  'dblclick',
  'contextmenu',
  'pointerover',
  'mouseover',
  'keydown',
])
const HELD = [
  ...REVEALING,
  'input',
  'pointerup',
  'mouseup',
  'pointermove',
  'mousemove',
  'pointerout',
  'mouseout',
]

/** Поля событий, которые переносит повтор: у мыши и указателя — ещё и координаты. */
const EVENT_FIELDS = [
  'bubbles',
  'cancelable',
  'composed',
  'detail',
  'view',
  'screenX',
  'screenY',
  'clientX',
  'clientY',
  'button',
  'buttons',
  'relatedTarget',
  'pointerId',
  'pointerType',
  'isPrimary',
  'key',
  'code',
  'location',
  'repeat',
  'ctrlKey',
  'shiftKey',
  'altKey',
  'metaKey',
] as const

/** Нажатия: цель сперва показывает наведение и нажатие, в точке — волна (SN46). */
const CLICKING = new Set(['click', 'dblclick', 'contextmenu'])
/**
 * Нажатие кнопки мыши: волна сразу, без ожидания — с него начинаются перетаскивание и
 * выделение мышью, и задержка сорвала бы их (SN50).
 */
const PRESSING = new Set(['pointerdown', 'mousedown'])
/**
 * Щелчок без нажатия кнопки мыши (`click()`) в гриде: без нажатия фокус, вошедший в грид
 * извне, клавиатурная навигация примет за вход по Tab (SN59). Кроме кнопки меню: меню
 * Base UI открывается уже нажатием кнопки, и щелчок после него переключил бы его обратно.
 */
const isBareGridClick = (event: Event, target: Element) =>
  event.type === 'click' &&
  (event as MouseEvent).detail === 0 &&
  !!target.closest('[role="grid"], [role="treegrid"], [role="table"]') &&
  !target.closest('[aria-haspopup="menu"]')
const HOVERING = new Set(['pointerover', 'mouseover'])
/** Признаки недорисованного грида (ADR 0203, §6). */
const GRID_PENDING = '[data-tsr-grid-pending], [data-portions-pending]'
/**
 * Сколько действие шага ждёт первую строку открытого заново грида, мс: у таблицы без строк
 * (заглушка, загрузка) ждать нечего.
 */
const ROWS_WAIT_MS = 2000
const UNHOVERING = new Set(['pointerout', 'mouseout'])
/**
 * После показанного нажатия: события того же жеста на той же цели доходят сразу, а повтор
 * самого нажатия — пока таблица на него отвечает (ленивый поповер грузится) — отбрасывается, мс.
 */
const GESTURE_MS = 1000

type TextField = HTMLInputElement | HTMLTextAreaElement
const TEXT_TYPES = new Set([
  'text',
  'search',
  'number',
  'email',
  'tel',
  'url',
  'password',
])
const isTextField = (target: EventTarget | null): target is TextField =>
  target instanceof HTMLTextAreaElement ||
  (target instanceof HTMLInputElement && TEXT_TYPES.has(target.type))
/** Значение поля мимо React — как ставят его помощники историй. */
const setFieldValue = (field: TextField, value: string) =>
  Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(field),
    'value',
  )!.set!.call(field, value)
const commonStart = (a: string, b: string) => {
  let length = 0
  while (length < a.length && length < b.length && a[length] === b[length])
    length++
  return length
}
/** Точка события: его координаты со сдвигом прокрутки или середина цели. */
const pointOf = (
  event: Event,
  target: Element | null,
  dx: number,
  dy: number,
) => {
  const box = target?.getBoundingClientRect()
  // Координаты события — только если они на цели: шаг шлёт нажатие кнопке с точкой
  // середины ячейки, а волна должна быть на кнопке.
  if (event instanceof MouseEvent && (event.clientX || event.clientY)) {
    const x = event.clientX + dx
    const y = event.clientY + dy
    if (
      !box ||
      (x >= box.left && x <= box.right && y >= box.top && y <= box.bottom)
    )
      return { x, y }
  }
  return box
    ? { x: box.left + box.width / 2, y: box.top + box.height / 2 }
    : { x: 0, y: 0 }
}
/** Где показать клавишу: у цели, а у клавиши странице — у таблицы. */
const keyBox = (target: Element, area: Element) =>
  (target === document.body || target === document.documentElement
    ? (area.querySelector('.data-grid__container') ?? target)
    : target
  ).getBoundingClientRect()

/** Ячейка тела (или строка) под целью события. */
const bodyCellOf = (target: Element) =>
  // Копия строки в липкой стопке видна над телом всегда: прокручивать к ней нечего.
  target.closest('[data-sticky-rows]')
    ? null
    : (target.closest<HTMLElement>('.data-grid__body-row [data-column-id]') ??
      target.closest<HTMLElement>('.data-grid__body-row'))

/** Середина ячейки видна: её не закрывают край прокрутки, шапка и закреплённые колонки. */
const inView = (cell: HTMLElement) => {
  const box = cell.getBoundingClientRect()
  const hit = document.elementFromPoint(
    box.left + box.width / 2,
    box.top + box.height / 2,
  )
  return !!hit && cell.contains(hit)
}

/** Цель целиком или частью вне окна страницы. */
const outsideWindow = (element: Element) => {
  const box = element.getBoundingClientRect()
  return (
    box.top < 0 ||
    box.left < 0 ||
    box.bottom > innerHeight ||
    box.right > innerWidth
  )
}

/** Цель встала на место: два кадра подряд без сдвига, не дольше полсекунды. */
const settledBox = async (element: Element) => {
  let last = element.getBoundingClientRect()
  for (let frames = 0, still = 0; frames < 30 && still < 2; frames++) {
    await new Promise(resolve => requestAnimationFrame(resolve))
    const box = element.getBoundingClientRect()
    still = box.left === last.left && box.top === last.top ? still + 1 : 0
    last = box
  }
}

/** Нажатие по панели гайда, которое не должно закрывать меню и поповеры таблицы. */
const PANEL_PRESS = ['pointerdown', 'mousedown', 'touchstart']

/**
 * Ввод человека, на который компоненты порождают свои события (SN65). Наведения и движения
 * нет: оно приходит и от неподвижного курсора, когда под ним меняется вёрстка.
 */
const HUMAN = [
  'pointerdown',
  'pointerup',
  'mousedown',
  'mouseup',
  'click',
  'dblclick',
  'contextmenu',
  'keydown',
  'keyup',
  'input',
  'change',
  'touchstart',
  'touchend',
]

/** Показ нажатия прерван: шаг остановлен вводом человека (SN66). */
const STOPPED = Symbol('stopped')

/**
 * Состояние цели для повтора нажатия: занятость и отметка. Кнопка стала занятой — второе
 * нажатие новое («стоп»); раскрытие не в счёт — поповер ещё грузится, а повтор его закрыл бы.
 */
const STATE_ATTRS = [
  'aria-busy',
  'data-pending',
  'aria-pressed',
  'aria-checked',
]
const stateOf = (target: Element) =>
  STATE_ATTRS.map(name => target.getAttribute(name)).join('|')

/** Узел под точкой события мыши; у события без точки — никакого. */
const hitOf = (event: Event) =>
  event instanceof MouseEvent && (event.clientX || event.clientY)
    ? document.elementFromPoint(event.clientX, event.clientY)
    : null

/** Повтор события на прежней цели: координаты сдвинуты вместе с ней. */
const replayOf = (
  event: Event,
  dx: number,
  dy: number,
  mouse?: { x: number; y: number },
) => {
  const init: Record<string, unknown> = {}
  for (const field of EVENT_FIELDS)
    if (field in event) init[field] = event[field as keyof Event]
  // Щелчок, показанный нажатием мыши, — щелчок мыши: иначе меню Base UI, открытое
  // нажатием кнопки, примет его за клавиатурный и закроет.
  if (mouse)
    Object.assign(init, {
      clientX: mouse.x - dx,
      clientY: mouse.y - dy,
      screenX: mouse.x - dx,
      screenY: mouse.y - dy,
      detail: 1,
      button: 0,
      pointerType: 'mouse',
      pointerId: 1,
      isPrimary: true,
    })
  if (typeof init.clientX === 'number') {
    init.clientX += dx
    init.screenX = Number(init.screenX) + dx
    init.clientY = Number(init.clientY) + dy
    init.screenY = Number(init.screenY) + dy
  }
  const Type = event.constructor as new (type: string, init: object) => Event
  return new Type(event.type, init)
}

/** Прокрутка таблицы позже стольких мс после колеса — не от него, мс. */
const WHEEL_SCROLL_MS = 150

/** Шаги смонтированных гайдов по их корню — их признаки читает матрица контраста. */
export const guideSteps = new WeakMap<Element, readonly GuideStoryStep[]>()

/**
 * Аргументы грида истории сценария с гайдом (ADR 0117, SN27–SN28): умолчания меты и
 * свои — аргументы Storybook, оставшиеся в URL или сессии, функции не включают; из
 * них — только тема и язык из тулбара.
 */
export const guideArgs = (
  own: Partial<StoryProps>,
  storybook: Pick<StoryProps, 'colorMode' | 'locale'>,
): StoryProps =>
  normalizeArgs({
    ...dataGridMeta.args,
    ...own,
    colorMode: storybook.colorMode,
    locale: storybook.locale,
  } as StoryProps)

export const GuideStory = ({
  title,
  steps,
  args,
  reset,
  showActions: showActionsProp,
}: {
  /** Название гайда: пара `{ ru, en }` (ADR 0225). */
  title: StoryText
  steps: readonly GuideStoryStep[]
  args: StoryProps
  /**
   * Сброс обвязки истории вне таблицы (мок-сервер, флажки) перед каждым открытием грида
   * (SN72): шаг, к которому перешли, находит её такой же, как при первом открытии.
   */
  reset?: () => void
  /** Показ действий шага (SN46–SN52); по умолчанию — только в живом Storybook. */
  showActions?: boolean
}) => {
  const [showActions] = useState(() => showActionsProp ?? isLiveStorybook())
  const guide = useGuide(steps.length)
  // Журнал консоли живёт, пока открыта история: «Сначала» его не стирает.
  const [consoleLog] = useState(createConsoleLog)
  const rows = useMemo(
    () => getData(args.dataCount, args.dataNesting),
    [args.dataCount, args.dataNesting],
  )
  const [appProps, setAppProps] = useState<{
    mount: string
    props: Partial<StoryProps>
  }>()
  // Открытие грида, к которому относятся пропсы приложения: ставится до эффектов шага.
  const mountRef = useRef('')
  const [app] = useState<GuideApp>(() => ({
    update: change =>
      setAppProps(prev => {
        const current = prev?.mount === mountRef.current ? prev.props : {}
        const props = change(current)
        return props === current && prev
          ? prev
          : { mount: mountRef.current, props }
      }),
  }))
  const context: GuideContext = { args, rows, app, log: consoleLog }
  const props = steps
    .slice(0, guide.step + 1)
    .reduce<Partial<StoryProps>>(
      (all, step) => ({ ...all, ...step.props?.(context) }),
      {},
    )
  // Новое открытие грида — «Сначала» или шаг с `remount`.
  const mounts = steps
    .slice(0, guide.step + 1)
    .filter(step => step.remount).length
  // Грид открывается заново с пропсами целевого шага: шаг назад через действие (SN33) и
  // любой переход после того, как человек изменил таблицу (`changed`, SN40–SN41).
  const [shown, setShown] = useState({
    step: guide.step,
    run: guide.run,
    rewinds: 0,
    changed: false,
  })
  if (shown.step !== guide.step || shown.run !== guide.run) {
    const undone = steps.slice(guide.step + 1, shown.step + 1)
    const fresh = shown.changed || undone.some(step => step.enter)
    setShown({
      step: guide.step,
      run: guide.run,
      rewinds: shown.rewinds + (fresh ? 1 : 0),
      changed: false,
    })
  }
  // Остановка действия шага и его показа — тем же путём, что уход с шага (SN66).
  const leaveStep = useRef<(() => void) | undefined>(undefined)
  const showControl = useRef<{ stop: () => void; resume: () => void }>(
    undefined,
  )
  const markChanged = () => {
    const leave = leaveStep.current
    leaveStep.current = undefined
    leave?.()
    showControl.current?.stop()
    setShown(prev => (prev.changed ? prev : { ...prev, changed: true }))
  }
  const markChangedRef = useLatest(markChanged)
  const restore = () =>
    setShown(prev => ({ ...prev, rewinds: prev.rewinds + 1, changed: false }))
  const root = useRef<HTMLDivElement>(null)
  // Шаг выполняется: действие во времени или показ нажатия — панель не сворачивается (SN74).
  const [stepBusy, setStepBusy] = useState(false)
  useEffect(() => {
    const node = root.current
    if (!node) return
    const observer = new MutationObserver(() =>
      setStepBusy(
        node.dataset.stepAction === 'running' ||
          node.hasAttribute('data-guide-showing'),
      ),
    )
    observer.observe(node, {
      attributes: true,
      attributeFilter: ['data-step-action', 'data-guide-showing'],
    })
    return () => observer.disconnect()
  }, [])
  const table = useRef<HTMLDivElement>(null)
  // Экземпляр таблицы — для прокрутки к цели действия шага (SN45).
  const instance = useRef<unknown>(undefined)
  const [probe] = useState<TesseraFeatureEntry>(() => ({
    id: 'guideTable',
    setup: grid => {
      instance.current = grid
    },
  }))
  const running = () => root.current?.dataset.stepAction === 'running'
  // Ввод человека в таблицу, её меню и поповеры (порталы — по дереву React). Пока идёт
  // действие шага, ввод в саму таблицу гасит щит ниже — он пометки не ставит.
  const onInput = (event: SyntheticEvent) => {
    if (!event.nativeEvent.isTrusted) return
    if (running() && table.current?.contains(event.target as Node)) return
    markChanged()
  }
  const wheelAt = useRef(-Infinity)
  useEffect(() => {
    const area = table.current
    const guideRoot = root.current
    if (!area || !guideRoot) return
    // Щит — на корне гайда: у обёртки таблицы (`display: contents`) нет бокса, и
    // Chromium прокручивает колесом мимо её слушателя.
    const shield = (event: Event) => {
      if (!event.isTrusted || guideRoot.dataset.stepAction !== 'running') return
      if (!area.contains(event.target as Node)) return
      if (event instanceof KeyboardEvent && event.key === 'Tab') return
      event.preventDefault()
      event.stopPropagation()
    }
    // Колесо меняет таблицу, только если прокрутило её: иначе оно листает страницу.
    const scrolled = () => {
      if (performance.now() - wheelAt.current < WHEEL_SCROLL_MS)
        markChangedRef.current()
    }
    for (const type of SHIELDED)
      guideRoot.addEventListener(type, shield, {
        capture: true,
        passive: false,
      })
    area.addEventListener('scroll', scrolled, true)
    return () => {
      for (const type of SHIELDED)
        guideRoot.removeEventListener(type, shield, { capture: true })
      area.removeEventListener('scroll', scrolled, true)
    }
  }, [markChangedRef])
  // Пометка прохода со свежей таблицей (SN73) — как от ввода человека.
  useEffect(() => {
    const node = root.current
    if (!node) return
    const mark = () => markChangedRef.current()
    node.addEventListener(GUIDE_FRESH, mark)
    return () => node.removeEventListener(GUIDE_FRESH, mark)
  }, [markChangedRef])
  // События действия шага (SN45–SN52): ждут, пока таблица докрутится до ячейки-цели, а
  // цель нажатия покажет наведение и нажатие, затем доходят в прежнем порядке; ввод в поле
  // идёт по символу.
  useEffect(() => {
    const area = table.current
    if (!area) return
    const demo = showActions
      ? createGuideDemo(
          window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        )
      : undefined
    const replays = new WeakSet<Event>()
    // Пока доходят повторы, события, которые порождают их обработчики, не ждут.
    let replaying = false
    let held: { event: Event; target: EventTarget }[] = []
    let busy = false
    /** Цель и точка показанного наведения — пока гайд показывает нажатие. */
    let showing:
      { target: Element; point: { x: number; y: number } } | undefined
    const known = new WeakMap<Element, string>()
    let typing: { field: TextField; text: string; shown: string } | undefined
    // Жест, уже показанный нажатием: его следующие события на той же цели не ждут.
    let gesture:
      | { target: Element; type: string; state: string; until: number }
      | undefined
    // Голые щелчки, показанные нажатием мыши, и точка нажатия.
    const asMouse = new WeakMap<Event, { x: number; y: number }>()
    // Шаг остановлен вводом человека (SN66): показ, начатый до остановки, — другой эпохи.
    let stopped = false
    let epoch = 0

    const deliver = (event: Event, target: EventTarget) => {
      replays.add(event)
      replaying = true
      try {
        target.dispatchEvent(event)
      } finally {
        replaying = false
      }
    }
    const holdEvent = (event: Event) => {
      event.stopImmediatePropagation()
      event.preventDefault()
      held.push({ event, target: event.target! })
    }
    /** Набрать в поле текст по символу, начиная с общего начала с прежним значением. */
    const typeOut = async (field: TextField, from: string, text: string) => {
      const state = { field, text, shown: from }
      typing = state
      let length = commonStart(from, state.text)
      setFieldValue(field, state.text.slice(0, length))
      state.shown = field.value
      // Стирание — тоже ввод: без события поле очистилось бы только на вид (SN62).
      if (state.shown !== from)
        deliver(new InputEvent('input', { bubbles: true }), field)
      while (state.shown !== state.text) {
        length = Math.min(length + 1, state.text.length)
        setFieldValue(field, state.text.slice(0, length))
        state.shown = field.value
        deliver(new InputEvent('input', { bubbles: true }), field)
        await sleep(TYPE_MS)
        if (typing !== state) throw STOPPED
      }
      known.set(field, state.text)
      typing = undefined
    }
    /** Наведение, как от мыши: вид наведения и события, по которым подсвечиваются пункты меню. */
    const hoverAt = (target: Element, point: { x: number; y: number }) => {
      if (demo!.hovers(target)) return
      demo!.hover(target)
      showing = { target, point }
      const at = { bubbles: true, clientX: point.x, clientY: point.y }
      deliver(new PointerEvent('pointerover', at), target)
      deliver(new MouseEvent('mouseover', at), target)
      deliver(new PointerEvent('pointermove', at), target)
      deliver(new MouseEvent('mousemove', at), target)
    }
    // Пока гайд показывает действие, шаг его не повторяет (`untilDone`).
    const setBusy = (value: boolean) => {
      busy = value
      root.current?.toggleAttribute('data-guide-showing', value)
    }
    /** Кнопка мыши вниз или вверх в точке, как у настоящего нажатия. */
    const pressAt = (
      target: Element,
      point: { x: number; y: number },
      phase: 'down' | 'up',
    ) => {
      const down = phase === 'down'
      const at = {
        bubbles: true,
        cancelable: true,
        composed: true,
        clientX: point.x,
        clientY: point.y,
        button: 0,
        buttons: down ? 1 : 0,
      }
      deliver(
        new PointerEvent(down ? 'pointerdown' : 'pointerup', {
          ...at,
          pointerId: 1,
          pointerType: 'mouse',
          isPrimary: true,
        }),
        target,
      )
      deliver(new MouseEvent(down ? 'mousedown' : 'mouseup', at), target)
    }
    const run = async (event: Event, target: Element, text?: string) => {
      setBusy(true)
      const mine = epoch
      // Ввод человека остановил шаг посреди показа (SN66): дальше показ не идёт.
      const alive = () => {
        if (epoch !== mine) throw STOPPED
      }
      let dx = 0
      let dy = 0
      // Волна нажатия: перед самим щелчком встаёт на место цели — нажатие и отпускание
      // кнопки могли её сдвинуть (раскрылась шапка).
      let ring: { follow: (at: { x: number; y: number }) => void } | undefined
      try {
        const cell =
          REVEALING.has(event.type) && area.contains(target)
            ? bodyCellOf(target)
            : null
        const rowId = cell
          ?.closest('.data-grid__body-row')
          ?.getAttribute('data-row-id')
        if (cell && rowId && instance.current && !inView(cell)) {
          // Место — до прокрутки: `scrollToRow` сдвигает таблицу ещё до первого await.
          const before = cell.getBoundingClientRect()
          await scrollToRow(instance.current, rowId, {
            columnId: cell.dataset.columnId,
          })
          await settledBox(cell)
          alive()
          const after = cell.getBoundingClientRect()
          dx = after.left - before.left
          dy = after.top - before.top
        }
        // Цель вне окна страницы — сперва страница прокручивается к ней (SN61).
        if (
          demo &&
          CLICKING.has(event.type) &&
          target.isConnected &&
          outsideWindow(target)
        ) {
          const before = target.getBoundingClientRect()
          target.scrollIntoView({
            block: 'nearest',
            inline: 'nearest',
            behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
              ? 'auto'
              : 'smooth',
          })
          // Плавная прокрутка дольше полусекунды одного ожидания — ждём до остановки.
          for (let wait = 0; wait < 4; wait++) {
            const moving = target.getBoundingClientRect()
            await settledBox(target)
            if (target.getBoundingClientRect().top === moving.top) break
          }
          alive()
          const after = target.getBoundingClientRect()
          dx += after.left - before.left
          dy += after.top - before.top
        }
        if (demo && text !== undefined) {
          await typeOut(target as TextField, known.get(target) ?? '', text)
        } else if (demo && CLICKING.has(event.type) && target.isConnected) {
          hoverAt(target, pointOf(event, target, dx, dy))
          await sleep(HOVER_MS)
          // Скрытая до наведения кнопка раскрылась и сдвинулась: точка — по новому месту.
          await settledBox(target)
          alive()
          const point = pointOf(event, target, dx, dy)
          // Голый `click()` нажимается, как мышью: кнопка вниз — на нажатом виде, вверх —
          // перед щелчком. Иначе фокус успевает уйти не туда (активная ячейка).
          // Кроме кнопки меню: меню Base UI открывается уже нажатием кнопки мыши, и
          // щелчок после него переключил бы его обратно.
          const bare =
            event.type === 'click' && !target.closest('[aria-haspopup="menu"]')
          if (bare) asMouse.set(event, point)
          // Цель без рамки (ушла из DOM) — без волны.
          ring =
            target.getBoundingClientRect().width > 0
              ? demo.click(point)
              : undefined
          demo.press(target)
          if (bare) pressAt(target, point, 'down')
          await sleep(PRESS_MS)
          alive()
          if (bare) pressAt(target, point, 'up')
          gesture = {
            target,
            type: event.type,
            state: stateOf(target),
            until: performance.now() + GESTURE_MS,
          }
          window.setTimeout(demo.release, PRESS_MS)
        } else if (
          !demo &&
          isBareGridClick(event, target) &&
          target.isConnected
        ) {
          // Вне живого Storybook — то же нажатие мышью, без показа и задержек (SN59).
          const point = pointOf(event, target, dx, dy)
          asMouse.set(event, point)
          pressAt(target, point, 'down')
          pressAt(target, point, 'up')
        }
      } catch (error) {
        if (error !== STOPPED) throw error
      } finally {
        // Остановка уже сняла показ и отбросила задержанные события шага.
        if (epoch === mine) deliverHeld(event, target, ring, dx, dy)
      }
    }
    const deliverHeld = (
      event: Event,
      target: Element,
      ring: { follow: (at: { x: number; y: number }) => void } | undefined,
      dx: number,
      dy: number,
    ) => {
      showing = undefined
      const queue = held
      held = []
      setBusy(false)
      if (ring && target.isConnected)
        ring.follow(pointOf(event, target, dx, dy))
      for (const { event: waiting, target } of queue) {
        const replay = replayOf(waiting, dx, dy, asMouse.get(waiting))
        // Прошлый повтор перерисовал цель новым узлом: событие — узлу на том же месте.
        const to =
          target instanceof Element && !target.isConnected
            ? (hitOf(replay) ?? target)
            : target
        if (replay.type === 'keydown' && to instanceof Element)
          showKey(replay, to)
        deliver(replay, to)
      }
    }

    showControl.current = {
      stop: () => {
        if (stopped) return
        stopped = true
        epoch++
        held = []
        showing = undefined
        typing = undefined
        gesture = undefined
        setBusy(false)
        demo?.unhover()
        demo?.release()
      },
      resume: () => {
        stopped = false
      },
    }

    /** Плашка клавиши — когда клавиша доходит до цели. */
    function showKey(event: Event, target: Element) {
      const label = demo && keyLabel(event as KeyboardEvent)
      if (label) demo.key(label, keyBox(target, area!))
    }
    // Пока доходит ввод человека не в обвязку гайда, события, которые порождают на него
    // компоненты (флажок Base UI щёлкает своё скрытое поле), — тоже его ввод, а не действие
    // шага (SN65).
    // Порождённое — только пока настоящее событие ещё идёт по дереву.
    let humanEvent: Event | undefined
    const onHumanStart = (event: Event) => {
      if (!event.isTrusted) return
      if (event.target instanceof Element && event.target.closest(OWN_CHROME))
        return
      humanEvent = event
    }
    const human = () => !!humanEvent && humanEvent.eventPhase !== Event.NONE
    const onEvent = (event: Event) => {
      if (event.isTrusted) {
        if (event.type === 'input' && isTextField(event.target))
          known.set(event.target, event.target.value)
        return
      }
      const target = event.target
      if (human() || replays.has(event) || replaying || !target) return
      // Шаг остановлен: его действие таблицу не трогает, а шаг без отмены виден (SN68).
      if (stopped && target instanceof Element && !target.closest(OWN_CHROME)) {
        event.stopImmediatePropagation()
        event.preventDefault()
        console.error(
          `Guide: the action of a stopped step sends "${event.type}" (ADR 0117, SN68)`,
        )
        return
      }
      if (target instanceof Element && target.closest(OWN_CHROME)) return
      if (busy) {
        // Набор идёт: поле держит набранное, а не значение, которое поставил помощник.
        if (event.type === 'input' && typing && target === typing.field) {
          typing.text = typing.field.value
          setFieldValue(typing.field, typing.shown)
          event.stopImmediatePropagation()
          return
        }
        // Повтор того же нажатия циклом шага: оно уже ждёт — второе не нужно.
        const repeat =
          CLICKING.has(event.type) &&
          held.some(
            item => item.event.type === event.type && item.target === target,
          )
        if (repeat) {
          event.stopImmediatePropagation()
          event.preventDefault()
          return
        }
        holdEvent(event)
        return
      }
      if (!(target instanceof Element)) return
      if (event.type === 'keydown') showKey(event, target)
      if (demo && HOVERING.has(event.type)) demo.hover(target)
      if (demo && UNHOVERING.has(event.type) && demo.hovers(target))
        demo.unhover()
      if (demo && event.type === 'input') {
        if (!isTextField(target) || target.value === known.get(target)) return
        // Поле — к прежнему значению до React: набор пойдёт по символу.
        const text = target.value
        setFieldValue(target, known.get(target) ?? '')
        event.stopImmediatePropagation()
        void run(event, target, text)
        return
      }
      const cell =
        REVEALING.has(event.type) && area.contains(target)
          ? bodyCellOf(target)
          : null
      const scroll =
        !!cell &&
        !!instance.current &&
        !!cell.closest('.data-grid__body-row') &&
        !inView(cell)
      const shown =
        !!gesture &&
        gesture.target === target &&
        performance.now() < gesture.until
      // Повтор показанного нажатия циклом шага, пока таблица на него не ответила (цель та
      // же), — лишний. Цель изменилась (кнопка стала занятой) — это новое нажатие: «стоп».
      if (
        shown &&
        event.type === gesture!.type &&
        stateOf(target) === gesture!.state
      ) {
        event.stopImmediatePropagation()
        event.preventDefault()
        return
      }
      // Нажатие кнопки мыши — волна сразу, событие не ждёт (SN50).
      if (demo && PRESSING.has(event.type) && !scroll) {
        demo.click(pointOf(event, target, 0, 0))
        return
      }
      const press =
        CLICKING.has(event.type) &&
        !shown &&
        (!!demo || isBareGridClick(event, target))
      if (!scroll && !press) return
      holdEvent(event)
      void run(event, target)
    }
    const onFocus = (event: Event) => {
      if (isTextField(event.target) && !known.has(event.target))
        known.set(event.target, event.target.value)
    }
    // Настоящая мышь над таблицей — вид наведения уходит: наводит уже человек. Указатель,
    // который шевелится над панелью гайда, показу нажатия не мешает.
    const onRealMove = (event: Event) => {
      if (event.isTrusted && area.contains(event.target as Node))
        demo?.unhover()
    }
    // Указатель перешёл на другой элемент вне таблицы — грид снял наведение строки и спрятал
    // её кнопки; пока гайд показывает нажатие, наведение строки возвращается. Всплытием на
    // `window` — после обработчиков грида на документе, в каком бы порядке они ни встали.
    const onRealOver = (event: Event) => {
      if (!event.isTrusted || !showing || area.contains(event.target as Node))
        return
      const at = {
        bubbles: true,
        clientX: showing.point.x,
        clientY: showing.point.y,
      }
      deliver(new PointerEvent('pointerover', at), showing.target)
    }
    // Нажатие по панели гайда — человеком или тестом каталога — не закрывает меню и
    // поповеры таблицы (SN53). Фокус в поле ввода и поповере остаётся (SN35), иначе он
    // уходит на кнопку панели, как от нажатия мимо таблицы (SN55).
    const keepPopups = (event: Event) => {
      if (!(event.target instanceof Element)) return
      if (!event.target.closest('[data-testid="guide"]')) return
      event.stopPropagation()
      if (event.type === 'mousedown' && keepsFocus()) event.preventDefault()
      if (event.type === 'pointerdown') {
        document.documentElement.setAttribute(INPUT_MODALITY_ATTR, 'pointer')
        // Base UI помнит любое нажатие при открытом поповере (и внутри него) и закрывает
        // поповер следующим щелчком мимо; отмена жеста эту отметку снимает.
        document.dispatchEvent(new PointerEvent('pointercancel'))
      }
    }
    // Щелчок по панели доходит до её кнопок (React — ниже `body`), но не до документа:
    // часть поповеров закрывается щелчком мимо, а не нажатием кнопки мыши.
    const keepPopupsOnClick = (event: Event) => {
      if (!(event.target instanceof Element)) return
      if (event.target.closest('[data-testid="guide"]')) event.stopPropagation()
    }
    for (const type of HUMAN) window.addEventListener(type, onHumanStart, true)
    for (const type of HELD) document.addEventListener(type, onEvent, true)
    for (const type of PANEL_PRESS)
      window.addEventListener(type, keepPopups, true)
    document.body.addEventListener('click', keepPopupsOnClick)
    document.addEventListener('focusin', onFocus, true)
    document.addEventListener('mousemove', onRealMove, true)
    window.addEventListener('pointerover', onRealOver)
    return () => {
      for (const type of HUMAN)
        window.removeEventListener(type, onHumanStart, true)
      for (const type of HELD) document.removeEventListener(type, onEvent, true)
      for (const type of PANEL_PRESS)
        window.removeEventListener(type, keepPopups, true)
      document.body.removeEventListener('click', keepPopupsOnClick)
      document.removeEventListener('focusin', onFocus, true)
      document.removeEventListener('mousemove', onRealMove, true)
      window.removeEventListener('pointerover', onRealOver)
      // Идущий показ не доходит до таблицы, которая встала на это место (SN61).
      epoch++
      held = []
      showControl.current = undefined
      demo?.dispose()
    }
  }, [showActions])
  const mount = `${guide.run}-${mounts}-${shown.rewinds}`
  const live = appProps?.mount === mount ? appProps.props : undefined
  const ownPlugins =
    live?.extraPlugins ?? props.extraPlugins ?? args.extraPlugins
  const plugins = useMemo(
    () => [...(ownPlugins ?? []), probe],
    [ownPlugins, probe],
  )
  useIsomorphicLayoutEffect(() => {
    mountRef.current = mount
  }, [mount])
  // Грид открывается после сброса обвязки (SN72): его эффекты уже видят сброшенный мок.
  const [opened, setOpened] = useState<string>()
  const resetFor = useRef<string>(undefined)
  const resetRef = useLatest(reset)
  useIsomorphicLayoutEffect(() => {
    // Повтор эффекта StrictMode обвязку второй раз не сбрасывает.
    if (resetFor.current !== mount) {
      resetFor.current = mount
      resetRef.current?.()
    }
    setOpened(mount)
  }, [mount, resetRef])
  const ready = opened === mount
  // Шаг 1 — исходное состояние: гайд не трогает таблицу, пока его не начали (SN71).
  const firstActs = steps[0]?.enter !== undefined
  useEffect(() => {
    if (firstActs)
      console.error(
        `Guide "${title.en}": step 1 has an action — step 1 only shows the initial state (ADR 0117, SN71).`,
      )
  }, [firstActs, title.en])
  // Что поменяло приложение посреди шага — в консоль, как действие истории.
  useEffect(() => {
    if (appProps)
      consoleLog.log('app', `${Object.keys(appProps.props).join(', ')} changed`)
  }, [consoleLog, appProps])
  useIsomorphicLayoutEffect(() => {
    if (root.current) guideSteps.set(root.current, steps)
  }, [steps])
  // Шаг гайда — действие истории (ADR 0124, CL16): до эффектов грида, которые он вызовет.
  const stepTitle = steps[guide.step]?.title
  useIsomorphicLayoutEffect(() => {
    consoleLog.action({
      plugin: 'story',
      action: (locale: StoryLocale) =>
        shellText(locale, 'guideStepAction', {
          step: guide.step + 1,
          title: stepTitle ? textOf(stepTitle, locale) : '',
        }),
      source: 'story',
    })
  }, [consoleLog, guide.step, guide.run, stepTitle])
  useArgsActions(consoleLog, args)
  // Фокус после шага (SN56–SN58): сторож — до действия шага, его эффект ниже.
  const keyboardStep = useLatest(steps[guide.step]?.keyboard === true)
  const focusGuard = useRef<FocusGuard>(undefined)
  useEffect(() => {
    if (!root.current) return
    const guard = createFocusGuard(root.current, () => keyboardStep.current)
    focusGuard.current = guard
    return guard.dispose
  }, [keyboardStep])
  useEffect(() => {
    focusGuard.current?.stepChanged()
  }, [guide.step, guide.run, shown.rewinds])
  const enter = steps[guide.step]?.enter
  useEffect(() => {
    if (!ready) return
    showControl.current?.resume()
    leaveStep.current = undefined
    let stop: (() => void) | undefined
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const startedAt = performance.now()
    const start = () => {
      const node = root.current
      if (cancelled || !node) return
      // Грид ещё за рамкой первого рендера или режет окно (ADR 0203, §6), а открытый заново
      // ещё без строк (SN73): действие шага ждёт, таймером — в фоновой вкладке кадры стоят.
      const rowless =
        !node.querySelector('.data-grid__body-row') &&
        performance.now() - startedAt < ROWS_WAIT_MS
      if (node.querySelector(GRID_PENDING) || rowless) {
        timer = setTimeout(start, 16)
        return
      }
      const leave = enter?.(node, app)
      if (typeof leave !== 'function') return
      let left = false
      const done = () => {
        if (left) return
        left = true
        ;(leave as () => void)()
      }
      stop = done
      leaveStep.current = done
    }
    start()
    return () => {
      cancelled = true
      if (timer !== undefined) clearTimeout(timer)
      if (stop && leaveStep.current === stop) leaveStep.current = undefined
      stop?.()
    }
  }, [enter, app, guide.step, guide.run, shown.rewinds, ready])
  // Язык грида на текущем шаге — язык гайда и консоли (ADR 0225, §3).
  const locale = storyLocaleOf(live?.locale ?? props.locale ?? args.locale)
  return (
    <StoryLocaleProvider value={locale}>
      <div
        ref={root}
        data-guide-root=""
        data-guide-step={guide.step}
        style={{ display: 'flex', flexDirection: 'column' }}
      >
        <GuidePanel
          title={title}
          steps={steps}
          step={guide.step}
          onBack={guide.back}
          onNext={guide.next}
          onRestart={guide.restart}
          onJump={guide.jump}
          changed={shown.changed}
          onRestore={restore}
          stepBusy={stepBusy}
        />
        <div
          ref={table}
          style={{ display: 'contents' }}
          onPointerDownCapture={onInput}
          onTouchStartCapture={onInput}
          onKeyDownCapture={event => {
            if (!PASSIVE_KEYS.has(event.key)) onInput(event)
          }}
          onWheelCapture={event => {
            if (!event.nativeEvent.isTrusted) return
            if (running() && table.current?.contains(event.target as Node))
              return
            wheelAt.current = performance.now()
          }}
        >
          {ready && (
            <StoryComponent
              key={mount}
              {...args}
              {...props}
              {...live}
              extraPlugins={plugins}
              consoleLog={consoleLog}
            />
          )}
        </div>
        <StoryConsole log={consoleLog} />
      </div>
    </StoryLocaleProvider>
  )
}
