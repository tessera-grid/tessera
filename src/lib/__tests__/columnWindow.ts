/**
 * Окно колонок из всех колонок: строки, шапка и футер грида рисуют ячейки только по окну
 * виртуализатора колонок (ADR 0207, §1) — модульным тестам без раскладки нужны все.
 */
export const allColumnsWindow = (columns: readonly unknown[], size = 100) =>
  columns.map((_, index) => ({
    key: index,
    index,
    start: index * size,
    end: (index + 1) * size,
    size,
    lane: 0,
  }))
