// HandleMenu: меню команд у ручки перетаскивания или грипа ширины — альтернатива
// перетаскиванию одним указателем (WCAG 2.5.7, ADR 0034). Рендерится только
// открытым; попап (Base UI) грузится лениво.
import { type RefObject, Suspense, lazy, useState } from 'react'

import type { HeaderMenuItem } from '../../core/headerActions'

const HandleMenuPopupImpl = lazy(() =>
  import('./HandleMenuPopup').then(m => ({ default: m.HandleMenuPopup })),
)

export interface HandleMenuProps {
  anchor: RefObject<HTMLElement | null>
  /** Куда вернуть фокус при закрытии; по умолчанию — якорь. */
  focusTarget?: RefObject<HTMLElement | null>
  label: string
  /** Пункты вычисляются при открытии — по текущему порядку и ширинам. */
  getItems: () => HeaderMenuItem[]
  onClose: () => void
}

export const HandleMenu = ({
  anchor,
  focusTarget,
  label,
  getItems,
  onClose,
}: HandleMenuProps) => {
  const [items] = useState(getItems)
  return (
    <Suspense fallback={null}>
      <HandleMenuPopupImpl
        anchor={anchor}
        focusTarget={focusTarget}
        label={label}
        items={items}
        onClose={onClose}
      />
    </Suspense>
  )
}

HandleMenu.displayName = 'HandleMenu'
