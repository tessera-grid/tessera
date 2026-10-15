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
import { Tooltip } from '../../ui/Tooltip'

import styles from './FilterPanel.module.css'

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
    <Tooltip title={reason}>
      <span
        className={styles.failure}
        role="img"
        aria-label={reason}
        tabIndex={0}
        data-testid="filter-failure"
      >
        <FailedIcon width={16} height={16} aria-hidden="true" />
      </span>
    </Tooltip>
  )
  return footer ? <div className={styles.footer}>{mark}</div> : mark
}
