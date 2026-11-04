/**
 * Кнопка «Экспорт» в тулбаре (ADR 0044, EX1, EX6, EX28). Одна доступная комбинация —
 * клик выгружает сразу; иначе открывает панель настроек (лениво). Пока серверный
 * `onExport` или асинхронный формат (XL7) в ожидании, кнопка `aria-busy` с бликом,
 * серверная выгрузка заблокирована; отказ останавливает дугу, объявляется и пишется в реестр
 * отказов (ADR 0177, §2). До прихода данных
 * клиентская выгрузка — скелет кнопки, серверная доступна (ADR 0122).
 */
import { announceLabel } from '../../core/announcer'
import { cancelPending, cancelSourceOf } from '../../core/cancellation'
import { reportAction, sourceOf } from '../../core/debugActions'
import { Suspense, useRef, useState } from 'react'

import type { ToolbarComponentProps } from '../../core/createSlots'
import { useLazyPopover } from '../../core/lazyOpening'
import {
  failureKeyOf,
  reportFailure,
  resolveFailure,
} from '../../core/failures/failuresFeature'
import { useLocalization } from '../../core/localization'
import { preloadable } from '../../core/preloadable'
import { useTableState } from '../../core/reactivity'
import { rejectionText } from '../../util/thenable'
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
import { dataExportLabels } from './labels'

const ExportPanel = preloadable(() =>
  import('./ExportPanel').then(module => module.ExportPanel),
)

const EXPORT_PROCESS = { process: 'export' }

export const ExportButton = ({ table }: ToolbarComponentProps) => {
  const labels = useLocalization()
  const { download: DownloadIcon } = useIcons()
  // Серверная выгрузка не блокирует кнопку (можно выгрузить страницу), клиентская — блокирует.
  const [busy, setBusy] = useState<false | 'server' | 'client'>(false)
  // Отказ выгрузки (XL7): дуга останавливается, запись — в реестре отказов (ADR 0177, §2).
  const [failed, setFailed] = useState(false)
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
    all => dataExportLabels(all).export,
    !!axes && !single,
    { plugin: 'dataExport' },
  )

  const start = (settings: ExportSettings, isServer: boolean) => {
    // Идущая клиентская выгрузка блокирует любую; серверная — только серверную.
    if (running.current === 'client' || (isServer && running.current)) return
    const report = { plugin: 'dataExport', action: 'export' }
    const id = reportAction(table, {
      ...report,
      detail: { ...settings, server: isServer },
      source: sourceOf(globalThis.event),
    })
    const pending = runExport(table, settings, { ...report, cause: id })
    setFailed(false)
    resolveFailure(table, failureKeyOf(EXPORT_PROCESS))
    if (pending) {
      running.current = isServer ? 'server' : 'client'
      setBusy(isServer ? 'server' : 'client')
      pending
        .catch((error: unknown) => {
          const reason = rejectionText(error) ?? labels.actionFailedFallback
          setFailed(true)
          reportFailure(table, {
            action: { plugin: 'dataExport', action: 'export' },
            target: EXPORT_PROCESS,
            reason,
            retry: () => start(settings, isServer),
          })
          // Отметки на кнопке нет — отказ слышен объявлением (ADR 0177, OB2).
          announceLabel(table, all =>
            all.announceActionFailed(dataExportLabels(all).export, reason),
          )
        })
        .finally(() => {
          running.current = false
          setBusy(false)
        })
    }
  }

  // «Стоп» занятой кнопки (ADR 0153, §2): отменяет идущую выгрузку.
  const cancel = busy
    ? {
        onCancel: (event: unknown) =>
          cancelPending(table, { kind: 'export' }, cancelSourceOf(event)),
        cancelLabel: labels.cancelAction(dataExportLabels(labels).export),
      }
    : undefined

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
        label={dataExportLabels(labels).export}
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
        label={dataExportLabels(labels).export}
        icon={icon}
        pending={busy === 'client'}
        failed={failed}
        aria-busy={!!busy || undefined}
        {...cancel}
        data-testid="export-button"
        onClick={() => start(single, isServer)}
      />
    )
  }

  const placeholder = (
    <ToolbarButton
      label={dataExportLabels(labels).export}
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
        failed={failed}
        open={popover.open}
        onOpenChange={popover.onOpenChange}
        onRun={start}
        cancel={cancel}
      />
    </Suspense>
  )
}
