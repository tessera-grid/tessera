// Демо-контент нижней панели для историй и тестов (ADR 0038): по слоту на каждой
// стороне и два слота справа — видны стороны и порядок.
import type { TesseraFeatureEntry } from '../../lib/core/features'

export const statusBarDemoPlugins: TesseraFeatureEntry[] = [
  {
    id: 'statusBarDemoInfo',
    slots: [
      {
        id: 'statusBarDemoRows',
        slot: 'statusBarSlot',
        component: () => (
          <span data-testid="status-bar-demo-rows">Demo: rows info</span>
        ),
      },
    ],
  },
  {
    id: 'statusBarDemoPosition',
    slots: [
      {
        id: 'statusBarDemoLast',
        slot: 'statusBarSlot',
        align: 'end',
        order: 10,
        component: () => (
          <span data-testid="status-bar-demo-last">Demo: last</span>
        ),
      },
      {
        id: 'statusBarDemoFirst',
        slot: 'statusBarSlot',
        align: 'end',
        order: 0,
        component: () => (
          <span data-testid="status-bar-demo-first">Demo: first</span>
        ),
      },
    ],
  },
]
