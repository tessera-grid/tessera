// Значок скрытой кнопки — только там, где её видно (ADR 0149, §4): кнопка остаётся в каждой
// строке (имя, фокус, порядок Tab), а её значок место показа монтирует по наведению, фокусу
// или касанию. Вне места показа (шапка, панели, свой интерфейс) значок рисуется всегда.
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useSyncExternalStore,
} from 'react'

/** Место показа скрытых кнопок — строка тела грида. */
export interface IconReveal {
  /** Значки скрытых кнопок места видны. */
  shown: () => boolean
  subscribe: (listener: () => void) => () => void
  /** Держать значки видными, пока кнопка места держит открытое меню. */
  hold: () => () => void
}

export const IconRevealContext = createContext<IconReveal | null>(null)

/** Кнопка скрыта до наведения на своё место (класс `--hidden` её обёртки). */
export const HiddenButtonContext = createContext(false)

const alwaysShown = () => true
const noSubscribe = () => () => {}

interface RevealedIconProps {
  /** Значок нужен и без показа места: своё состояние кнопки видно всегда. */
  always: boolean
  /** У кнопки открыто меню или панель — место держит значки видными. */
  holding: boolean
  children: ReactNode
}

/** Значок кнопки; подписан сам — смена показа места кнопку не перерисовывает. */
export const RevealedIcon = ({
  always,
  holding,
  children,
}: RevealedIconProps) => {
  const place = useContext(IconRevealContext)
  const reveal = useContext(HiddenButtonContext) ? place : null
  const shown = useSyncExternalStore(
    reveal ? reveal.subscribe : noSubscribe,
    reveal ? reveal.shown : alwaysShown,
    alwaysShown,
  )
  // Открытое меню держит место и тогда, когда своя кнопка с ним уже не скрыта.
  useEffect(
    () => (place && holding ? place.hold() : undefined),
    [place, holding],
  )
  return shown || always || holding ? children : null
}
