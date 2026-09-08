import { logWarn } from '../../core/logger'
import { TablePlugin } from '../types'

/**
 * Расширение для возможности закрепления столбцов
 * Предполагается, что пользователь может закреплять столбцы только к левому краю таблицы
 *
 * Кнопка закрепления объявлена декларативно в записи реестра (`registry.ts`);
 * здесь фича задаёт гранулярность закрепления в зависимости от глубины шапки.
 *
 * - **Плоская шапка** — закрепляется любой закрепляемый столбец (штатно).
 * - **Вложенная шапка** — закрепляется только **группа верхнего уровня**
 *   (`depth === 0`) целиком; TanStack при `pin` группы закрепляет все её листья.
 *   Отдельный лист под группой закрепить нельзя (ADR 0011/0022), даже если у него
 *   `enablePinning` — так закреплённая зона совпадает с границами группы, а не
 *   рвёт спанящую шапку.
 */
export const columnPinningPlugin: TablePlugin = {
  createColumn: (_staticColumn, table) => {
    const originalGetCanPin = _staticColumn.getCanPin

    _staticColumn.getCanPin = () => {
      if (!originalGetCanPin()) {
        return false
      }

      // Плоская шапка — штатное поведение.
      if (table.getHeaderGroups().length === 1) {
        return true
      }

      // Режим reorder-out (opt-in `enableLeafPinning`, ADR 0011): под вложенной
      // шапкой закрепляется ЛЮБАЯ единица — отдельный лист, промежуточная или
      // верхняя группа. Закрепление всегда работает по листьям цели: они едут
      // влево сплошным блоком (см. ColumnPinningComponent), а спанящие шапки
      // родителей режутся на сегменты. Кнопка — на каждом закрепляемом заголовке.
      const enableLeafPinning = (
        table.options as { enableLeafPinning?: boolean } | undefined
      )?.enableLeafPinning
      if (enableLeafPinning) {
        return true
      }

      // Вложенная шапка: закрепляется только группа верхнего уровня целиком.
      if (_staticColumn.depth === 0) {
        return true
      }

      // Явная просьба закрепить лист под группой невозможна — сообщаем один раз
      // на столбец (ADR 0022). Дефолтный `enablePinning` (true) явной просьбой не
      // считаем, чтобы не спамить предупреждением по каждому листу.
      if (_staticColumn.columnDef.enablePinning === true) {
        logWarn(
          table,
          'columnPinning: под вложенной шапкой закрепляется только группа верхнего уровня; отдельный лист закрепить нельзя. См. ADR 0011/0022.',
          `columnPinning:leaf-under-nested-header:${_staticColumn.id}`,
        )
      }

      return false
    }
  },
}
