// MenuSections: текущий уровень меню с разделами (ADR 0079). Новый уровень приезжает
// сдвигом, уходящий — снимок разметки в отдельном слое; окно подстраивает размер под
// уровень переходом. Строка «назад», скелет загрузки и повтор после отказа. Состояние
// разделов ведёт ядро (`useMenuSections`), пункты уровня рисует `children`.
import {
  type MouseEvent,
  type ReactNode,
  type RefObject,
  useId,
  useRef,
} from 'react'

import { Menu } from '@base-ui/react/menu'
import clsx from 'clsx'

import type { MenuLevelModel } from '../../util/menuModel'
import { rejectionText } from '../../util/thenable'
import { useIsomorphicLayoutEffect } from '../../util/useIsomorphicLayoutEffect'
import { Skeleton } from '../Skeleton'
import { Tooltip } from '../Tooltip'
import { useIcons } from '../icons'

import styles from './ActionMenu.module.css'

/** Разделы открытого меню — то, что вид берёт у состояния разделов. */
export interface MenuSectionsModel<TAction> {
  level: MenuLevelModel<TAction>
  depth: number
  direction: 'forward' | 'back' | null
  /** Пункт, на который вернуть фокус при возврате на уровень. */
  returnTo?: string
  levelRef: RefObject<HTMLDivElement | null>
  ghostRef: RefObject<HTMLDivElement | null>
  retry: () => void
}

interface MenuSectionsProps<TAction> {
  sections: MenuSectionsModel<TAction>
  /** Подпись строки «назад» к разделу выше. */
  backLabel: string
  /** Подпись строки отказа загрузки раздела. */
  failedLabel: string
  onBack: (event: MouseEvent<HTMLElement>) => void
  /** Пункты загруженного уровня. */
  children: (actions: TAction[], closeOnSelect?: boolean) => ReactNode
}

const SKELETON_ROWS = 3

/** Классы снимка уходящего уровня: их читает состояние разделов со слоя снимков. */
const GHOST_CLASSES = {
  'data-leave-forward': clsx(styles.level, styles.ghost, styles.leaveForward),
  'data-leave-back': clsx(styles.level, styles.ghost, styles.leaveBack),
}

export const MenuSections = <TAction,>({
  sections,
  backLabel,
  failedLabel,
  onBack,
  children,
}: MenuSectionsProps<TAction>) => {
  const { menuBack: BackIcon, actionFailed: FailedIcon } = useIcons()
  const errorId = useId()
  const wrapRef = useRef<HTMLDivElement>(null)
  const { level, depth, direction, returnTo, levelRef, ghostRef } = sections
  const levelKey = level.path.join('/')
  const loaded = level.items.status === 'done' ? level.items.items : null

  // Окно следует размеру уровня: переход ширины и высоты — в CSS.
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
  }, [levelKey, levelRef])

  // Фокус после смены уровня: вход — первый пункт, возврат — пункт, из которого вошли.
  useIsomorphicLayoutEffect(() => {
    if (!direction) return
    const current = levelRef.current
    const target =
      (returnTo &&
        current?.querySelector<HTMLElement>(
          `[data-action-id="${CSS.escape(returnTo)}"]`,
        )) ||
      current?.querySelector<HTMLElement>(
        ':is([role="menuitem"], [role="menuitemcheckbox"]):not([data-menu-back])',
      ) ||
      current?.querySelector<HTMLElement>('[role="menuitem"]')
    // Кадром позже: Base UI после смены списка подсвечивает пункт по прежнему номеру.
    const frame = requestAnimationFrame(() =>
      target?.focus({ preventScroll: true }),
    )
    return () => cancelAnimationFrame(frame)
  }, [levelKey, direction, returnTo, levelRef, loaded])

  const error = level.items.status === 'failed' ? level.items.error : undefined
  const errorText = error === undefined ? undefined : rejectionText(error)

  return (
    <div ref={wrapRef} className={styles.sections}>
      <div ref={ghostRef} className={styles.ghostHost} {...GHOST_CLASSES} />
      <div
        key={levelKey}
        ref={levelRef}
        className={clsx(
          styles.level,
          direction === 'forward' && styles.enterForward,
          direction === 'back' && styles.enterBack,
        )}
        data-menu-level={depth}
      >
        {depth > 0 && (
          <>
            <Menu.Item
              className={clsx(styles.item, styles.backItem)}
              aria-label={backLabel}
              closeOnClick={false}
              onClick={onBack}
              data-menu-back=""
            >
              <span className={styles.itemIcon} aria-hidden>
                <BackIcon width={16} height={16} />
              </span>
              <span className={styles.itemLabel}>{level.title}</span>
            </Menu.Item>
            <Menu.Separator className={styles.separator} />
          </>
        )}
        {level.items.status === 'loading' &&
          Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <div
              key={index}
              className={styles.skeletonRow}
              data-menu-skeleton=""
            >
              <Skeleton
                width="100%"
                height="var(--tsr-comp-skeleton-menu-height)"
              />
            </div>
          ))}
        {level.items.status === 'failed' && (
          <>
            <Tooltip title={errorText} side="right">
              <Menu.Item
                className={styles.item}
                closeOnClick={false}
                onClick={sections.retry}
                aria-describedby={errorText ? errorId : undefined}
                data-has-tooltip={errorText ? '' : undefined}
                data-section-failed=""
              >
                <span className={styles.itemIcon} aria-hidden />
                <span className={styles.itemLabel}>{failedLabel}</span>
                <span
                  className={clsx(styles.itemCheck, styles.itemFailed)}
                  aria-hidden
                >
                  <FailedIcon width={14} height={14} />
                </span>
              </Menu.Item>
            </Tooltip>
            {errorText && (
              <span id={errorId} hidden>
                {errorText}
              </span>
            )}
          </>
        )}
        {loaded && children(loaded, level.closeOnSelect)}
      </div>
    </div>
  )
}
