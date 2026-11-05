/**
 * Отказ серверного фильтра колонки (ADR 0116, §5, SA18): иконка ошибки с тултипом причины
 * внизу панели фильтра, рядом с кнопкой сброса. Пока ждёт повтор или новая правка — нет.
 */
import { useLocalization } from '../../core/localization'
import {
  serverActionReason,
  useServerActionMarks,
} from '../../core/serverActions'
import { useIcons } from '../../ui/icons'
import { PopupFooter } from '../../ui/Popup/PopupPanel'
import { StatusIcon } from '../../ui/StatusIcon/StatusIcon'

export const FilterFailure = ({
  table,
  columnId,
  footer = false,
}: {
  table: unknown
  columnId: string
  /** У панели без подвала (булево) — своим подвалом. */
  footer?: boolean
}) => {
  const labels = useLocalization()
  const { actionFailed: FailedIcon } = useIcons()
  const { failure, pending } = useServerActionMarks(
    table,
    cause =>
      cause.control === 'columnFiltering' &&
      !!cause.columns?.includes(columnId),
  )
  if (!failure || pending) {
    return null
  }
  const reason = serverActionReason(failure, labels)
  const mark = (
    <StatusIcon
      reason={reason}
      icon={<FailedIcon width={16} height={16} aria-hidden="true" />}
      data-testid="filter-failure"
    />
  )
  return footer ? <PopupFooter>{mark}</PopupFooter> : mark
}
