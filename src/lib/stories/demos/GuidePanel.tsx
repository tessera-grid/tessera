/**
 * Панель клиентского сценария истории (ADR 0117). Свёрнутая — только «Воспроизвести»:
 * шаги идут сами. Раскрытая — шаги степпером в один ряд (пройденные — зелёные) и кнопки
 * «Назад», «Далее», «Сначала»; `play` в тестах нажимает те же кнопки. Пройденный шаг отмечается взрывом конфетти, при уменьшенном движении —
 * без него. Сворачивается, как `DemoPanel`; кнопки шагов видны и в свёрнутой.
 */
import {
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'

import { Check as CheckIcon, Pause, Play } from 'lucide-react'

import '../../core/themeVariables/theme.css'
import { DATA_GRID_THEME_CLASS } from '../../core/themeVariables'
import { useLatest } from '../../core/useLatest'
import { Button } from '../../ui/Button'
import { useIcons } from '../../ui/icons'

export interface GuideStep {
  title: string
  /** Что делает клиент или сервер и что видно в итоге шага. */
  hint: ReactNode
}

/** Текущий шаг и номер прохода: «Сначала» перемонтирует грид, как новое открытие. */
export const useGuide = (count: number) => {
  const [state, setState] = useState({ step: 0, run: 0 })
  const go = (delta: number) =>
    setState(prev => ({
      ...prev,
      step: Math.min(count - 1, Math.max(0, prev.step + delta)),
    }))
  return {
    ...state,
    back: () => go(-1),
    next: () => go(1),
    /** Сразу к шагу `index`. */
    jump: (index: number) =>
      setState(prev => ({
        ...prev,
        step: Math.min(count - 1, Math.max(0, index)),
      })),
    restart: () => setState(prev => ({ step: 0, run: prev.run + 1 })),
  }
}

/** Скругление рамки грида: `--tsr-sys-radius` → `--radius-md`. */
const RADIUS = 'var(--radius-md, 8px)'
/** Пройденный шаг; значок — фигура, не текст: контраст 4.5:1 к нему не применяется. */
const DONE = 'var(--success, #16a34a)'
const BADGE = 22

const CONFETTI_COLORS = [
  '#22c55e',
  '#3b82f6',
  '#f59e0b',
  '#ec4899',
  '#a855f7',
  '#06b6d4',
]
const CONFETTI_PIECES = 18
/** Обвязка историй, не компонент грида: длительности — свои, не токены движения. */
const POP_MS = 250
/**
 * Время шага при воспроизведении, мс: столько заливается полоска к следующему шагу;
 * последний шаг ждать нечего — он выполняется сразу.
 */
const STEP_MS = 1500
/** Заливка полоски к следующему шагу, мс: после неё шаг сменяется. */
const FILL_MS = 200
/** Заливка полоски на шаг при переходе к выбранному шагу, мс: ускоренно. */
const JUMP_MS = 120
/** Полёт конфетти, мс; гаснуть они начинают с этой доли полёта. */
const CONFETTI_MS = 500
const CONFETTI_FADE_FROM = 0.55
/**
 * Ширина шага в ленте, px: не шире `STEP_WIDTH`, на узком окне — окно без затемнений
 * по краям, но не уже `MIN_STEP_WIDTH`.
 */
const STEP_WIDTH = 240
const MIN_STEP_WIDTH = 160
/** Карточка не уже этого, px: уже — кнопки и шаги сжимались бы в кашу. */
export const MIN_PANEL_WIDTH = 320
/** Раскрытие и сворачивание тела панели, мс. */
const EXPAND_MS = 250
/** Поля подложки шага, px: подложка выходит за текст шага на столько с каждой стороны. */
const STEP_PAD = 8
/** Отступ ленты над и под подложками шагов, px. */
const STEP_GAP = 8
/** Отступы карточки: по бокам — шире, чем сверху и снизу. */
const PADDING_Y = 12
const PADDING_X = 20
/**
 * Запас окна шагов за краями содержимого, px: «подпрыгнувший» значок крайнего шага не
 * обрезается окном и раскрытием.
 */
const BLEED = 8
/** Ширина затемнения у края, за которым есть шаги, px; на узком окне — доля окна. */
const FADE = 64
const FADE_SHARE = 0.12
/** Физика полёта: ускорение свободного падения, px/с², и сопротивление воздуха, 1/с. */
const GRAVITY = 1400
const DRAG = 3
/** Кадров траектории в секунду полёта: между ними — линейно. */
const FRAMES_PER_S = 30

/**
 * Положение частицы через `t` секунд при линейном сопротивлении: скорость гаснет как
 * e^(−k·t), вниз она стремится к g/k.
 */
const flight = (vx: number, vy: number, t: number) => {
  const decay = (1 - Math.exp(-DRAG * t)) / DRAG
  return {
    x: vx * decay,
    y: (vy - GRAVITY / DRAG) * decay + (GRAVITY / DRAG) * t,
  }
}

/** Прозрачность: держится до `CONFETTI_FADE_FROM` полёта, затем гаснет к нулю. */
const fade = (progress: number) =>
  progress < CONFETTI_FADE_FROM
    ? 1
    : 1 - (progress - CONFETTI_FADE_FROM) / (1 - CONFETTI_FADE_FROM)

const stillMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Значок «подпрыгивает»: шаг пройден или снова стал текущим. */
const pop = (badge: HTMLElement) =>
  badge.animate(
    [
      { transform: 'scale(1)' },
      { transform: 'scale(1.3)' },
      { transform: 'scale(1)' },
    ],
    { duration: POP_MS, easing: 'ease-out' },
  )

const centerOf = (element: HTMLElement) => {
  const { left, top, width, height } = element.getBoundingClientRect()
  return { x: left + width / 2, y: top + height / 2 }
}

/**
 * Значок «подпрыгивает», конфетти взлетают из него, падают и гаснут. Промис — конец
 * анимации.
 */
const burst = (badge: HTMLElement): Promise<unknown> => {
  if (stillMotion()) return Promise.resolve()
  const done: Promise<unknown>[] = [pop(badge).finished]
  const { x, y } = centerOf(badge)
  const pieces: HTMLElement[] = []
  for (let i = 0; i < CONFETTI_PIECES; i++) {
    // Веер вверх: от −160° до −20°, скорость — своя у каждой частицы.
    const angle = (-160 + Math.random() * 140) * (Math.PI / 180)
    const speed = 260 + Math.random() * 200
    const vx = Math.cos(angle) * speed
    const vy = Math.sin(angle) * speed
    // Обороты и перевороты — в секунду полёта.
    const spin = (Math.random() < 0.5 ? -1 : 1) * (240 + Math.random() * 360)
    const flips = 2 + Math.random() * 3
    const piece = document.createElement('span')
    piece.setAttribute('aria-hidden', 'true')
    // Слой поверх страницы: прокрутка ряда шагов обрезала бы частицы.
    Object.assign(piece.style, {
      position: 'fixed',
      left: `${x - 3}px`,
      top: `${y - 2}px`,
      width: '6px',
      height: i % 2 ? '7px' : '4px',
      borderRadius: i % 3 === 0 ? '50%' : '1px',
      background: CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
      pointerEvents: 'none',
      zIndex: '1000',
    })
    document.body.append(piece)
    pieces.push(piece)
    const duration = CONFETTI_MS / 1000
    const count = Math.ceil(duration * FRAMES_PER_S)
    const frames = Array.from({ length: count + 1 }, (_, k) => {
      const progress = k / count
      const seconds = progress * duration
      const at = flight(vx, vy, seconds)
      // Бумажка переворачивается в полёте: сжатие по высоте, как ребро листка.
      const flip = Math.cos(seconds * flips * Math.PI)
      return {
        transform: `translate(${at.x}px, ${at.y}px) rotate(${spin * seconds}deg) scaleY(${flip})`,
        opacity: fade(progress),
      }
    })
    done.push(
      piece
        .animate(frames, { duration: CONFETTI_MS, fill: 'forwards' })
        .finished.finally(() => piece.remove()),
    )
  }
  // Полёт — от значка: лента шагов едет или страница прокручивается — частицы следом.
  let frame = 0
  const follow = () => {
    if (badge.isConnected) {
      const at = centerOf(badge)
      for (const piece of pieces) {
        piece.style.left = `${at.x - 3}px`
        piece.style.top = `${at.y - 2}px`
      }
    }
    frame = requestAnimationFrame(follow)
  }
  frame = requestAnimationFrame(follow)
  return Promise.allSettled(done).finally(() => cancelAnimationFrame(frame))
}

const Check = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
    <path
      d="M2.5 6.5 5 9l4.5-6"
      fill="none"
      stroke="#fff"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const Badge = ({
  index,
  step,
  passed,
}: {
  index: number
  step: number
  /** Шаг пройден, хотя ещё текущий: заливается его полоска или сценарий закончен. */
  passed: boolean
}) => {
  const done = index < step || passed
  const current = index === step && !passed
  return (
    <span
      aria-hidden
      data-step-index={index}
      data-step-state={done ? 'done' : current ? 'current' : 'next'}
      style={{
        flex: 'none',
        display: 'inline-grid',
        placeItems: 'center',
        width: BADGE,
        height: BADGE,
        boxSizing: 'border-box',
        borderRadius: 999,
        border: done || current ? 'none' : '1px dashed var(--border)',
        background: done ? DONE : current ? 'var(--primary)' : 'var(--card)',
        color: current ? 'var(--primary-foreground)' : 'var(--foreground)',
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      {done ? <Check /> : index + 1}
    </span>
  )
}

export const GuidePanel = ({
  title,
  steps,
  step,
  onBack,
  onNext,
  onRestart,
  onJump,
  defaultExpanded = false,
}: {
  title: string
  steps: readonly GuideStep[]
  /** Индекс текущего шага. */
  step: number
  onBack: () => void
  onNext: () => void
  onRestart: () => void
  /** Сразу к шагу: без анимаций — в свёрнутой панели и при уменьшенном движении. */
  onJump: (index: number) => void
  defaultExpanded?: boolean
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const id = useId()
  const last = steps.length - 1
  // Последний шаг выполняется при переходе на него: сценарий пройден целиком.
  const [finished, setFinished] = useState(false)
  // Воспроизведение идёт, пока сценарий не пройден; ручной шаг его снимает.
  const [autoplay, setAutoplay] = useState(false)
  const playing = autoplay && !finished
  const list = useRef<HTMLOListElement>(null)
  // Полоска шага `index` к следующему заливается цветом (вперёд) или пустеет (назад);
  // после неё шаг сменяется. `timed` — заливка воспроизведения на всё время шага:
  // значок до её конца текущий, а «Далее», «Назад» и «Пауза» её прерывают. `fast` —
  // переход к выбранному шагу: шаги подряд, ускоренно, без конфетти.
  const [move, setMove] = useState<{
    index: number
    back: boolean
    timed?: boolean
    fast?: boolean
  } | null>(null)
  // Выбранный нажатием шаг: переход идёт к нему, пока не дойдёт.
  const target = useRef<number | null>(null)
  // Шаг под указателем: подложка-карточка.
  const [hovered, setHovered] = useState<number | null>(null)
  const blocking = move !== null && !move.timed
  const filling = move && !move.back && !move.timed ? move.index : null
  const emptying = move?.back ? move.index : null
  const nextRef = useLatest(onNext)
  const backRef = useLatest(onBack)
  const lastRef = useLatest(last)
  // Анимации — только в раскрытой панели: в свёрнутой их не видно, и шаг сменяется сразу.
  const animated = () => expanded && !stillMotion()
  const badgeOf = (index: number) =>
    list.current?.querySelector<HTMLElement>(`[data-step-index="${index}"]`)
  // Значок пройденного шага зеленеет с конфетти, затем заливается полоска.
  const advance = () => {
    if (blocking) return
    target.current = null
    const badge = expanded ? badgeOf(step) : null
    if (badge) void burst(badge)
    // Последний шаг — сценарий пройден, шаг не меняется.
    if (step === last) {
      setFinished(true)
      return
    }
    if (animated()) {
      setMove({ index: step, back: false })
    } else {
      setMove(null)
      onNext()
      if (step + 1 === last) setFinished(true)
    }
  }
  useEffect(() => {
    if (!move) return
    const bar = list.current?.querySelector<HTMLElement>(
      `[data-step-fill="${move.index}"]`,
    )
    const frames = [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }]
    const animation = bar?.animate(move.back ? frames.reverse() : frames, {
      duration: move.timed ? STEP_MS : move.fast ? JUMP_MS : FILL_MS,
      easing: move.timed || move.fast ? 'linear' : 'ease-in-out',
      // Заливка воспроизведения держится полной, пока шаг не сменился.
      fill: move.timed ? 'forwards' : 'none',
    })
    let alive = true
    void (animation?.finished ?? Promise.resolve()).then(
      () => {
        if (!alive) return
        setMove(null)
        if (move.timed) {
          const done = list.current?.querySelector<HTMLElement>(
            `[data-step-index="${move.index}"]`,
          )
          if (done) void burst(done)
        }
        if (move.back) backRef.current()
        else nextRef.current()
        const reached = move.back ? move.index : move.index + 1
        // Переход к выбранному шагу — дальше, пока не дошёл.
        const goal = target.current
        if (goal !== null && goal !== reached) {
          setMove(
            goal > reached
              ? { index: reached, back: false, fast: true }
              : { index: reached - 1, back: true, fast: true },
          )
          return
        }
        target.current = null
        const badge = list.current?.querySelector<HTMLElement>(
          `[data-step-index="${reached}"]`,
        )
        // Последний шаг выполняется сразу: значок зеленеет с конфетти (SN16).
        if (!move.back && reached === lastRef.current) {
          setFinished(true)
          if (badge) void burst(badge)
          return
        }
        // Значок нового текущего шага «подпрыгивает»: вперёд — следующего, назад —
        // прошлого, снова числом.
        if (badge) pop(badge)
      },
      () => {},
    )
    return () => {
      alive = false
      animation?.cancel()
    }
  }, [move, nextRef, backRef, lastRef])
  const advanceRef = useLatest(advance)
  // Воспроизведение: полоска к следующему шагу заливается всё время шага; последний
  // шаг выполняется сразу при переходе на него.
  useEffect(() => {
    if (!playing || move) return
    const timed = step < last && expanded && !stillMotion()
    const timer = setTimeout(
      () => {
        if (timed) setMove({ index: step, back: false, timed: true })
        else advanceRef.current()
      },
      timed || step === last ? 0 : STEP_MS,
    )
    return () => clearTimeout(timer)
  }, [playing, move, step, last, expanded, advanceRef])
  const next = () => {
    setAutoplay(false)
    advance()
  }
  const back = () => {
    setAutoplay(false)
    if (blocking) return
    target.current = null
    // Из пройденного — к предпоследнему шагу: последний выполнился бы снова.
    if (finished) setFinished(false)
    if (step === 0) return
    if (animated()) {
      setMove({ index: step - 1, back: true })
    } else {
      setMove(null)
      onBack()
    }
  }
  // Нажатие на значок или название шага: ускоренно через шаги между текущим и
  // выбранным; нажатие посреди перехода меняет цель.
  const jumpTo = (index: number) => {
    setAutoplay(false)
    // Пройденный сценарий на последнем шаге и остаётся.
    if (finished && index === last) {
      const badge = animated() ? badgeOf(index) : null
      if (badge) pop(badge)
      return
    }
    if (finished) setFinished(false)
    if (!animated()) {
      target.current = null
      setMove(null)
      onJump(index)
      if (index === last) setFinished(true)
      return
    }
    target.current = index
    if (blocking) return
    if (index === step) {
      target.current = null
      if (move?.timed) setMove(null)
      const badge = finished ? badgeOf(index) : null
      if (badge) pop(badge)
      return
    }
    setMove(
      index > step
        ? { index: step, back: false, fast: true }
        : { index: step - 1, back: true, fast: true },
    )
  }
  const restart = () => {
    setAutoplay(false)
    target.current = null
    setMove(null)
    setFinished(false)
    onRestart()
  }
  const togglePlay = () => {
    if (playing) {
      setAutoplay(false)
      // Пауза сбрасывает заливку воспроизведения: шаг остаётся текущим.
      if (move?.timed) setMove(null)
      return
    }
    if (finished) restart()
    setAutoplay(true)
  }
  const ellipsis = {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } as const
  // Ширина окна ленты: помещаются ли все шаги.
  const viewport = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  // Затемнение края — только если за ним есть шаги: следит за прокруткой ленты.
  const [edges, setEdges] = useState({ left: false, right: false })
  useLayoutEffect(() => {
    const element = viewport.current
    if (!element) return
    const readEdges = () => {
      const left = element.scrollLeft > 1
      const right =
        element.scrollLeft < element.scrollWidth - element.clientWidth - 1
      setEdges(prev =>
        prev.left === left && prev.right === right ? prev : { left, right },
      )
    }
    // Замер до первой отрисовки: наблюдатель сообщит размер только в следующем кадре.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- раскладка, не данные
    setWidth(element.getBoundingClientRect().width)
    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry!.contentRect.width)
      readEdges()
    })
    observer.observe(element)
    element.addEventListener('scroll', readEdges, { passive: true })
    // Вертикальное колесо листает ленту вбок; без ленты — страницу, как обычно.
    const wheel = (event: WheelEvent) => {
      const room = element.scrollWidth - element.clientWidth
      if (room <= 0 || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return
      event.preventDefault()
      element.scrollLeft += event.deltaY
    }
    element.addEventListener('wheel', wheel, { passive: false })
    return () => {
      observer.disconnect()
      element.removeEventListener('scroll', readEdges)
      element.removeEventListener('wheel', wheel)
    }
  }, [])
  // Свёрнутое тело — вне фокуса и дерева доступности; атрибутом: в React 18 у пропа
  // `inert` нет булевой формы.
  const body = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    body.current?.toggleAttribute('inert', !expanded)
  }, [expanded])
  const icons = useIcons()
  const ExpandIcon = icons.expand
  const BackIcon = icons.previousPage
  const NextIcon = icons.nextPage
  const RestartIcon = icons.retry
  const fade = Math.min(FADE, width * FADE_SHARE)
  const stepWidth = Math.min(
    STEP_WIDTH,
    Math.max(MIN_STEP_WIDTH, width - 2 * fade),
  )
  const total = steps.length * stepWidth
  const slider = width > 0 && total > width
  const fadeLeft = slider && edges.left
  const fadeRight = slider && edges.right
  const mask = `linear-gradient(to right, ${
    fadeLeft ? `transparent, #000 ${fade}px` : '#000, #000'
  }, ${fadeRight ? `#000 calc(100% - ${fade}px), transparent` : '#000, #000'})`
  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  // Смена шага прокручивает ленту к активному — он по центру окна. Первый раз и при
  // уменьшенном движении — сразу.
  const scrolled = useRef(false)
  useLayoutEffect(() => {
    const element = viewport.current
    if (!element || !slider) return
    element.scrollTo({
      left: BLEED + (step + 0.5) * stepWidth - element.clientWidth / 2,
      behavior: scrolled.current && !reducedMotion ? 'smooth' : 'instant',
    })
    scrolled.current = true
  }, [step, slider, stepWidth, reducedMotion])
  return (
    // Отступ — padding обёртки: margin карточки схлопнулся бы через обёртки Storybook и
    // ушёл бы над страницей полосой её фона. Класс темы — токены кнопок кита.
    <div className={DATA_GRID_THEME_CLASS} style={{ padding: '12px 16px' }}>
      <section
        aria-label={`Scenario: ${title}`}
        data-testid="guide"
        data-busy={blocking || undefined}
        style={{
          display: 'flex',
          flexDirection: 'column',
          minWidth: MIN_PANEL_WIDTH,
          boxSizing: 'border-box',
          padding: `${PADDING_Y}px ${PADDING_X}px`,
          border: '1px solid var(--border)',
          borderRadius: RADIUS,
          background: 'var(--card)',
          color: 'var(--card-foreground)',
          fontSize: 13,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            alignItems: 'center',
          }}
        >
          {/* Название и текущий шаг сжимаются с многоточием; «Воспроизвести» — справа. */}
          <div
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              flex: '1 1 200px',
              minWidth: 0,
            }}
          >
            <Button
              variant="ghost"
              data-testid="guide-toggle"
              aria-expanded={expanded}
              aria-controls={id}
              onClick={() => setExpanded(open => !open)}
              icon={
                // Поворот — на обёртке размером с иконку кнопки кита.
                <span
                  aria-hidden="true"
                  style={{
                    display: 'inline-flex',
                    flex: 'none',
                    width: 'var(--tsr-comp-button-icon-size)',
                    height: 'var(--tsr-comp-button-icon-size)',
                    transform: expanded ? undefined : 'rotate(-90deg)',
                    transition: reducedMotion
                      ? undefined
                      : `transform ${EXPAND_MS}ms ease`,
                  }}
                >
                  <ExpandIcon width="100%" height="100%" />
                </span>
              }
              // Подпись сжимается: у кнопки кита ширина по содержимому.
              style={{ flex: '0 1 auto', minWidth: 0, maxWidth: '100%' }}
            >
              <strong style={ellipsis}>Гайд · {title}</strong>
              <span
                style={{
                  flex: 'none',
                  color: 'var(--muted-foreground)',
                  fontWeight: 400,
                }}
              >
                {finished
                  ? '· пройден'
                  : `· шаг ${step + 1} из ${steps.length}`}
              </span>
            </Button>
            <span style={{ ...ellipsis, flex: '1 1 0', minWidth: 0 }}>
              {!expanded && !finished && steps[step]?.title}
            </span>
          </div>
          <Button
            data-testid="guide-play"
            aria-pressed={playing}
            onClick={togglePlay}
            icon={
              playing ? (
                <Pause aria-hidden="true" />
              ) : (
                <Play aria-hidden="true" />
              )
            }
          >
            {playing ? 'Пауза' : 'Воспроизвести'}
          </Button>
        </div>
        {/* Тело всегда в DOM: раскрывается по высоте, от 0fr к 1fr. */}
        <div
          ref={body}
          style={{
            display: 'grid',
            gridTemplateRows: expanded ? '1fr' : '0fr',
            opacity: expanded ? 1 : 0,
            transition: reducedMotion
              ? undefined
              : `grid-template-rows ${EXPAND_MS}ms ease, opacity ${EXPAND_MS}ms ease`,
          }}
        >
          <div
            style={{
              minHeight: 0,
              overflow: 'hidden',
              margin: `0 -${BLEED}px`,
              padding: `0 ${BLEED}px`,
            }}
          >
            <div
              aria-hidden
              style={{
                marginTop: PADDING_Y,
                borderTop: '1px solid var(--border)',
              }}
            />
            <div
              ref={viewport}
              data-testid="guide-steps"
              data-slider={slider || undefined}
              style={{
                // Лента прокручивается вручную: колесо, тачпад, касание, полоса.
                overflowX: slider ? 'auto' : 'hidden',
                overflowY: 'hidden',
                scrollbarWidth: 'thin',
                overscrollBehaviorX: 'contain',
                margin: `0 -${BLEED}px`,
                // Снизу — место подложке шага; под полосой прокрутки — отступ до кнопок.
                marginBottom: slider ? STEP_PAD : 0,
                // Над и под подложками шагов — отступ, как между шагом и разделителем.
                padding: `${STEP_PAD + STEP_GAP}px ${BLEED}px`,
                maskImage: mask,
              }}
            >
              <ol
                ref={list}
                id={id}
                style={{
                  display: 'grid',
                  // Значки — в одном ряду; не помещаются — лента прокручивается.
                  gridTemplateColumns: slider
                    ? `repeat(${steps.length}, ${stepWidth}px)`
                    : `repeat(${steps.length}, minmax(0, 1fr))`,
                  width: slider ? total : undefined,
                  margin: 0,
                  padding: 0,
                  listStyle: 'none',
                }}
              >
                {steps.map((item, index) => (
                  <li
                    key={`${index}-${item.title}`}
                    aria-current={index === step ? 'step' : undefined}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      paddingRight: 16,
                    }}
                  >
                    {/* Весь шаг — переход к нему; при наведении — тусклая подложка. */}
                    <button
                      type="button"
                      data-step-button={index}
                      onClick={() => jumpTo(index)}
                      onMouseEnter={() => setHovered(index)}
                      onMouseLeave={() =>
                        setHovered(prev => (prev === index ? null : prev))
                      }
                      style={{
                        // Шаги одной высоты — по самому высокому: ячейки ряда равны, кнопка
                        // занимает всю ячейку.
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-start',
                        gap: 6,
                        margin: -STEP_PAD,
                        padding: STEP_PAD,
                        border: 'none',
                        borderRadius: RADIUS,
                        background:
                          hovered === index
                            ? 'color-mix(in srgb, var(--muted) 70%, transparent)'
                            : 'transparent',
                        transition: reducedMotion
                          ? undefined
                          : `background-color ${POP_MS}ms ease`,
                        font: 'inherit',
                        color: 'inherit',
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <Badge
                          index={index}
                          step={step}
                          passed={
                            (finished && index === last) || index === filling
                          }
                        />
                        {index < steps.length - 1 && (
                          <span
                            aria-hidden
                            style={{
                              flex: 1,
                              height: 2,
                              borderRadius: 1,
                              overflow: 'hidden',
                              background: 'var(--border)',
                            }}
                          >
                            {/* Заливка слева направо: шаг пройден или заливается; откат — справа налево. */}
                            <span
                              data-step-fill={index}
                              style={{
                                display: 'block',
                                height: '100%',
                                background: DONE,
                                transformOrigin: 'left',
                                transform:
                                  (index < step || index === filling) &&
                                  index !== emptying
                                    ? 'scaleX(1)'
                                    : 'scaleX(0)',
                              }}
                            />
                          </span>
                        )}
                      </div>
                      <strong
                        style={{ fontWeight: index === step ? 600 : 500 }}
                      >
                        {item.title}
                      </strong>
                      <span
                        style={{
                          color: 'var(--muted-foreground)',
                          lineHeight: 1.4,
                        }}
                      >
                        {item.hint}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
            {/* Ход по шагам — под шагами: «Назад» слева, «Сначала» и «Далее» справа. */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
                marginTop: PADDING_Y,
              }}
            >
              <Button
                data-testid="guide-back"
                disabled={(step === 0 && !finished) || blocking}
                onClick={back}
                icon={<BackIcon aria-hidden="true" />}
              >
                Назад
              </Button>
              <span style={{ flex: 1 }} />
              <Button
                variant="ghost"
                data-testid="guide-restart"
                onClick={restart}
                icon={<RestartIcon aria-hidden="true" />}
              >
                Сначала
              </Button>
              <Button
                data-testid="guide-next"
                disabled={finished || blocking}
                onClick={next}
                icon={
                  step === last ? <CheckIcon aria-hidden="true" /> : undefined
                }
              >
                {finished ? 'Пройдено' : step === last ? 'Закончить' : 'Далее'}
                {step < last && <NextIcon aria-hidden="true" />}
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
