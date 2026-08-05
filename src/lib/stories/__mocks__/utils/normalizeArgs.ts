/**
 * Поведение объекта в аргументах сторибука ведет себя некорректно
 * При параметризации свойств объекта как number | string и изменения значения свойства объекта с числа на строку
 * Перезагрузка страницы истории приводит данное свойство к NaN
 */
export const normalizeArgs = (args: any) => {
  const skeletonOptions = args?.skeletonOptions

  if (skeletonOptions) {
    const columnsCount = Number.isNaN(skeletonOptions?.columnsCount)
      ? 'auto'
      : skeletonOptions?.columnsCount
    const rowsCount = Number.isNaN(skeletonOptions?.rowsCount)
      ? 'auto'
      : skeletonOptions?.rowsCount

    skeletonOptions.columnsCount = columnsCount
    skeletonOptions.rowsCount = rowsCount
  }

  return { ...args, skeletonOptions }
}
