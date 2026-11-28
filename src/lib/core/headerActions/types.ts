/**
 * Контракт действий слота (кебаб-меню). Контекст — `HeaderComponentProps`/
 * `CellComponentProps` (из ./createSlots); гранулярная реактивность — через
 * `useSelector(table.atoms.<slice>)` на уровне компонента.
 */
import type { MouseEvent, ReactNode, RefObject } from 'react'

import type { TableLabels } from '../../core/localization'
import type { CellComponentProps, HeaderComponentProps } from '../createSlots'
import type { NamedAction } from '../actions'
import type { FlashTarget } from '../highlights/highlightFeature'

/** All slots an action can live in (header + cell + row actions). */
export type SlotName =
  | 'leftHeaderSlot'
  | 'rightHeaderSlot'
  | 'leftCellSlot'
  | 'rightCellSlot'
  | 'actionRowSlot'

/** Header slots (a subset of `SlotName`). */
export type HeaderActionSlot = 'leftHeaderSlot' | 'rightHeaderSlot'

/**
 * Действие-как-данные для строки МЕНЮ — общий контракт кебаб-меню (ADR 0024) и
 * контекстного меню (ADR 0030). Достаточно для `resolveMenuItems`; инлайн-подача
 * (кнопка в слоте) и `slot` живут в наследнике `SlotAction`.
 */
/** Action tone (ADR 0206). */
export type ActionTone = 'danger'

export interface MenuAction<TCtx = any> extends NamedAction<TCtx> {
  /** Unique action id — the deduplication key when collecting, and the catalog action name. */
  id: string
  /** Order: a number is the insertion index, `'last'`/`undefined` puts it at the end. */
  order?: number | 'last'
  /** Action icon (inline button and menu item). */
  icon: (ctx: TCtx) => ReactNode
  /**
   * Selection handler (a click on the inline button or menu item). `event` is for modifiers.
   * A promise is a long action: pending and failure show on the kebab and the item (ADR 0078).
   */
  onSelect: (
    ctx: TCtx,
    event?: MouseEvent<HTMLButtonElement>,
    /** `signal` is aborted when the user or the application cancels the action (ADR 0153). */
    context?: { signal: AbortSignal },
  ) => void | Promise<unknown>
  /** Whether the action applies in this context (`false` removes it entirely). */
  visible?: (ctx: TCtx) => boolean
  /**
   * Whether the action is disabled (the item is inactive but visible) and why. A promise is
   * checked in the menu on kebab hover and open; `signal` is aborted on close, a rejected
   * promise means the check failed (ADR 0078).
   */
  disabled?: (
    ctx: TCtx,
    signal: AbortSignal,
  ) => DisabledResult | Promise<DisabledResult>
  /**
   * Outcome target (ADR 0152): a rejection of the `onSelect` promise flashes on it; while it is
   * pending, its cells carry `aria-busy`. `defaultTarget` is the default target: the cell or the
   * selection for the context menu, none for kebabs and inline buttons. `false` — no target;
   * `'table'` — the action changes the whole table: a glow under the header, a failure shows as
   * an alert (ADR 0155, §2).
   */
  target?: (
    ctx: TCtx,
    defaultTarget: FlashTarget | readonly FlashTarget[] | undefined,
  ) => FlashTarget | readonly FlashTarget[] | false | 'table'
  /** Failure text of the action or the check; without it — the error text or the label. */
  errorMessage?: (
    ctx: TCtx,
    error: unknown,
    labels: TableLabels,
  ) => string | undefined
  /** Toggle state (pinned, sorted, grouped). */
  active?: (ctx: TCtx) => boolean
  /** Has something not applied (ADR 0178, §3): a dot on the button, the button stays in the row. */
  draft?: (ctx: TCtx) => boolean
  /**
   * The button is visible without hover and stays in the row, without a mark on it: its target
   * is already highlighted by its own look (reverting a row before saving, ADR 0178, §7).
   */
  shown?: (ctx: TCtx) => boolean
  /** Expands the action into SEVERAL menu items (for example sorting asc/desc/clear). */
  menuItems?: (ctx: TCtx, labels: TableLabels) => HeaderMenuItem[]
  /** Optional title of the action's subgroup in the menu (`Menu.GroupLabel`). */
  menuGroupLabel?: (labels: TableLabels) => string
  /**
   * A section: the item opens the next menu level, `onSelect` is not called (ADR 0079).
   */
  submenu?: (ctx: TCtx, labels: TableLabels) => MenuSection<TCtx>
  /**
   * Value of a section item in small text before the chevron ("Pin … Left"); for a regular item —
   * a second line under the label: what happens after selecting it (ADR 0204, HT5).
   */
  hint?: (ctx: TCtx, labels: TableLabels) => string | undefined
  /** A shortcut like `Mod+Z` (Mod is Cmd on Apple and Ctrl elsewhere; ADR 0232, KX14). */
  shortcut?: string
  /**
   * `false` — selecting doesn't close the menu (overrides the section default); an item with
   * `active` becomes a menu checkbox (ADR 0079).
   */
  closeOnSelect?: boolean
  /**
   * Tone (ADR 0206): `'danger'` — the action irreversibly loses user data; the menu item and the
   * slot button are red even at rest. A function gives the tone by context.
   */
  tone?: ActionTone | ((ctx: TCtx) => ActionTone | undefined)
}

/** A menu section (ADR 0079): items right away, or a promise — then with a skeleton. */
export interface MenuSection<TCtx = any> {
  title: string
  /** Default for the section's items: `false` — selecting doesn't close the menu. */
  closeOnSelect?: boolean
  items:
    MenuAction<TCtx>[] | ((signal: AbortSignal) => Promise<MenuAction<TCtx>[]>)
}

/**
 * Why the action is disabled (ADR 0078): `done` — already done (a check mark), `forbidden` —
 * not allowed at all, for example no permission (a lock). `reason` is the tooltip text.
 */
export interface DisabledState {
  kind: 'done' | 'forbidden'
  reason?: string
}

/** The `disabled` answer: `true` means forbidden without a text. */
export type DisabledResult = boolean | DisabledState

/**
 * A declarative slot action — the single source of truth for a button: icon, label, handler
 * and flags. The core decides how to show it (an inline icon button or a kebab-menu item), so
 * a plugin describes the action as data, not JSX.
 */
export interface SlotAction<
  TCtx = any,
  TSlot extends SlotName = SlotName,
> extends MenuAction<TCtx> {
  /** The slot the action renders in. */
  slot: TSlot
  /** Accessible name of the INLINE button, when it differs from the `label` tooltip. */
  ariaLabel?: (ctx: TCtx, labels: TableLabels) => string
  /** Whether the action can move into the kebab when collapsing. `true` by default. */
  collapsible?: boolean
  /**
   * `'menu'` — only a kebab item, no inline button; the kebab it causes counts as one button
   * toward the threshold; not shown without a menu plugin. `'auto'` by default.
   */
  placement?: 'auto' | 'menu'
  /** Class of the inline button — an escape hatch for plugin-specific presentation. */
  className?: (ctx: TCtx) => string | undefined
  /** Number in the badge of an active INLINE button instead of a dot (ADR 0129). */
  count?: (ctx: TCtx) => number | undefined
  /** Whether to show the INLINE presentation as a mini menu (popover) from `menuItems`. */
  inlineAsMenu?: (ctx: TCtx) => boolean
  /**
   * An action with a panel: the inline button and the kebab item open a popover with this
   * content (for the kebab — at its button), `onSelect` is not called.
   */
  panel?: (ctx: TCtx, controls: ActionPanelControls) => ReactNode
  /**
   * Loads the `panel` content (lazy modules): the popover opens after it, and loading starts
   * already on hover and focus of the button.
   */
  preload?: (ctx: TCtx) => Promise<unknown>
}

/** Controls of the popover of an action with a panel. */
export interface ActionPanelControls {
  close: () => void
  /** Element that gets focus on open; without it — the first focusable one. */
  initialFocusRef: RefObject<HTMLElement | null>
}

/**
 * Cell selection summary for the context menu (ADR 0030). Lets an item gate itself on single
 * or multiple selection without a "menu A vs B" branch.
 */
export interface CellSelectionSummary {
  /** How many cells are selected. */
  count: number
  /** Exactly one cell is selected. */
  isSingle: boolean
  /** More than one cell is selected. */
  isMultiple: boolean
  /** The cell under the pointer is part of the selection. */
  isInSelection: boolean
}

/** Context of a context-menu item: the context of the cell under the pointer + the selection summary. */
export interface ContextMenuContext extends CellComponentProps {
  /** Summary of the current cell selection (empty when cellSelection isn't used). */
  selection: CellSelectionSummary
}

/** A context-menu action (ADR 0030): a menu descriptor without a slot or inline presentation. */
export type ContextMenuAction = MenuAction<ContextMenuContext>

/** An action in a column HEADER slot. */
export type HeaderAction = SlotAction<HeaderComponentProps, HeaderActionSlot>

/** An action in a ROW actions slot. */
export type RowAction = SlotAction<CellComponentProps, 'actionRowSlot'>

/**
 * A resolved kebab-menu item (the result of `SlotAction.menuItems`): fields are already
 * computed for `ctx`/`labels`.
 */
export interface HeaderMenuItem {
  /** Unique item id within the subgroup. */
  id: string
  /** Item text and `aria-label`. */
  label: string
  /** Item icon. */
  icon?: ReactNode
  /** Item selection handler. */
  onSelect: () => void
  /** Whether the item is disabled. */
  disabled?: boolean
  /** Whether the item is checked (a check mark). */
  active?: boolean
  /** Section items: the item opens them instead of running (ADR 0186, §5). */
  items?: HeaderMenuItem[]
}

/** Свёрнутый по всем слотам набор действий (аналог `RenderSlots`). */
export type SlotActions = Record<SlotName, SlotAction[]>

/** Конфиг схлопывания ОДНОГО слота в кебаб-меню (разрешённый, per-slot). */
export interface SlotMenuConfig {
  /** `auto` — by threshold; `always` — always, ignoring the count. */
  mode: 'auto' | 'always'
  /** Collapse threshold for `auto`. */
  threshold: number
}

/** Карта конфигов меню по слотам (ключ = слот; отсутствие = кебаб выключен). */
export type SlotActionMenu = Partial<Record<SlotName, SlotMenuConfig>>

/** A menu plugin's declaration in a registry entry: which slots get the kebab menu. */
export interface ActionMenuDeclaration extends SlotMenuConfig {
  slots: SlotName[]
}
