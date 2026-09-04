import { TablePlugin } from '../types'

/**
 * Расширение для возможности закрепления столбцов
 * Предполагается, что пользователь может закреплять столбцы только к левому краю таблицы
 *
 * Кнопка закрепления объявлена декларативно в записи реестра (`registry.ts`);
 * здесь фича лишь ограничивает закрепление одноуровневой шапкой.
 */
export const columnPinningPlugin: TablePlugin = {
  createColumn: (_staticColumn, table) => {
    const originalGetCanPin = _staticColumn.getCanPin

    _staticColumn.getCanPin = () => {
      if (table.getHeaderGroups().length !== 1) {
        return false
      }

      return originalGetCanPin()
    }
  },
}
