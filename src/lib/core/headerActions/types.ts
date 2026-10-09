/**
 * Контракт действий слота (кебаб-меню). Контекст — `HeaderComponentProps`/
 * `CellComponentProps` (из ./createSlots); гранулярная реактивность — через
 * `useSelector(table.atoms.<slice>)` на уровне компонента.
 */
import type { MouseEvent, ReactNode, RefObject } from 'react'

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
 * Действие-как-данные для строки МЕНЮ — общий контракт кебаб-меню (ADR 0024) и
 * контекстного меню (ADR 0030). Достаточно для `resolveMenuItems`; инлайн-подача
 * (кнопка в слоте) и `slot` живут в наследнике `SlotAction`.
 */
export interface MenuAction<TCtx = any> {
  /** Уникальный id действия — ключ дедупликации при сборке. */
  id: string
  /** Порядок: число — индекс вставки, `'last'`/`undefined` — в конец. */
  order?: number | 'last'
  /** Иконка действия (инлайн-кнопка и строка меню). */
  icon: (ctx: TCtx) => ReactNode
  /** Подпись: `aria-label`/тултип инлайн-кнопки и текст строки меню. */
  label: (ctx: TCtx, labels: TableLabels) => string
  /**
   * Обработчик выбора (клик по инлайн-кнопке/пункту). `event` — для модификаторов.
   * Промис — долгое действие: ожидание и отказ видны на кебабе и пункте (ADR 0078).
   */
  onSelect: (
    ctx: TCtx,
    event?: MouseEvent<HTMLButtonElement>,
  ) => void | Promise<unknown>
  /** Применимо ли действие в этом контексте (`false` убирает целиком). */
  visible?: (ctx: TCtx) => boolean
  /**
   * Заблокировано ли действие (пункт неактивен, но видим) и почему. Промис — проверка
   * в меню при наведении на кебаб и открытии; `signal` прерывается закрытием, отказ
   * промиса — проверка не удалась (ADR 0078).
   */
  disabled?: (
    ctx: TCtx,
    signal: AbortSignal,
  ) => DisabledResult | Promise<DisabledResult>
  /** Текст отказа действия или проверки; без него — текст ошибки или подпись. */
  errorMessage?: (
    ctx: TCtx,
    error: unknown,
    labels: TableLabels,
  ) => string | undefined
  /** Состояние-тумблер (закреплено/отсортировано/сгруппировано). */
  active?: (ctx: TCtx) => boolean
  /** Разворот действия в НЕСКОЛЬКО пунктов меню (напр. сортировка asc/desc/сброс). */
  menuItems?: (ctx: TCtx, labels: TableLabels) => HeaderMenuItem[]
  /** Необязательный заголовок подгруппы действия в меню (`Menu.GroupLabel`). */
  menuGroupLabel?: (labels: TableLabels) => string
  /**
   * Раздел: пункт ведёт на следующий уровень меню, `onSelect` не вызывается
   * (ADR 0079).
   */
  submenu?: (ctx: TCtx, labels: TableLabels) => MenuSection<TCtx>
  /** Значение пункта-раздела мелким текстом перед шевроном («Pin … Left»). */
  hint?: (ctx: TCtx, labels: TableLabels) => string | undefined
  /**
   * `false` — выбор не закрывает меню (переопределяет умолчание раздела); пункт с
   * `active` становится флажком меню (ADR 0079).
   */
  closeOnSelect?: boolean
}

/** Раздел меню (ADR 0079): пункты сразу или промисом — тогда со скелетом. */
export interface MenuSection<TCtx = any> {
  title: string
  /** Умолчание для пунктов раздела: `false` — выбор не закрывает меню. */
  closeOnSelect?: boolean
  items:
    MenuAction<TCtx>[] | ((signal: AbortSignal) => Promise<MenuAction<TCtx>[]>)
}

/**
 * Почему действие заблокировано (ADR 0078): `done` — уже сделано (галочка),
 * `forbidden` — нельзя в принципе, например нет прав (замок). `reason` — текст тултипа.
 */
export interface DisabledState {
  kind: 'done' | 'forbidden'
  reason?: string
}

/** Ответ `disabled`: `true` — запрещено без текста. */
export type DisabledResult = boolean | DisabledState

/**
 * Декларативное действие слота — единственный источник правды для кнопки: иконка/
 * подпись/обработчик и признаки. Ядро решает подачу (инлайн иконка-кнопка или
 * строка кебаб-меню), поэтому плагин описывает действие данными, а не JSX.
 */
export interface SlotAction<
  TCtx = any,
  TSlot extends SlotName = SlotName,
> extends MenuAction<TCtx> {
  /** Слот, в котором отрисовывается действие. */
  slot: TSlot
  /** Доступное имя ИНЛАЙН-кнопки, если отличается от тултипа `label`. */
  ariaLabel?: (ctx: TCtx, labels: TableLabels) => string
  /** Может ли действие уезжать в кебаб при схлопывании. По умолчанию `true`. */
  collapsible?: boolean
  /**
   * `'menu'` — только строка кебаба: инлайн не рисуется; вызванный им кебаб считается
   * в пороге одной кнопкой; без плагина-меню не показывается. По умолчанию `'auto'`.
   */
  placement?: 'auto' | 'menu'
  /** Класс инлайн-кнопки — escape для плагин-специфичной подачи. */
  className?: (ctx: TCtx) => string | undefined
  /** Довесок ИНЛАЙН-кнопки (бейдж и т.п.), рядом с иконкой. */
  adornment?: (ctx: TCtx) => ReactNode
  /** Показывать ли ИНЛАЙН-подачу как мини-меню (поповер) из `menuItems`. */
  inlineAsMenu?: (ctx: TCtx) => boolean
  /**
   * Действие с панелью: инлайн-кнопка и пункт кебаба открывают поповер с этим
   * содержимым (у кебаба — у его кнопки), `onSelect` не вызывается.
   */
  panel?: (ctx: TCtx, controls: ActionPanelControls) => ReactNode
  /**
   * Загрузка содержимого `panel` (ленивые модули): поповер открывается после неё,
   * а начинается она уже при наведении и фокусе кнопки.
   */
  preload?: (ctx: TCtx) => Promise<unknown>
}

/** Управление поповером действия с панелью. */
export interface ActionPanelControls {
  close: () => void
  /** Элемент, получающий фокус при открытии; без него — первый фокусируемый. */
  initialFocusRef: RefObject<HTMLElement | null>
}

/**
 * Сводка выделения ячеек для контекстного меню (ADR 0030). Позволяет пункту
 * гейтить себя по одиночному/множественному выбору без развилки «меню A vs B».
 */
export interface CellSelectionSummary {
  /** Сколько ячеек выделено. */
  count: number
  /** Ровно одна выделенная ячейка. */
  isSingle: boolean
  /** Выделено больше одной. */
  isMultiple: boolean
  /** Ячейка под курсором входит в выделение. */
  isInSelection: boolean
}

/** Контекст пункта контекстного меню: контекст ячейки под курсором + сводка выбора. */
export interface ContextMenuContext extends CellComponentProps {
  /** Сводка текущего выделения ячеек (пусто, если cellSelection не подключён). */
  selection: CellSelectionSummary
}

/** Действие контекстного меню (ADR 0030): дескриптор меню без слота/инлайн-подачи. */
export type ContextMenuAction = MenuAction<ContextMenuContext>

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
