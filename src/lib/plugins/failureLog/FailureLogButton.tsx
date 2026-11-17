/**
 * Кнопка журнала отказов в тулбаре (ADR 0177, JR1): видна всегда, красный бабл — число записей
 * журнала (группа — одна запись, ADR 0227, AO6), без них бабла нет. Поповер — ленивый модуль
 * (ADR 0061); `table.showFailureLog()` открывает его через кнопку.
 */
import { useEffect } from 'react'

import type { ToolbarComponentProps } from '../../core/createSlots'
import type { Failures } from '../../core/failures/failuresFeature'
import { useLazyPopover } from '../../core/lazyOpening'
import { useLocalization } from '../../core/localization'
import { preloadable } from '../../util/preloadable'
import { useLatest } from '../../util/useLatest'
import { useSliceProjection } from '../../core/reactivity'
import { useIcons } from '../../ui/icons'
import { ToolbarButton } from '../../ui/ToolbarButton'
import { registerFailureLogOpener } from './failureLogFeature'
import { journalCount } from './journal'
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
    (failures: Failures | undefined) => journalCount(failures),
  )
  const popover = useLazyPopover(
    table,
    FailureLogPopover,
    all => failureLogLabels(all).failureLog,
    true,
    { plugin: 'failureLog' },
  )
  const open = useLatest(() => popover.onOpenChange(true))
  useEffect(
    () => registerFailureLogOpener(table, () => open.current()),
    [table, open],
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
    <FailureLogPopover.Component
      fallback={placeholder}
      table={table}
      label={label}
      icon={icon}
      count={count}
      open={popover.open}
      onOpenChange={popover.onOpenChange}
    />
  )
}
