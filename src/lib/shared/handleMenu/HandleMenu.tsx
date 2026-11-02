// HandleMenu: меню команд у ручки перетаскивания или грипа ширины — альтернатива
// перетаскиванию одним указателем (WCAG 2.5.7, ADR 0034). Модель: ленивое открытие и канал
// действий; вид — `ui/Popup/HandleMenuPopup` (ADR 0168). Рендерится только открытым; попап
// грузится лениво: при наведении и фокусе на ручке, а нажатие до загрузки открывает меню
// после неё (ADR 0061, LZ11–LZ14).
import { type RefObject, Suspense, useState } from 'react'

import { reportAction, sourceOf } from '../../core/debugActions'
import type { HeaderMenuItem } from '../../core/headerActions'
import { type LazyTriggerState, useLazyOpening } from '../../core/lazyOpening'
import type { TableLabels } from '../../core/localization'
import { preloadable } from '../../core/preloadable'

const HandleMenuPopupImpl = preloadable(() =>
  import('../../ui/Popup/HandleMenuPopup').then(m => m.HandleMenuPopup),
)

/** Модуль попапа меню ручек — для проверки загрузки заранее (LZ11). */
export const handleMenuModule = HandleMenuPopupImpl

const noop = () => {}

/** Открытие меню ручки: после загрузки модуля, с ожиданием, отменой и ошибкой. */
export const useHandleMenu = (
  table: unknown,
  label: (labels: TableLabels) => string,
) => {
  const [open, setOpen] = useState(false)
  const opening = useLazyOpening(table)
  const request = () =>
    opening.request(
      {
        load: HandleMenuPopupImpl.reload,
        isReady: HandleMenuPopupImpl.isLoaded,
        label,
      },
      () => setOpen(true),
    )
  const trigger: LazyTriggerState = {
    pending: opening.pending,
    failed: opening.failed,
    onIntent: () => void HandleMenuPopupImpl.load().catch(noop),
    onCancel: opening.cancel,
  }
  return { open, close: () => setOpen(false), request, trigger }
}

export interface HandleMenuProps {
  anchor: RefObject<HTMLElement | null>
  /** Куда вернуть фокус при закрытии; по умолчанию — якорь. */
  focusTarget?: RefObject<HTMLElement | null>
  label: string
  /** Пункты вычисляются при открытии — по текущему порядку и ширинам. */
  getItems: () => HeaderMenuItem[]
  onClose: () => void
  /** Таблица и плагин-владелец ручки — для канала действий (ADR 0125). */
  table?: unknown
  plugin: string
}

export const HandleMenu = ({
  anchor,
  focusTarget,
  label,
  getItems,
  onClose,
  table,
  plugin,
}: HandleMenuProps) => {
  const [items] = useState(getItems)
  return (
    <Suspense fallback={null}>
      <HandleMenuPopupImpl.Component
        anchor={anchor}
        focusTarget={focusTarget}
        label={label}
        items={items}
        onClose={onClose}
        onItemSelect={(id, event) =>
          reportAction(table, {
            plugin,
            action: `handleMenu:${id}`,
            source: sourceOf(event),
          })
        }
      />
    </Suspense>
  )
}

HandleMenu.displayName = 'HandleMenu'
