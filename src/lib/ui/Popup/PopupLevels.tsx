/**
 * Уровни поповера со сдвигом (ADR 0079; ADR 0215, §3): новый уровень въезжает сбоку, уходящий —
 * снимок на своём слое — уезжает в другую сторону, окно подстраивает размер переходом. То же
 * движение, что у разделов меню (`MenuSections`), но для поповера-панели: уровни — любая разметка,
 * строка «назад» — кнопка.
 */
import {
  type MouseEvent,
  type ReactNode,
  type RefObject,
  useRef,
  useState,
} from 'react'

import clsx from 'clsx'

import { type LevelDirection, snapshotLevel } from '../../util/levelSnapshot'
import { useIsomorphicLayoutEffect } from '../../util/useIsomorphicLayoutEffect'
import { useIcons } from '../icons'
import { PopupItem } from './PopupItem'
import { PopupNavItem } from './PopupNavItem'

import menuStyles from './ActionMenu.module.css'
import styles from './PopupLevels.module.css'

/** Классы снимка уходящего уровня: их читает снимок со слоя снимков. */
export const LEVEL_GHOST_CLASSES = {
  'data-leave-forward': clsx(
    menuStyles.level,
    menuStyles.ghost,
    menuStyles.leaveForward,
  ),
  'data-leave-back': clsx(
    menuStyles.level,
    menuStyles.ghost,
    menuStyles.leaveBack,
  ),
}

/** Окно следует размеру уровня: переход ширины и высоты — в CSS. */
export const useFitToLevel = (
  wrapRef: RefObject<HTMLDivElement | null>,
  levelRef: RefObject<HTMLDivElement | null>,
  levelKey: string,
) =>
  useIsomorphicLayoutEffect(() => {
    const wrap = wrapRef.current
    const current = levelRef.current
    if (!wrap || !current) return
    const fit = () => {
      wrap.style.width = `${current.offsetWidth}px`
      wrap.style.height = `${current.offsetHeight}px`
    }
    fit()
    // Размер окна — в следующем кадре: без перехода смена размера внутри обработчика
    // наблюдателя даёт ошибку «ResizeObserver loop».
    let frame = 0
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(fit)
    })
    observer.observe(current)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [levelKey, levelRef, wrapRef])

export interface PopupLevelsState {
  levelRef: RefObject<HTMLDivElement | null>
  ghostRef: RefObject<HTMLDivElement | null>
  direction: LevelDirection | null
  /** Сдвиг к уровню: снимок уходящего — до смены уровня. */
  go: (towards: LevelDirection) => void
  settle: () => void
}

export const usePopupLevels = (): PopupLevelsState => {
  const levelRef = useRef<HTMLDivElement>(null)
  const ghostRef = useRef<HTMLDivElement>(null)
  const [direction, setDirection] = useState<LevelDirection | null>(null)
  return {
    levelRef,
    ghostRef,
    direction,
    go: towards => {
      snapshotLevel(levelRef.current, ghostRef.current, towards)
      setDirection(towards)
    },
    settle: () => setDirection(null),
  }
}

interface PopupLevelsProps {
  levels: PopupLevelsState
  /** Ключ уровня: новый ключ — новый уровень. */
  levelKey: string
  /** Ширина и раскладка уровня. */
  className?: string
  children: ReactNode
}

export const PopupLevels = ({
  levels,
  levelKey,
  className,
  children,
}: PopupLevelsProps) => {
  const { levelRef, ghostRef, direction, settle } = levels
  const wrapRef = useRef<HTMLDivElement>(null)
  useFitToLevel(wrapRef, levelRef, levelKey)
  return (
    <div ref={wrapRef} className={menuStyles.sections} data-popup-levels="">
      <div
        ref={ghostRef}
        className={menuStyles.ghostHost}
        {...LEVEL_GHOST_CLASSES}
      />
      <div
        key={levelKey}
        ref={levelRef}
        className={clsx(
          styles.level,
          className,
          direction === 'forward' && menuStyles.enterForward,
          direction === 'back' && menuStyles.enterBack,
        )}
        data-popup-level={levelKey}
        onAnimationEnd={event => {
          if (event.target === event.currentTarget) settle()
        }}
      >
        {children}
      </div>
    </div>
  )
}

interface PopupLevelBackProps {
  /** Название уровня — подпись строки. */
  label: ReactNode
  /** Доступное имя: «Назад, <уровень>». */
  ariaLabel: string
  onClick: (event: MouseEvent<HTMLButtonElement>) => void
}

/** Строка «назад» уровня — шрифтом подписей групп (ADR 0183, PK4), как заголовок поповера. */
export const PopupLevelBack = ({
  label,
  ariaLabel,
  onClick,
}: PopupLevelBackProps) => {
  const { menuBack: BackIcon } = useIcons()
  return (
    <>
      <PopupNavItem
        wrap
        chevron={false}
        onClick={onClick}
        className={styles.heading}
        aria-label={ariaLabel}
        data-popup-level-back=""
        icon={<BackIcon width={16} height={16} />}
        label={label}
      />
    </>
  )
}

/**
 * Заголовок поповера и первого уровня — шрифтом подписей групп (PK4), тем же видом, что строка
 * «назад» раздела, без стрелки:
 * одна шапка у всех поповеров-панелей (ADR 0183, PK33; ADR 0215, §3).
 */
export const PopupLevelTitle = ({
  label,
  id,
}: {
  label: ReactNode
  /** id подписи — для `aria-labelledby` попапа. */
  id?: string
}) => (
  <>
    <PopupItem
      wrap
      className={clsx(styles.heading, styles.title)}
      id={id}
      data-popup-level-title=""
      label={label}
    />
  </>
)
