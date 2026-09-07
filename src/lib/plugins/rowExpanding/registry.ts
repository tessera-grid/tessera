import { PluginOptions, RegistryEntry, ServiceColumn } from '../types'
import {
  COLUMN_EXPANDING_ID,
  getRowExpandingColumn,
} from './rowExpandingColumn'
import {
  DEFAULT_MAX_EXPANDING_DEPTH,
  rowExpandingPlugin,
} from './rowExpandingPlugin'
import type { RowExpandingPlugin } from './types'

export interface RowExpandingOptions extends PluginOptions {
  /**
   * Сколько уровней дерева раскрываемы, считая от корня, — это **число уровней**,
   * а не индекс глубины: строка раскрываема, пока `row.depth < maxDepth`. По
   * умолчанию `DEFAULT_MAX_EXPANDING_DEPTH` (1) — тоггл только у корней (depth 0);
   * их дети (depth 1) видны, но глубже не раскрываются. Для дерева глубже подними
   * значение: `maxDepth: 2` → раскрываемы depth 0 и 1.
   */
  maxDepth?: number
}

export const rowExpanding = (
  opts: RowExpandingOptions = {},
): RegistryEntry<RowExpandingPlugin> => ({
  id: 'rowExpanding',
  enabled: opts.enabled,
  // Фича вешает renderComponent на ячейку сервисной колонки (кнопка раскрытия) и
  // оборачивает row.getCanExpand. Сервисная колонка сама рендерера не несёт,
  // поэтому держим фичу в _features всегда: иначе при live-включении колонка
  // раскрытия появляется пустой (createCell не отработал на маунте). Пока опция
  // выключена, сервисной колонки нет и обёртка getCanExpand инертна.
  keepFeatureWhenDisabled: true,
  feature: rowExpandingPlugin,
  column: {
    id: COLUMN_EXPANDING_ID,
    make: getRowExpandingColumn as ServiceColumn['make'],
    side: 'leading',
    order: 2,
    pin: { side: 'left', when: 'with-user' },
  },
  options: {
    enableRowExpanding: true,
    autoResetExpanded: false,
    maxExpandingDepth: opts.maxDepth ?? DEFAULT_MAX_EXPANDING_DEPTH,
  },
})
