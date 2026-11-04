/**
 * Кнопка журнала отказов в тулбаре (ADR 0177, JR1): видна всегда, красный бабл — число
 * нерешённых отказов, без них бабла нет. Поповер — ленивый модуль (ADR 0061).
 */
import { Suspense } from 'react'

import type { ToolbarComponentProps } from '../../core/createSlots'
import { useLazyPopover } from '../../core/lazyOpening'
import { useLocalization } from '../../core/localization'
import { preloadable } from '../../core/preloadable'
import { useSliceProjection } from '../../core/reactivity'
import { useIcons } from '../../ui/icons'
import { ToolbarButton } from '../../ui/ToolbarButton'
import { failureLogLabels } from './labels'

const FailureLogPopover = preloadable(() =>
  import('./FailureLogPopover').then(module => module.FailureLogPopover),
)

export const FailureLogButton = ({ table }: ToolbarComponentProps) => {
  const labels = useLocalization()
  const { failureLog: FailureLogIcon } = useIcons()
  const count = useSliceProjection(
    table,
    'failures',
    (failures: Record<string, unknown> | undefined) =>
      Object.keys(failures ?? {}).length,
  )
  const popover = useLazyPopover(
    table,
    FailureLogPopover,
    all => failureLogLabels(all).failureLog,
    true,
    { plugin: 'failureLog' },
  )
  const label =
    count > 0
      ? failureLogLabels(labels).failureLogButton(count)
      : failureLogLabels(labels).failureLog
  const icon = <FailureLogIcon width={16} height={16} />
  const placeholder = (
    <ToolbarButton
      label={label}
      icon={icon}
      active={count > 0}
      count={count}
      indicatorTone="error"
      aria-haspopup="dialog"
      data-testid="failure-log-button"
      {...popover.trigger}
    />
  )
  if (!popover.ready) return placeholder

  return (
    <Suspense fallback={placeholder}>
      <FailureLogPopover.Component
        table={table}
        label={label}
        icon={icon}
        count={count}
        open={popover.open}
        onOpenChange={popover.onOpenChange}
      />
    </Suspense>
  )
}
