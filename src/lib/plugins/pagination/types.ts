export interface PaginationHooks {
  /**
   * Пользователь сменил страницу или её размер (кнопка, выбор размера). Смена
   * размера возвращает на первую страницу: `(0, newSize)`.
   */
  onPageChange: (pageIndex: number, pageSize: number) => void
}
