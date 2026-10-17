/**
 * Кнопка «Экспорт» в тулбаре (ADR 0044, EX1, EX6, EX28). Одна доступная комбинация —
 * клик выгружает сразу; иначе открывает панель настроек (лениво). Пока серверный
 * `onExport` или асинхронный формат (XL7) в ожидании, кнопка `aria-busy` с бликом,
 * серверная выгрузка заблокирована; отказ формата — вспышка. До прихода данных
 * клиентская выгрузка — скелет кнопки, серверная доступна (ADR 0122).
 */
import { Suspense, useRef, useState } from 'react'

import type { ToolbarComponentProps } from '../../core/createSlots'
import { useLazyPopover } from '../../core/lazyOpening'
import { useLocalization } from '../../core/localization'
import { preloadable } from '../../core/preloadable'
import { useTableState } from '../../core/reactivity'
import { isSkeletonShown } from '../../core/skeletonOptions'
import { hasVisibleDataColumns } from '../../core/stubs'
import { useIcons } from '../../ui/icons'
import { ToolbarButton, ToolbarSkeleton } from '../../ui/ToolbarButton'
import { runExport } from '../dataExportModel/runExport'
import {
  axesBeforeData,
  resolveAxes,
  resolveSettings,
  singleSettings,
  whereOf,
} from '../dataExportModel/settings'
import type { ExportSettings } from '../dataExportModel/types'

const ExportPanel = preloadable(() =>
  import('./ExportPanel').then(module => module.ExportPanel),
)

export const ExportButton = ({ table }: ToolbarComponentProps) => {
  const labels = useLocalization()
  const { download: DownloadIcon } = useIcons()
  // Серверная выгрузка не блокирует кнопку (можно выгрузить страницу), клиентская — блокирует.
  const [busy, setBusy] = useState<false | 'server' | 'client'>(false)
  // Отказ асинхронного формата (XL7) — вспышка контура кнопки (ADR 0055).
  const [failures, setFailures] = useState(0)
  // Ref, а не state: два клика подряд до перерисовки не должны запустить вторую выгрузку.
  const running = useRef<false | 'server' | 'client'>(false)

  // Выбор строк меняет доступность значений оси «Строки».
  useTableState(table, state => state.rowSelection)
  useTableState(table, state => state.columnVisibility)
  const resolved = resolveAxes(table)
  const beforeData = isSkeletonShown(table)
  const axes =
    resolved && beforeData ? axesBeforeData(table, resolved) : resolved
  const single = axes && singleSettings(axes)
  // Панель нужна, только когда комбинаций больше одной: иначе модуль не грузится.
  const popover = useLazyPopover(
    table,
    ExportPanel,
    all => all.export,
    !!axes && !single,
  )

  const start = (settings: ExportSettings, isServer: boolean) => {
    // Идущая клиентская выгрузка блокирует любую; серверная — только серверную.
    if (running.current === 'client' || (isServer && running.current)) return
    const pending = runExport(table, settings)
    if (pending) {
      running.current = isServer ? 'server' : 'client'
      setBusy(isServer ? 'server' : 'client')
      pending
        .catch(() => setFailures(count => count + 1))
        .finally(() => {
          running.current = false
          setBusy(false)
        })
    }
  }

  if (!axes) return null
  // До данных выгружать нечего, кроме серверной выгрузки (ADR 0122, TF5).
  if (beforeData && !resolveSettings(axes)) {
    return <ToolbarSkeleton data-testid="export-skeleton" />
  }

  const icon = <DownloadIcon width={16} height={16} />
  // Без видимых колонок выгружать нечего (ADR 0123, ES10).
  if (!hasVisibleDataColumns(table)) {
    return (
      <ToolbarButton
        label={labels.export}
        icon={icon}
        disabled
        data-testid="export-button"
      />
    )
  }
  if (single) {
    const isServer = whereOf(table, single) === 'server'
    return (
      <ToolbarButton
        label={labels.export}
        icon={icon}
        disabled={busy && isServer}
        pending={busy === 'client'}
        errorFlash={failures}
        aria-busy={!!busy || undefined}
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
        busy={!!busy}
        pending={busy === 'client'}
        failures={failures}
        open={popover.open}
        onOpenChange={popover.onOpenChange}
        onRun={start}
      />
    </Suspense>
  )
}
