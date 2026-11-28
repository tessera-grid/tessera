export const COLUMN_ACTIONS_PREFIX = 'actionColumn'

/** Кнопка грида темы по умолчанию — `--tsr-comp-grid-button-size` (ADR 0135). */
export const ACTION_BUTTON_DEFAULT_SIZE = 28

export const GRID_BUTTON_SIZE_VAR = '--tsr-comp-grid-button-size'

export const ACTION_COLUMN_CONTENT_PADDING = 4

/** Width of a control column with the default theme; the grid measures a custom theme. */
export const COLUMN_ACTIONS_SIZE =
  ACTION_BUTTON_DEFAULT_SIZE + ACTION_COLUMN_CONTENT_PADDING * 2

/** Ширина колонки контрола по размеру кнопки грида из темы. */
export const controlColumnSize = (buttonSize: number) =>
  buttonSize + ACTION_COLUMN_CONTENT_PADDING * 2

/**
 * Returns the id of the actions column.
 * The actions column doesn't follow the behavior and styling of user columns.
 */
export const getActionColumnId = (columnId: string) =>
  `${COLUMN_ACTIONS_PREFIX}__${columnId}`
