export interface ColumnVisibilityHooks {
  /**
   * The user showed or hid columns from the menu. For a group and "Show all" — one call with all
   * affected leaves.
   */
  onToggleColumnVisibility: (columnIds: string[], visible: boolean) => void
}
