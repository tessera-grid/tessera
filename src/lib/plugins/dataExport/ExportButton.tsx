/**
 * Кнопка «Экспорт» в тулбаре (ADR 0044, EX1, EX6, EX28). Одна доступная комбинация —
 * клик выгружает сразу; иначе открывает панель настроек (лениво). Пока серверный
 * `onExport` в ожидании, кнопка `aria-busy`, серверная выгрузка заблокирована.
 */
import { lazy, Suspense, useRef, useState } from 'react'

import type { ToolbarComponentProps } from '../../core/createSlots'
import { useLocalization } from '../../core/localization'
import { useTableState } from '../../core/reactivity'
import { useIcons } from '../../ui/icons'
import { ToolbarButton } from '../../ui/ToolbarButton'
import { runExport } from './runExport'
import { resolveAxes, singleSettings, whereOf } from './settings'
import type { ExportSettings } from './types'

const ExportPanel = lazy(() =>
  import('./ExportPanel').then(module => ({ default: module.ExportPanel })),
)

export const ExportButton = ({ table }: ToolbarComponentProps) => {
  const labels = useLocalization()
  const { download: DownloadIcon } = useIcons()
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  // Ref, а не state: два клика подряд до перерисовки не должны запустить вторую выгрузку.
  const running = useRef(false)

  // Выбор строк меняет доступность значений оси «Строки».
  useTableState(table, state => state.rowSelection)
  const axes = resolveAxes(table)

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
  const single = singleSettings(axes)
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

  return (
    <Suspense
      fallback={
        <ToolbarButton
          label={labels.export}
          icon={icon}
          aria-haspopup="dialog"
          aria-expanded={open}
          data-testid="export-button"
          onClick={() => setOpen(true)}
        />
      }
    >
      <ExportPanel
        table={table}
        axes={axes}
        busy={busy}
        open={open}
        onOpenChange={setOpen}
        onRun={start}
      />
    </Suspense>
  )
}
