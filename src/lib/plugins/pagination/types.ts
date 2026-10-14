import type {
  ServerActionContext,
  ServerActionResult,
} from '../../core/serverActions'

export interface PaginationHooks {
  /**
   * Пользователь сменил страницу или её размер (кнопка, выбор размера). Смена
   * размера возвращает на первую страницу: `(0, newSize)`. В серверном режиме промис —
   * запрос страницы: грид ждёт, отказ возвращает прежнюю страницу (ADR 0116).
   */
  onPageChange: (
    pageIndex: number,
    pageSize: number,
    context: ServerActionContext,
  ) => ServerActionResult
}
