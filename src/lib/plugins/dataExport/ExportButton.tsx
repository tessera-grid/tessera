/**
 * Кнопка «Экспорт» в тулбаре (ADR 0044, EX1, EX6, EX28). Одна доступная комбинация —
 * клик выгружает сразу; иначе открывает панель настроек (лениво). Пока серверный
 * `onExport` в ожидании, кнопка `aria-busy`, серверная выгрузка заблокирована.
 */
import { Suspense, useRef, useState } from 'react'

import type { ToolbarComponentProps } from '../../core/createSlots'
import { useLazyPopover } from '../../core/lazyOpening'
import { useLocalization } from '../../core/localization'
import { preloadable } from '../../core/preloadable'
import { useTableState } from '../../core/reactivity'
import { useIcons } from '../../ui/icons'
import { ToolbarButton } from '../../ui/ToolbarButton'
import { runExport } from './runExport'
import { resolveAxes, singleSettings, whereOf } from './settings'
import type { ExportSettings } from './types'

const ExportPanel = preloadable(() =>
  import('./ExportPanel').then(module => module.ExportPanel),
)

export const ExportButton = ({ table }: ToolbarComponentProps) => {
  const labels = useLocalization()
  const { download: DownloadIcon } = useIcons()
  const [busy, setBusy] = useState(false)
  // Ref, а не state: два клика подряд до перерисовки не должны запустить вторую выгрузку.
  const running = useRef(false)

  // Выбор строк меняет доступность значений оси «Строки».
  useTableState(table, state => state.rowSelection)
  const axes = resolveAxes(table)
  const single = axes && singleSettings(axes)
  // Панель нужна, только когда комбинаций больше одной: иначе модуль не грузится.
  const popover = useLazyPopover(
    table,
    ExportPanel,
    all => all.export,
    !!axes && !single,
  )

  const start = (settings: ExportSettings, isServer: boolean) => {
    if (isServer && running.current) return
    const pending = runExport(table, settings)
    if (pending) {
      running.current = true
      setBusy(true)
      void pending.finally(() => {
        running.current = false
        setBusy(false)
      })
    }
  }

  if (!axes) return null

  const icon = <DownloadIcon width={18} height={18} />
  if (single) {
    const isServer = whereOf(table, single) === 'server'
    return (
      <ToolbarButton
        label={labels.export}
        icon={icon}
        disabled={busy && isServer}
        aria-busy={busy || undefined}
        data-testid="export-button"
        onClick={() => start(single, isServer)}
      />
    )
  }

  const placeholder = (
    <ToolbarButton
      label={labels.export}
      icon={icon}
      aria-haspopup="dialog"
      data-testid="export-button"
      {...popover.trigger}
    />
  )
  if (!popover.ready) return placeholder

  return (
    <Suspense fallback={placeholder}>
      <ExportPanel.Component
        table={table}
        axes={axes}
        busy={busy}
        open={popover.open}
        onOpenChange={popover.onOpenChange}
        onRun={start}
      />
    </Suspense>
  )
}
