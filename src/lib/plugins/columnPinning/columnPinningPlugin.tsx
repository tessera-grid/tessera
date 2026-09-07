import { devWarn } from '../../core/devWarn'
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
        if (originalGetCanPin()) {
          devWarn(
            'columnPinning:multi-level-header',
            'columnPinning: закрепление столбцов не работает при многоуровневой шапке (getHeaderGroups().length > 1) и отключено. См. ADR 0022.',
          )
        }
        return false
      }

      return originalGetCanPin()
    }
  },
}
