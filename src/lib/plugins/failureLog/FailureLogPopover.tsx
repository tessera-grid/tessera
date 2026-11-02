/**
 * Поповер журнала отказов (ADR 0177, §7; JR2–JR3): записи реестра отказов — новые сверху,
 * подпись действия, цель, причина и время; «Показать», «Повторить», «Закрыть». Отдельный чанк:
 * открытием управляет эагерная кнопка (`FailureLogButton`).
 */
import { type ReactNode, useRef } from 'react'

import { Popover } from '@base-ui/react/popover'
import clsx from 'clsx'

import {
  type Failure,
  type Failures,
  resolveFailure,
} from '../../core/failures/failuresFeature'
import { reportAction, userSourceOf } from '../../core/debugActions'
import { useLocalization } from '../../core/localization'
import { useSliceProjection } from '../../core/reactivity'
import { Button } from '../../ui/Button'
import { POPUP_SIDE_OFFSET } from '../../ui/Popup/offset'
import { usePortalThemeClass, usePortalThemeData } from '../../ui/theme'
import { ToolbarButton } from '../../ui/ToolbarButton'
import { useVirtualizer } from '../../../vendor/tanstack-virtual/react-virtual'
import { canShowFailure, failureTargetText, showFailure } from './failureTarget'

import styles from './FailureLog.module.css'

const ENTRY_ESTIMATE = 96
const OVERSCAN = 4
const EMPTY: Failures = {}

export interface FailureLogPopoverProps {
  table: unknown
  label: string
  icon: ReactNode
  count: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Действие записи — в канал действий (ADR 0125). */
const report = (
  table: unknown,
  action: 'show' | 'retry' | 'close',
  failure: Failure,
  event: unknown,
) =>
  reportAction(table, {
    plugin: 'failureLog',
    action,
    detail: { key: failure.key },
    source: userSourceOf(event),
  })

/** Записи новые сверху; в одну миллисекунду — по порядку записи. */
const newestFirst = (failures: Failures | undefined) =>
  Object.values(failures ?? EMPTY)
    .map((failure, order) => ({ failure, order }))
    .sort((a, b) => b.failure.time - a.failure.time || b.order - a.order)
    .map(({ failure }) => failure)

const FailureEntry = ({
  table,
  failure,
  locale,
}: {
  table: unknown
  failure: Failure
  locale: string | undefined
}) => {
  const labels = useLocalization()
  const time = new Date(failure.time)
  const { retry } = failure
  const target = failureTargetText(table, failure, labels)
  return (
    <>
      <div className={styles.head}>
        <span className={styles.label}>{failure.label}</span>
        <time
          className={styles.time}
          dateTime={time.toISOString()}
          title={time.toLocaleTimeString(locale)}
        >
          {time.toLocaleTimeString(locale, {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </time>
      </div>
      {target && <span className={styles.target}>{target}</span>}
      <span className={styles.reason}>{failure.reason}</span>
      <div className={styles.actions}>
        {canShowFailure(failure) && (
          <Button
            variant="ghost"
            data-action="show"
            onClick={event => {
              report(table, 'show', failure, event)
              void showFailure(table, failure)
            }}
          >
            {labels.failureShow}
          </Button>
        )}
        {retry && (
          <Button
            variant="ghost"
            data-action="retry"
            onClick={event => {
              report(table, 'retry', failure, event)
              retry()
            }}
          >
            {labels.failureRetry}
          </Button>
        )}
        <Button
          variant="ghost"
          data-action="close"
          onClick={event => {
            report(table, 'close', failure, event)
            failure.discard?.()
            resolveFailure(table, failure.key)
          }}
        >
          {labels.failureClose}
        </Button>
      </div>
    </>
  )
}

const FailureList = ({ table }: { table: unknown }) => {
  const labels = useLocalization()
  const failures = useSliceProjection(table, 'failures', newestFirst)
  const locale = (table as { options: { locale?: string } }).options.locale
  const scrollRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: failures.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ENTRY_ESTIMATE,
    overscan: OVERSCAN,
    getItemKey: index => failures[index]!.key,
  })
  return (
    <div ref={scrollRef} className={styles.scroller}>
      <div
        role="list"
        aria-label={labels.failureLog}
        className={styles.list}
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualizer.getVirtualItems().map(item => {
          const failure = failures[item.index]!
          return (
            <div
              key={item.key}
              ref={virtualizer.measureElement}
              role="listitem"
              data-index={item.index}
              data-failure-key={failure.key}
              className={styles.entry}
              style={{ transform: `translateY(${item.start}px)` }}
            >
              <FailureEntry table={table} failure={failure} locale={locale} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export const FailureLogPopover = ({
  table,
  label,
  icon,
  count,
  open,
  onOpenChange,
}: FailureLogPopoverProps) => {
  const themeClass = usePortalThemeClass()
  const themeData = usePortalThemeData()
  const labels = useLocalization()
  const triggerRef = useRef<HTMLButtonElement>(null)

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <ToolbarButton
        ref={triggerRef}
        label={label}
        icon={icon}
        active
        count={count}
        indicatorTone="error"
        data-testid="failure-log-button"
        render={<Popover.Trigger />}
      />
      <Popover.Portal>
        <Popover.Positioner
          side="bottom"
          align="end"
          sideOffset={POPUP_SIDE_OFFSET}
          className={clsx(themeClass, styles.positioner)}
          {...themeData}
        >
          <Popover.Popup
            aria-label={labels.failureLog}
            finalFocus={triggerRef}
            className={clsx(themeClass, styles.popup)}
            data-testid="failure-log"
          >
            <p className={styles.title}>{labels.failureLog}</p>
            <FailureList table={table} />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
