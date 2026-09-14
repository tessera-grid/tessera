/**
 * Фаза C — порт контракта действий слота (кебаб-меню) на v9. Совпадает с v8
 * ([src/lib/core/headerActions/types.ts]); отличия:
 *  - контекст — v9 `HeaderComponentProps`/`CellComponentProps` (из ./createSlots);
 *  - УБРАНО поле `subscribe` (ключи Pub-Sub): в v9 гранулярная реактивность —
 *    через `useSelector(table.atoms.<slice>)` на уровне компонента (фаза D), а не
 *    декларацией примитивов на действии.
 */
import type { MouseEvent, ReactNode } from 'react'

import type { TableLabels } from '../../core/localization'
import type { CellComponentProps, HeaderComponentProps } from '../createSlots'

/** Все слоты, в которых может жить действие (шапка + ячейка + строка действий). */
export type SlotName =
  | 'leftHeaderSlot'
  | 'rightHeaderSlot'
  | 'leftCellSlot'
  | 'rightCellSlot'
  | 'actionRowSlot'

/** Слоты заголовка (подмножество `SlotName`). */
export type HeaderActionSlot = 'leftHeaderSlot' | 'rightHeaderSlot'

/**
 * Декларативное действие слота — единственный источник правды для кнопки: иконка/
 * подпись/обработчик и признаки. Ядро решает подачу (инлайн иконка-кнопка или
 * строка кебаб-меню), поэтому плагин описывает действие данными, а не JSX.
 */
export interface SlotAction<TCtx = any, TSlot extends SlotName = SlotName> {
  /** Уникальный id действия — ключ дедупликации при сборке. */
  id: string
  /** Слот, в котором отрисовывается действие. */
  slot: TSlot
  /** Порядок: число — индекс вставки, `'last'`/`undefined` — в конец. */
  order?: number | 'last'
  /** Иконка действия (инлайн-кнопка и строка меню). */
  icon: (ctx: TCtx) => ReactNode
  /** Подпись: `aria-label`/тултип инлайн-кнопки и текст строки меню. */
  label: (ctx: TCtx, labels: TableLabels) => string
  /** Доступное имя ИНЛАЙН-кнопки, если отличается от тултипа `label`. */
  ariaLabel?: (ctx: TCtx, labels: TableLabels) => string
  /** Обработчик выбора (клик по инлайн-кнопке). `event` — для действий с модификаторами. */
  onSelect: (ctx: TCtx, event?: MouseEvent<HTMLButtonElement>) => void
  /** Применимо ли действие к этой колонке (`false` убирает целиком). */
  visible?: (ctx: TCtx) => boolean
  /** Заблокировано ли действие (кнопка/пункт неактивны, но видимы). */
  disabled?: (ctx: TCtx) => boolean
  /** Состояние-тумблер (закреплено/отсортировано/сгруппировано). */
  active?: (ctx: TCtx) => boolean
  /** Может ли действие уезжать в кебаб при схлопывании. По умолчанию `true`. */
  collapsible?: boolean
  /** Класс инлайн-кнопки — escape для плагин-специфичной подачи. */
  className?: (ctx: TCtx) => string | undefined
  /** Довесок ИНЛАЙН-кнопки (бейдж и т.п.), рядом с иконкой. */
  adornment?: (ctx: TCtx) => ReactNode
  /** Разворот действия в НЕСКОЛЬКО пунктов меню (напр. сортировка asc/desc/сброс). */
  menuItems?: (ctx: TCtx, labels: TableLabels) => HeaderMenuItem[]
  /** Показывать ли ИНЛАЙН-подачу как мини-меню (поповер) из `menuItems`. */
  inlineAsMenu?: (ctx: TCtx) => boolean
  /** Необязательный заголовок подгруппы действия в меню (`Menu.GroupLabel`). */
  menuGroupLabel?: (labels: TableLabels) => string
}

/** Действие в слоте ЗАГОЛОВКА колонки. */
export type HeaderAction = SlotAction<HeaderComponentProps, HeaderActionSlot>

/** Действие в слоте действий СТРОКИ. */
export type RowAction = SlotAction<CellComponentProps, 'actionRowSlot'>

/**
 * Разрешённый пункт кебаб-меню (результат `SlotAction.menuItems`): поля уже
 * вычислены с учётом `ctx`/`labels`.
 */
export interface HeaderMenuItem {
  /** Уникальный id пункта в пределах подгруппы. */
  id: string
  /** Текст пункта и `aria-label`. */
  label: string
  /** Иконка пункта. */
  icon?: ReactNode
  /** Обработчик выбора пункта. */
  onSelect: () => void
  /** Заблокирован ли пункт. */
  disabled?: boolean
  /** Отмечен ли пункт (галочка). */
  active?: boolean
}

/** Свёрнутый по всем слотам набор действий (аналог `RenderSlots`). */
export type SlotActions = Record<SlotName, SlotAction[]>

/** Конфиг схлопывания ОДНОГО слота в кебаб-меню (разрешённый, per-slot). */
export interface SlotMenuConfig {
  /** `auto` — по порогу; `always` — всегда, игнорируя счётчик. */
  mode: 'auto' | 'always'
  /** Порог схлопывания для `auto`. */
  threshold: number
}

/** Карта конфигов меню по слотам (ключ = слот; отсутствие = кебаб выключен). */
export type SlotActionMenu = Partial<Record<SlotName, SlotMenuConfig>>

/** Декларация плагина-меню в записи реестра: на какие слоты распространить кебаб. */
export interface ActionMenuDeclaration extends SlotMenuConfig {
  slots: SlotName[]
}
