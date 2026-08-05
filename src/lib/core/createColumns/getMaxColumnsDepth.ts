import { ColumnDef } from '@tanstack/react-table'

export function getMaxColumnsDepth(columns: ColumnDef<any, any>[]) {
  if (!columns || columns.length === 0) return 0

  let maxDepth = 0
  // Кладем в стек элементы в формате: [массив_колонок, текущая_глубина]
  const stack: [ColumnDef<any, any>[], number][] = [[columns, 1]]

  while (stack.length > 0) {
    const item = stack.pop()

    if (!item) {
      // eslint-disable-next-line no-continue
      continue
    }

    const [currentColumns, currentDepth] = item

    // Обновляем глобальный максимум, если нашли уровень глубже
    maxDepth = Math.max(maxDepth, currentDepth)

    // eslint-disable-next-line no-restricted-syntax
    for (const col of currentColumns) {
      if (
        'columns' in col &&
        Array.isArray(col.columns) &&
        col.columns.length > 0
      ) {
        // Заталкиваем дочерний массив в стек, увеличивая счетчик глубины
        stack.push([col.columns, currentDepth + 1])
      }
    }
  }

  return maxDepth
}
