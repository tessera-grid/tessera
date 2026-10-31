export const COLUMN_ACTIONS_PREFIX = 'actionColumn'

/** Кнопка грида темы по умолчанию — `--tsr-comp-grid-button-size` (ADR 0135). */
export const ACTION_BUTTON_DEFAULT_SIZE = 28

export const GRID_BUTTON_SIZE_VAR = '--tsr-comp-grid-button-size'

export const ACTION_COLUMN_CONTENT_PADDING = 4

/** Ширина колонки контрола при теме по умолчанию; свою тему грид замеряет. */
export const COLUMN_ACTIONS_SIZE =
  ACTION_BUTTON_DEFAULT_SIZE + ACTION_COLUMN_CONTENT_PADDING * 2

/** Ширина колонки контрола по размеру кнопки грида из темы. */
export const controlColumnSize = (buttonSize: number) =>
  buttonSize + ACTION_COLUMN_CONTENT_PADDING * 2

/**
 * Функция получение идентификатора для колонки действий.
 * Колонка действий не подчиняется поведению и стилизации, нежели пользовательские колонки.
 */
export const getActionColumnId = (columnId: string) =>
  `${COLUMN_ACTIONS_PREFIX}__${columnId}`
