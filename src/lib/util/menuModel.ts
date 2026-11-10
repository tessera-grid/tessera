/**
 * Модель пунктов меню действий: её строит ядро (`useMenuItemGroups`), рисует кит
 * (`ui/Popup/MenuItems`). Подписи, признаки и обработчики уже решены.
 */
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react'

export interface MenuItemModel {
  key: string
  actionId: string
  itemId: string
  icon?: ReactNode
  label: string
  /** Пункт-раздел: справа шеврон и `hint`, `aria-haspopup`. */
  section: boolean
  hint?: string
  /** Вторая строка мелким текстом под подписью: что будет после выбора (ADR 0204, HT5). */
  caption?: string
  /** Тон опасного действия (ADR 0206): пункт красный. */
  tone?: 'danger'
  /** Флажок меню: пункт с `active`, не закрывающий меню. */
  checkbox: boolean
  active: boolean
  disabled: boolean
  pending: boolean
  failed: boolean
  checkFailed: boolean
  done: boolean
  locked: boolean
  closeOnClick: boolean
  /** Полный текст отказа или причины — в тултипе: строка меню не меняет высоту. */
  tooltip?: string
  description?: string
  onClick: (event: MouseEvent<HTMLElement>) => void
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void
  preload?: () => void
}

/** Пункт меню ручки перетаскивания или грипа ширины (ADR 0034). */
export interface HandleMenuItemModel {
  id: string
  label: string
  disabled?: boolean
  onSelect: () => void
  /** Пункты раздела: пункт открывает их, а не выполняется. */
  items?: HandleMenuItemModel[]
}

export interface MenuGroupModel {
  key: string
  label?: string
  divided: boolean
  items: MenuItemModel[]
}

/** Уровень меню с разделами для вида (ADR 0079). */
export interface MenuLevelModel<TAction = unknown> {
  path: readonly string[]
  title?: string
  closeOnSelect?: boolean
  items:
    | { status: 'loading' }
    | { status: 'done'; items: TAction[] }
    | { status: 'failed'; error: unknown }
}
