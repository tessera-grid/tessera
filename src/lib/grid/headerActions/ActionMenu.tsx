import { memo, useState } from 'react'

import { Menu } from '@base-ui/react/menu'
import clsx from 'clsx'

import { SlotAction } from '../../core/headerActions'
import { useLocalization } from '../../core/localization'
import { useSubscribeStore } from '../../core/subscribeStore/subscribeStore'
import { IconButton } from '../../ui/IconButton'
import { useIcons } from '../../ui/icons'
import { ActionMenuPopup } from './ActionMenuPopup'

import styles from './ActionMenu.module.css'
import '../cellControls/buttonVisibility.css'

interface ActionMenuProps {
  actions: SlotAction[]
  /** Контекст слота (заголовок/ячейка) — прозрачно передаётся в признаки действия. */
  context: any
  /**
   * Видимость кебаб-триггера: `cell` — всегда виден (заголовки/ячейки); `row` —
   * ревил по hover строки (`row__button`), но остаётся видимым, пока меню открыто.
   * По умолчанию `cell`.
   */
  variant?: 'cell' | 'row'
}

/**
 * Схлопнутая подача действий слота: кебаб-кнопка (⋮) с раскрывающимся меню на
 * Base UI, пункты делятся на подгруппы (по одному действию на подгруппу). Тело
 * меню — общий `ActionMenuPopup`. Блокировка/состояние читаются из дескриптора;
 * подписка на объединение ключей Pub-Sub всех действий держит пункты в актуальном
 * состоянии. Контекст-агностична.
 */
export const ActionMenu = memo(
  ({ actions, context, variant = 'cell' }: ActionMenuProps) => {
    const { menu: MenuIcon } = useIcons()
    const labels = useLocalization()

    // Для варианта строки триггер ревилится по hover строки (`row__button--hidden`),
    // но пока меню открыто — держим его видимым (курсор ушёл в портал, строка вне
    // hover). Состояние открытия ведём из Base UI (`onOpenChange`), а не CSS
    // `:has` на потомке — динамическая инвалидация `:has` ненадёжна.
    const [open, setOpen] = useState(false)

    useSubscribeStore(() =>
      actions.flatMap(action => action.subscribe?.(context) ?? []),
    )

    const trigger = (
      <Menu.Trigger
        render={
          <IconButton className={styles.trigger} aria-label={labels.headerMenu}>
            <MenuIcon width={16} height={16} />
          </IconButton>
        }
      />
    )

    return (
      <Menu.Root onOpenChange={setOpen}>
        {variant === 'row' ? (
          <div className={clsx('row__button', !open && 'row__button--hidden')}>
            {trigger}
          </div>
        ) : (
          trigger
        )}
        <ActionMenuPopup actions={actions} context={context} />
      </Menu.Root>
    )
  },
)

ActionMenu.displayName = 'ActionMenu'
