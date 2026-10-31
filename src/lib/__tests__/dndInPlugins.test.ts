/**
 * Перетаскивание в плагинах (ADR 0168): dnd-kit и логика — в `rowDragging` и
 * `columnDragging`, общее — в `shared/`, грид и ядро их не импортируют.
 * Запуск: npx vitest run --config vitest.node.config.ts dndInPlugins
 */
import { describe, expect, it } from 'vitest'

import { LAYER_EDGES } from './architecture.baseline'
import { edgeKey, edges, modules, sourceOf } from './importGraph'

const DRAG_PLUGINS = ['rowDragging', 'columnDragging']

/** Импорт dnd-kit: `from '…'`, голый `import '…'` и `import('…')`. */
const DND_KIT_IMPORT = /(?:\bfrom|\bimport)\s*\(?\s*'@dnd-kit\//

describe('перетаскивание в плагинах (ADR 0168)', () => {
  it('DM1: грид и ядро не импортируют @dnd-kit/*, rowDragging и columnDragging; плагины перетаскивания не импортируют грид; в базе LB1 таких рёбер нет', () => {
    expect(
      modules()
        .filter(module => module.layer === 'grid' || module.layer === 'core')
        .filter(module => DND_KIT_IMPORT.test(sourceOf(module.path)))
        .map(module => module.path),
    ).toEqual([])
    expect(
      edges()
        .filter(
          ({ from, to }) =>
            (from.layer === 'grid' || from.layer === 'core') &&
            DRAG_PLUGINS.includes(to.plugin ?? ''),
        )
        .map(edgeKey),
    ).toEqual([])
    expect(
      edges()
        .filter(
          ({ from, to }) =>
            DRAG_PLUGINS.includes(from.plugin ?? '') && to.layer === 'grid',
        )
        .map(edgeKey),
    ).toEqual([])
    expect(
      Object.keys(LAYER_EDGES).filter(edge =>
        /rowDragging|columnDragging|grid\/dnd\/|handleMenu/.test(edge),
      ),
    ).toEqual([])
  })

  it('DM3: сенсоры и доступность dnd-kit, ручка и её контекст — в shared/dnd, меню ручки — в shared/handleMenu, хуки меню — в ui/; columnSizing берёт меню ручки из shared/; в гриде папок dnd и handleMenu нет', () => {
    const paths = new Set(modules().map(module => module.path))
    expect(
      [
        'lib/shared/dnd/parameters.ts',
        'lib/shared/dnd/DragHandler.tsx',
        'lib/shared/dnd/ItemSortableContext.tsx',
        'lib/shared/handleMenu/HandleMenu.tsx',
        'lib/shared/handleMenu/HandleMenuPopup.tsx',
        'lib/ui/Popup/useCloseOnGridScroll.ts',
        'lib/ui/Popup/useMenuLeave.ts',
      ].filter(path => !paths.has(path)),
    ).toEqual([])
    expect(
      [...paths].filter(path => /^lib\/grid\/(dnd|handleMenu)\//.test(path)),
    ).toEqual([])
    expect(
      edges()
        .filter(
          ({ from }) =>
            from.path === 'lib/plugins/columnSizing/ResizeHandler.tsx',
        )
        .map(({ to }) => to.path)
        .filter(path => path.includes('handleMenu')),
    ).toEqual(['lib/shared/handleMenu/HandleMenu.tsx'])
  })
})
