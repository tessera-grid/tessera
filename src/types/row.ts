export interface RowSDK {
  getIsLastSubRow: () => boolean
  getCanDrag: () => boolean
  getIsFirstRow: () => boolean
  getIsLastRow: () => boolean
}

export interface RowSelectionInstanceSDK {
  /**
   * Кастомный метод, который определяет, можно ли выбрать хотя бы одну строку
   */
  getCanSomeRowsSelect: () => boolean
}
