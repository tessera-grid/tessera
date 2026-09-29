// Демо-кнопки тулбара для историй и тестов (ADR 0035): две подгруппы, чтобы были
// видны разделитель и порядок. Действия — no-op.
import { Download, Rows3, SlidersHorizontal } from 'lucide-react'

import type { TesseraFeatureEntry } from '../../lib/core/features'
import { ToolbarButton } from '../../lib/ui/ToolbarButton'

const ICON_SIZE = 18

export const toolbarDemoPlugins: TesseraFeatureEntry[] = [
  {
    id: 'toolbarDemoView',
    slots: [
      {
        id: 'toolbarDemoDensity',
        slot: 'toolbarSlot',
        group: 'view',
        order: 0,
        component: () => (
          <ToolbarButton
            label="Density"
            icon={<Rows3 size={ICON_SIZE} />}
            data-testid="toolbar-demo-density"
          />
        ),
      },
      {
        id: 'toolbarDemoSettings',
        slot: 'toolbarSlot',
        group: 'view',
        order: 1,
        component: () => (
          <ToolbarButton
            label="Settings"
            icon={<SlidersHorizontal size={ICON_SIZE} />}
            active
            data-testid="toolbar-demo-settings"
          />
        ),
      },
    ],
  },
  {
    id: 'toolbarDemoData',
    slots: [
      {
        id: 'toolbarDemoExport',
        slot: 'toolbarSlot',
        group: 'data',
        order: 10,
        component: () => (
          <ToolbarButton
            label="Export"
            icon={<Download size={ICON_SIZE} />}
            disabled
            data-testid="toolbar-demo-export"
          />
        ),
      },
    ],
  },
]
