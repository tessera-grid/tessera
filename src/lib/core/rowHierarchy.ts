/**
 * Иерархия строк (ADR 0168, §4; ADR 0170, §2): модель дерева выставляет факт `treeRows`,
 * модель группировки — `groupRows`; читают его ядро, плагины и грид, которым важно, что строки —
 * не плоский список. Факт — опция, а не объявление в `setup`: роль `treegrid` нужна в первом кадре.
 */
export type RowHierarchy = 'tree' | 'groups'

interface HierarchyOptions {
  treeRows?: boolean
  groupRows?: boolean
}

export const hasRowHierarchy = (table: unknown, kind: RowHierarchy) => {
  const options = (table as { options?: HierarchyOptions }).options
  return (kind === 'tree' ? options?.treeRows : options?.groupRows) === true
}
