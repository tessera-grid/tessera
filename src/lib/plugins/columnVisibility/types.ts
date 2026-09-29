export interface ColumnVisibilityHooks {
  /**
   * Пользователь показал или скрыл колонки из меню. Для группы и «Показать все» —
   * один вызов со всеми затронутыми листьями.
   */
  onToggleColumnVisibility: (columnIds: string[], visible: boolean) => void
}
