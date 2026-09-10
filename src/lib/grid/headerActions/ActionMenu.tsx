import { memo, useState } from 'react'

import { Menu } from '@base-ui/react/menu'
import { Check } from 'lucide-react'
import clsx from 'clsx'

import { SlotAction, HeaderMenuItem } from '../../core/headerActions'
import { TableLabels } from '../../core/localization'
import { DATA_GRID_THEME_CLASS } from '../../core/themeVariables'
import { useLocalization } from '../../core/localization'
import { useSubscribeStore } from '../../core/subscribeStore/subscribeStore'
import { IconButton } from '../../ui/IconButton'
import { useIcons } from '../../ui/icons'

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
 * Пункты подгруппы одного действия: либо разворот `menuItems` (напр. сортировка),
 * либо одна строка из полей дескриптора (пин/группировка).
 */
const resolveMenuItems = (
  action: SlotAction,
  context: unknown,
  labels: TableLabels,
): HeaderMenuItem[] => {
  if (action.menuItems) {
    return action.menuItems(context, labels)
  }

  return [
    {
      id: action.id,
      label: action.label(context, labels),
      icon: action.icon(context),
      onSelect: () => action.onSelect(context),
      disabled: action.disabled?.(context) ?? false,
      active: action.active?.(context) ?? false,
    },
  ]
}

/**
 * Схлопнутая подача действий слота: кебаб-кнопка (⋮) с раскрывающимся меню на
 * Base UI, пункты делятся на подгруппы (по одному действию на подгруппу).
 * Блокировка/состояние читаются из дескриптора; подписка на объединение ключей
 * Pub-Sub всех действий держит пункты в актуальном состоянии. Контекст-агностична.
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
        <Menu.Portal>
          <Menu.Positioner
            side="bottom"
            align="end"
            sideOffset={4}
            className={clsx(DATA_GRID_THEME_CLASS, styles.positioner)}
          >
            <Menu.Popup className={clsx(DATA_GRID_THEME_CLASS, styles.popup)}>
              {actions.map((action, index) => {
                const items = resolveMenuItems(action, context, labels)
                const groupLabel = action.menuGroupLabel?.(labels)

                return (
                  <Menu.Group
                    key={action.id}
                    className={clsx(styles.group, index > 0 && styles.divided)}
                  >
                    {groupLabel && (
                      <Menu.GroupLabel className={styles.groupLabel}>
                        {groupLabel}
                      </Menu.GroupLabel>
                    )}
                    {items.map(item => (
                      <Menu.Item
                        key={item.id}
                        className={styles.item}
                        disabled={item.disabled}
                        label={item.label}
                        onClick={item.onSelect}
                      >
                        <span className={styles.itemIcon} aria-hidden>
                          {item.icon}
                        </span>
                        <span className={styles.itemLabel}>{item.label}</span>
                        <span className={styles.itemCheck} aria-hidden>
                          {item.active && <Check width={14} height={14} />}
                        </span>
                      </Menu.Item>
                    ))}
                  </Menu.Group>
                )
              })}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    )
  },
)

ActionMenu.displayName = 'ActionMenu'
