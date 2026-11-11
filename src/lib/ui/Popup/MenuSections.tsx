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
import { Tooltip } from '../Tooltip'
import { useIcons } from '../icons'
import { PopupSkeletonRows } from './PopupSkeletonRows'
import { PopupItem, PopupItemMark } from './PopupItem'
import { LEVEL_GHOST_CLASSES, useFitToLevel } from './PopupLevels'

import styles from './ActionMenu.module.css'
import levelStyles from './PopupLevels.module.css'

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

export const MenuSections = <TAction,>({
  sections,
  backLabel,
  failedLabel,
  onBack,
  children,
}: MenuSectionsProps<TAction>) => {
  const { menuBack: BackIcon } = useIcons()
  const errorId = useId()
  const wrapRef = useRef<HTMLDivElement>(null)
  const { level, depth, direction, returnTo, levelRef, ghostRef } = sections
  const levelKey = level.path.join('/')
  const loaded = level.items.status === 'done' ? level.items.items : null

  useFitToLevel(wrapRef, levelRef, levelKey)

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
    <div ref={wrapRef} className={styles.sections} data-menu-sections="">
      <div
        ref={ghostRef}
        className={styles.ghostHost}
        data-menu-ghost=""
        {...LEVEL_GHOST_CLASSES}
      />
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
          <PopupItem
            wrap
            render={<Menu.Item closeOnClick={false} onClick={onBack} />}
            className={levelStyles.heading}
            aria-label={backLabel}
            data-menu-back=""
            icon={<BackIcon width={16} height={16} />}
            label={level.title}
          />
        )}
        {level.items.status === 'loading' && (
          <PopupSkeletonRows count={SKELETON_ROWS} data-menu-skeleton="" />
        )}
        {level.items.status === 'failed' && (
          <>
            <Tooltip title={errorText} side="right">
              <PopupItem
                wrap
                render={
                  <Menu.Item closeOnClick={false} onClick={sections.retry} />
                }
                aria-describedby={errorText ? errorId : undefined}
                data-has-tooltip={errorText ? '' : undefined}
                data-section-failed=""
                icon={null}
                label={failedLabel}
                end={<PopupItemMark status="failed" />}
              />
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
