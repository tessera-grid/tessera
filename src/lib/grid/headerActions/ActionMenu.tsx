// ActionMenu: схлопнутая подача действий слота (кебаб ⋮ + раскрывающееся меню
// Base UI). Реактивность даёт родительская ActionsZone (подписка на состояние).
// Открытием управляет ленивая обёртка (ActionMenu.lazy): контролируемый `open`
// позволяет открыть меню сразу после догрузки чанка, если по плейсхолдеру уже
// кликнули.
import { useRef, useState } from 'react'

import { Menu } from '@base-ui/react/menu'
import { Popover } from '@base-ui/react/popover'
import clsx from 'clsx'

import { useLocalization } from '../../core/localization'
import { IconButton } from '../../ui/IconButton'
import { Tooltip } from '../../ui/Tooltip'
import { useIcons } from '../../ui/icons'
import type { SlotAction } from '../../core/headerActions'
import { ActionMenuPopup } from './ActionMenuPopup'
import { ActionPanelPopup } from './ActionPanelPopup'
import { useClosingVisible } from './useClosingVisible'
import { usePanelOpening } from './usePanelOpening'

import styles from '../../grid/headerActions/ActionMenu.module.css'
import '../../grid/cellControls/buttonVisibility.css'

export interface ActionMenuProps {
  actions: SlotAction[]
  context: any
  variant?: 'cell' | 'row'
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const ActionMenu = ({
  actions,
  context,
  variant = 'cell',
  open,
  onOpenChange,
}: ActionMenuProps) => {
  const { menu: MenuIcon } = useIcons()
  const labels = useLocalization()
  const [visible, onOpenChangeComplete] = useClosingVisible(open)
  const triggerRef = useRef<HTMLButtonElement>(null)
  // Действие с панелью, открытое из меню: поповер у кнопки кебаба.
  const [panelAction, setPanelAction] = useState<SlotAction | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelVisible, onPanelOpenChangeComplete] = useClosingVisible(panelOpen)
  // Меню закрывается вместе с открытием панели, когда её содержимое готово, и не
  // возвращает фокус на кебаб: фокус забирает панель, а возврат закрыл бы её. Пока
  // содержимое грузится, ожидание видно на кебабе; закрытие меню его отменяет.
  const opening = usePanelOpening(context)
  const panelTakesFocus = useRef(false)
  const openPanel = (action: SlotAction) =>
    opening.request(
      action,
      () => {
        panelTakesFocus.current = true
        setPanelAction(action)
        onOpenChange(false)
        setPanelOpen(true)
      },
      () => onOpenChange(false),
    )
  const onMenuOpenChange = (next: boolean) => {
    if (next) panelTakesFocus.current = false
    else opening.cancel()
    onOpenChange(next)
  }

  const label = variant === 'row' ? labels.rowMenu : labels.headerMenu
  const trigger = (
    <Menu.Trigger
      render={
        <IconButton
          ref={triggerRef}
          className={styles.trigger}
          aria-label={label}
          pending={opening.pending}
          errorFlash={opening.errorFlash}
        >
          <MenuIcon width={16} height={16} />
        </IconButton>
      }
    />
  )

  return (
    <Menu.Root
      open={open}
      onOpenChange={onMenuOpenChange}
      onOpenChangeComplete={onOpenChangeComplete}
    >
      <Tooltip title={label}>
        {variant === 'row' ? (
          <div
            className={clsx(
              'row__button',
              !visible && !panelVisible && 'row__button--hidden',
            )}
          >
            {trigger}
          </div>
        ) : (
          // Как остальные кнопки ячейки/заголовка: по наведению или фокусу; пока меню
          // открыто или закрывается, `data-button-active` держит кебаб видимым (ADR 0024,
          // AM24, AM25).
          <div
            className="cell__button cell__button--hidden"
            data-button-active={visible || panelVisible}
          >
            {trigger}
          </div>
        )}
      </Tooltip>
      <ActionMenuPopup
        actions={actions}
        context={context}
        onOpenPanel={openPanel}
        finalFocus={() => !panelTakesFocus.current}
      />
      {panelAction && (
        <Popover.Root
          open={panelOpen}
          onOpenChange={setPanelOpen}
          onOpenChangeComplete={onPanelOpenChangeComplete}
        >
          <ActionPanelPopup
            action={panelAction}
            context={context}
            anchorRef={triggerRef}
            close={() => setPanelOpen(false)}
          />
        </Popover.Root>
      )}
    </Menu.Root>
  )
}

ActionMenu.displayName = 'ActionMenu'
