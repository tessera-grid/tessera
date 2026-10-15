// Демо-плагин автора (ADR 0060, SL21): число строк в нижней панели — скелетом, пока идёт
// первая загрузка; кнопка от данных не зависит и не меняется.
// Импорт — из публичных входов пакета, как у автора плагина.
import { definePlugin, isSkeletonShown } from '../../index'
import { Skeleton } from '../../ui'

export const rowsInfoDemo = definePlugin()({
  id: 'rowsInfoDemo',
  slots: [
    {
      id: 'rowsInfoDemo',
      slot: 'statusBarSlot',
      component: ({ table }) => (
        <span
          data-testid="rows-info"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          {isSkeletonShown(table) ? (
            <Skeleton
              width={64}
              height="var(--tsr-comp-skeleton-text-height)"
            />
          ) : (
            `Rows: ${table.getRowModel().rows.length}`
          )}
          <button type="button">Reload</button>
        </span>
      ),
    },
  ],
})
