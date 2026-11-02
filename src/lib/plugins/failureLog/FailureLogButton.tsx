/**
 * Кнопка журнала отказов в тулбаре (ADR 0177, JR1): видна, только пока в реестре есть записи,
 * красный бабл — их число. Поповер — ленивый модуль (ADR 0061).
 */
import { Suspense } from 'react'

import type { ToolbarComponentProps } from '../../core/createSlots'
import { useLazyPopover } from '../../core/lazyOpening'
import { useLocalization } from '../../core/localization'
import { preloadable } from '../../core/preloadable'
import { useSliceProjection } from '../../core/reactivity'
import { useIcons } from '../../ui/icons'
import { ToolbarButton } from '../../ui/ToolbarButton'

const FailureLogPopover = preloadable(() =>
  import('./FailureLogPopover').then(module => module.FailureLogPopover),
)

/** Кнопка с поповером; размонтируется вместе с последней записью — поповер закрыт заново. */
const FailureLogControl = ({
  table,
  count,
}: ToolbarComponentProps & { count: number }) => {
  const labels = useLocalization()
  const { failureLog: FailureLogIcon } = useIcons()
  const popover = useLazyPopover(
    table,
    FailureLogPopover,
    all => all.failureLog,
    true,
    { plugin: 'failureLog' },
  )
  const label = labels.failureLogButton(count)
  const icon = <FailureLogIcon width={16} height={16} />
  const placeholder = (
    <ToolbarButton
      label={label}
      icon={icon}
      active
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

export const FailureLogButton = ({ table }: ToolbarComponentProps) => {
  const count = useSliceProjection(
    table,
    'failures',
    (failures: Record<string, unknown> | undefined) =>
      Object.keys(failures ?? {}).length,
  )
  return count === 0 ? null : <FailureLogControl table={table} count={count} />
}
