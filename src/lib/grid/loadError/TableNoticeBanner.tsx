/**
 * Итог действия всей таблицы (ADR 0227, §1): плашка на месте плашки отказа — из записи
 * `notice` среза `actionStatus`. Плашка отказа, ожидания и вопрос на том же месте главнее.
 */
import clsx from 'clsx'

import {
  pendingTableAction,
  tableNotice,
} from '../../core/headerActions/actionStatus'
import {
  type ActionStatus,
  closeTableNotice,
} from '../../core/headerActions/actionStatusFeature'
import { useLocalization } from '../../core/localization'
import { useTableState } from '../../core/reactivity'
import type { ServerActionStatus } from '../../core/serverActions'
import { Alert } from '../../ui/Alert'
import { Button } from '../../ui/Button'
import { useIcons } from '../../ui/icons'

import styles from './LoadError.module.css'

interface NoticeSlices {
  serverAction?: ServerActionStatus
  actionStatus?: ActionStatus
}

interface TableNoticeBannerProps {
  table: unknown
  /** Плашка отказа на том же месте — главнее. */
  blocked: boolean
  /** Плашку закрыли крестиком — фокус в тело грида. */
  onDismissed: () => void
}

export const TableNoticeBanner = ({
  table,
  blocked,
  onDismissed,
}: TableNoticeBannerProps) => {
  const labels = useLocalization()
  const { loadFailed: FailedIcon } = useIcons()
  const { shown: current, busy } = useTableState(table as never, state => {
    const { serverAction, actionStatus } = state as NoticeSlices
    return {
      shown: tableNotice(actionStatus),
      // Ожидание и вопрос перед вставкой — на том же месте (ADR 0153, §5; ADR 0219, WR3).
      busy:
        !!serverAction?.pending ||
        !!serverAction?.loadingRows ||
        !!pendingTableAction(actionStatus),
    }
  })
  const notice = current?.notice
  const close = () => {
    if (!current) return
    if (notice?.onClose) notice.onClose()
    else closeTableNotice(table, current.key, notice)
  }
  const action = notice?.action
  return (
    <Alert
      shown={!!notice && !blocked && !busy}
      className={clsx('data-grid__table-notice', styles.banner)}
      tone={notice?.tone}
      // У тона — своя иконка кита; без тона итог — отказ.
      icon={
        notice?.tone ? undefined : (
          <FailedIcon data-icon="loadFailed" width={16} height={16} />
        )
      }
      title={notice?.title(labels) ?? ''}
      description={notice?.description?.(labels)}
      action={
        action && (
          <Button onClick={action.run} data-testid="table-notice-action">
            {action.label(labels)}
          </Button>
        )
      }
      dismiss={{
        label: labels.loadErrorDismiss,
        onClick: () => {
          close()
          onDismissed()
        },
      }}
      hideAfter={notice?.hideAfter}
      onHide={close}
      data-testid="table-notice"
    />
  )
}
