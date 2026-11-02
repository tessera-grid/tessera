// ActionMenu: схлопнутая подача действий слота (кебаб ⋮ + раскрывающееся меню
// Base UI). Закрытое меню перерисовывает ActionsZone по виду зоны, открытое — любая
// смена состояния (useStateWhileOpen).
// Открытием управляет ленивая обёртка (ActionMenu.lazy): контролируемый `open`
// позволяет открыть меню сразу после догрузки чанка, если по плейсхолдеру уже
// кликнули.
import { useRef, useState } from 'react'

import { Menu } from '@base-ui/react/menu'
import { Popover } from '@base-ui/react/popover'
import clsx from 'clsx'

import { useLocalization } from '../../core/localization'
import { IconButton } from '../../ui/IconButton'
import { HiddenButtonContext } from '../../ui/IconButton/iconReveal'
import { useIcons } from '../../ui/icons'
import { countActiveActions, type SlotAction } from '../../core/headerActions'
import { kebabActive } from './kebabActive'
import { ActionMenuPopup } from './ActionMenuPopup'
import { ActionPanelPopup } from './ActionPanelPopup'
import { useCloseOnGridScroll } from '../../ui/Popup/useCloseOnGridScroll'
import { useClosingVisible } from './useClosingVisible'
import { GRID_SCROLL_REASON, useMenuLeave } from '../../ui/Popup/useMenuLeave'
import { usePanelOpening } from './usePanelOpening'
import { type KebabState } from './useKebabState'
import { useMenuSections } from '../../core/headerActions'
import { useStateWhileOpen } from './useStateWhileOpen'

import styles from '../../ui/Popup/ActionMenu.module.css'
import '../../ui/cellControls/buttonVisibility.css'

export interface ActionMenuProps {
  actions: SlotAction[]
  context: any
  variant?: 'cell' | 'row'
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Сессия проверок, ждущие и упавшие действия (ADR 0078). */
  kebab: KebabState
}

export const ActionMenu = ({
  actions,
  context,
  variant = 'cell',
  open,
  onOpenChange,
  kebab,
}: ActionMenuProps) => {
  const { menu: MenuIcon } = useIcons()
  const labels = useLocalization()
  const [visible, onOpenChangeComplete] = useClosingVisible(open)
  const { extend } = kebab.session
  const sections = useMenuSections(actions, context, labels, undefined, items =>
    extend(items, context),
  )
  const triggerRef = useRef<HTMLButtonElement>(null)
  // Действие с панелью, открытое из меню: поповер у кнопки кебаба.
  const [panelAction, setPanelAction] = useState<SlotAction | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelVisible, onPanelOpenChangeComplete] = useClosingVisible(panelOpen)
  useStateWhileOpen(context.table, visible || panelVisible)
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
  const leave = useMenuLeave()
  const onMenuOpenChange = (next: boolean, details?: { reason?: string }) => {
    leave.track(next, details?.reason)
    // Escape в разделе — уровень выше, а не закрытие (ADR 0079).
    if (!next && details?.reason === 'escape-key' && sections.back()) return
    if (next) panelTakesFocus.current = false
    else {
      opening.cancel()
      sections.abort()
    }
    onOpenChange(next)
  }

  useCloseOnGridScroll(open, () =>
    onMenuOpenChange(false, { reason: GRID_SCROLL_REASON }),
  )

  // Свёрнутые включённые действия видны на кебабе: точка, имя и показ без наведения. Ждущее
  // действие держит кебаб видимым — в меню его пункт отменяет (ADR 0153, §3); ожидание и отказ
  // — на объекте действия (ADR 0177, §1).
  const activeCount = countActiveActions(actions, context)
  const shown = visible || panelVisible || activeCount > 0 || kebab.running
  const trigger = (
    <Menu.Trigger
      render={
        <IconButton
          ref={triggerRef}
          className={styles.trigger}
          label={kebab.title}
          aria-label={kebab.ariaLabel}
          // Дуга — только загрузка панели, процесс вне таблицы (ADR 0177, §2).
          pending={opening.pending}
          failed={opening.failed}
          data-action-menu={variant}
          onPointerEnter={kebab.intent}
          onFocus={kebab.intent}
          onPointerLeave={kebab.leave}
          onBlur={kebab.leave}
          active={kebabActive(actions, activeCount)}
        >
          <MenuIcon width={16} height={16} />
        </IconButton>
      }
    />
  )

  return (
    <Menu.Root
      modal={false}
      open={open}
      onOpenChange={onMenuOpenChange}
      onOpenChangeComplete={next => {
        onOpenChangeComplete(next)
        if (!next) {
          kebab.closed()
          sections.reset()
        }
      }}
    >
      {/*
       * Как остальные кнопки ячейки/заголовка: по наведению или фокусу; пока меню
       * открыто или закрывается, `data-button-active` держит кебаб видимым (ADR 0024,
       * AM24, AM25). Попапы — внутри обёртки: служебные узлы портала не встают между
       * кнопками ряда.
       */}
      <div
        className={
          variant === 'row'
            ? clsx('row__button', !shown && 'row__button--hidden')
            : 'cell__button cell__button--hidden'
        }
        data-button-active={variant === 'row' ? undefined : shown}
      >
        <HiddenButtonContext.Provider value={!shown}>
          {trigger}
        </HiddenButtonContext.Provider>
        <ActionMenuPopup
          actions={actions}
          context={context}
          session={kebab.session}
          sections={sections}
          close={() => onMenuOpenChange(false)}
          onOpenPanel={openPanel}
          finalFocus={() => !panelTakesFocus.current && leave.returnFocus()}
          popupRef={leave.popupRef}
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
      </div>
    </Menu.Root>
  )
}

ActionMenu.displayName = 'ActionMenu'
