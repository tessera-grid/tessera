// HandleMenuPopup: меню команд у ручки — вид (Base UI Menu, контролируемый open, якорь —
// сама ручка). Грузится лениво (Base UI тянет floating-ui) — монтируется только
// открытым. Стили — общие с меню действий. Пункт с `items` открывает раздел видом `MenuSections`.
// ADR 0034, ADR 0168, ADR 0186.
import {
  type KeyboardEvent,
  type MouseEvent,
  type RefObject,
  useRef,
  useState,
} from 'react'

import { Menu } from '@base-ui/react/menu'

import type { HandleMenuItemModel } from '../../util/menuModel'
import { type MenuSectionsModel, MenuSections } from './MenuSections'
import { PopupGroup } from './PopupGroup'
import { PopupItem, PopupItemMark } from './PopupItem'
import { PopupSurface } from './PopupSurface'
import { useCloseOnGridScroll } from './useCloseOnGridScroll'
import { GRID_SCROLL_REASON, useMenuLeave } from './useMenuLeave'

import menuStyles from './ActionMenu.module.css'

export interface HandleMenuPopupProps {
  anchor: RefObject<HTMLElement | null>
  /** Куда вернуть фокус при закрытии; по умолчанию — якорь. */
  focusTarget?: RefObject<HTMLElement | null>
  label: string
  items: HandleMenuItemModel[]
  onClose: () => void
  /** Пункт выбран — до его обработчика (канал действий, ADR 0125). */
  onItemSelect?: (id: string, event: MouseEvent) => void
  /** Подпись строки «назад» из раздела. */
  backLabel?: (title: string) => string
}

/** Открытый раздел меню: без загрузки, уровней всегда два. */
const useHandleSections = (items: HandleMenuItemModel[]) => {
  const [section, setSection] = useState<HandleMenuItemModel>()
  const [direction, setDirection] = useState<'forward' | 'back' | null>(null)
  const [origin, setOrigin] = useState<string>()
  const levelRef = useRef<HTMLDivElement>(null)
  const ghostRef = useRef<HTMLDivElement>(null)
  const model: MenuSectionsModel<HandleMenuItemModel> = {
    level: {
      path: section ? [section.id] : [],
      title: section?.label,
      closeOnSelect: true,
      items: { status: 'done', items: section?.items ?? items },
    },
    depth: section ? 1 : 0,
    direction,
    returnTo: direction === 'back' ? origin : undefined,
    levelRef,
    ghostRef,
    retry: () => {},
  }
  return {
    model,
    enter: (item: HandleMenuItemModel) => {
      setOrigin(item.id)
      setDirection('forward')
      setSection(item)
    },
    back: () => {
      setDirection('back')
      setSection(undefined)
    },
  }
}

export const HandleMenuPopup = ({
  anchor,
  focusTarget = anchor,
  label,
  items,
  onClose,
  onItemSelect,
  backLabel,
}: HandleMenuPopupProps) => {
  const sections = useHandleSections(items)
  const hasSections = items.some(item => item.items)
  const leave = useMenuLeave()
  useCloseOnGridScroll(true, () => {
    leave.track(false, GRID_SCROLL_REASON)
    onClose()
  })
  const onKeyDown = (
    event: KeyboardEvent<HTMLElement>,
    item: HandleMenuItemModel,
  ) => {
    if (event.key === 'ArrowRight' && item.items && !item.disabled) {
      event.preventDefault()
      sections.enter(item)
    } else if (event.key === 'ArrowLeft' && sections.model.depth > 0) {
      event.preventDefault()
      sections.back()
    }
  }

  const renderItem = (item: HandleMenuItemModel) => (
    <PopupItem
      key={item.id}
      wrap
      render={
        <Menu.Item
          disabled={item.disabled}
          label={item.label}
          closeOnClick={!item.items}
          onKeyDown={event => onKeyDown(event, item)}
          onClick={event => {
            onItemSelect?.(item.id, event)
            if (item.items) sections.enter(item)
            else item.onSelect()
          }}
        />
      }
      data-item-id={item.id}
      data-action-id={item.id}
      aria-haspopup={item.items ? 'menu' : undefined}
      label={item.label}
      end={item.items ? <PopupItemMark status="submenu" /> : undefined}
    />
  )

  return (
    <Menu.Root
      modal={false}
      open
      onOpenChange={(open, details) => {
        leave.track(open, details.reason)
        if (!open) {
          onClose()
        }
      }}
    >
      <Menu.Portal>
        <PopupSurface
          positioner={
            <Menu.Positioner anchor={anchor} side="bottom" align="start" />
          }
          popup={
            <Menu.Popup
              aria-label={label}
              finalFocus={() =>
                leave.returnFocus() && (focusTarget.current ?? true)
              }
            />
          }
          className={menuStyles.popup}
        >
          {hasSections ? (
            <MenuSections
              sections={sections.model}
              backLabel={backLabel?.(sections.model.level.title ?? '') ?? ''}
              failedLabel=""
              onBack={sections.back}
            >
              {list => (
                <PopupGroup render={<Menu.Group />}>
                  {list.map(renderItem)}
                </PopupGroup>
              )}
            </MenuSections>
          ) : (
            <PopupGroup render={<Menu.Group />}>
              {items.map(renderItem)}
            </PopupGroup>
          )}
        </PopupSurface>
      </Menu.Portal>
    </Menu.Root>
  )
}
