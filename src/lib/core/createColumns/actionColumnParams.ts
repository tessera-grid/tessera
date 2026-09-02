export const COLUMN_ACTIONS_PREFIX = 'actionColumn'

// TODO: довольно самоуверенно полагать, что в колонке действий кнопки всегда будут рисоваться размером 32х32,
//  однако, это работает, и если в будущем этой колонке понадобится динамический автосайз, то это нужно будет убрать
export const ACTION_BUTTON_DEFAULT_SIZE = 32

export const ACTION_COLUMN_CONTENT_PADDING = 4

export const COLUMN_ACTIONS_SIZE =
  ACTION_BUTTON_DEFAULT_SIZE + ACTION_COLUMN_CONTENT_PADDING * 2

/**
 * Функция получение идентификатора для колонки действий.
 * Колонка действий не подчиняется поведению и стилизации, нежели пользовательские колонки.
 */
export const getActionColumnId = (columnId: string) =>
  `${COLUMN_ACTIONS_PREFIX}__${columnId}`

export const checkIsActionColumn = (columnId = '') =>
  columnId.includes(COLUMN_ACTIONS_PREFIX)

// Стабильный id колонки действий. Живёт в ядре (а не в плагине rowActions), т.к.
// его безусловно читают предикаты `getIsActionsColumn` в always-on commonPlugin
// (плагин не импортить в ядро — R1). Саму колонку/автосайз приносит плагин.
export const ROW_ACTIONS_COLUMN_ID = getActionColumnId('rowActions')
