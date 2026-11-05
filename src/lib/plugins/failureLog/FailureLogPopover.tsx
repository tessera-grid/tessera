/**
 * Поповер журнала отказов (ADR 0177, §7; JR2–JR3, JR8; ADR 0178, DR42): записи реестра отказов
 * облачками — новые сверху; подпись действия и время, под подписью цель, ниже причина; нажатие на облачко показывает
 * цель, у записи — «Повторить» и «Закрыть»; внизу — «Очистить всё». Отдельный чанк: открытием управляет эагерная кнопка
 * (`FailureLogButton`).
 */
import { type ReactNode, useRef } from 'react'

import { Popover } from '@base-ui/react/popover'

import {
  type Failure,
  type Failures,
  failureName,
  resolveFailure,
} from '../../core/failures/failuresFeature'
import { PopupSurface } from '../../ui/Popup/PopupSurface'
import { reportAction, userSourceOf } from '../../core/debugActions'
import { useLocalization } from '../../core/localization'
import { useSliceProjection } from '../../core/reactivity'
import { Bubble } from '../../ui/Bubble'
import { Button } from '../../ui/Button'
import { IconButton } from '../../ui/IconButton'
import { Stub } from '../../ui/Stub'
import { useIcons } from '../../ui/icons'
import { PopupEntry } from '../../ui/Popup/PopupEntry'
import { PopupFooter, PopupPanel } from '../../ui/Popup/PopupPanel'
import { ToolbarButton } from '../../ui/ToolbarButton'
import { useVirtualizer } from '../../../vendor/tanstack-virtual/react-virtual'
import {
  canShowTarget,
  objectTargetText,
  showTarget,
} from '../../shared/objectTarget'

import styles from './FailureLog.module.css'
import { failureLogLabels } from './labels'

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
  action: 'show' | 'retry' | 'close' | 'clearAll',
  failure: Failure | undefined,
  event: unknown,
) =>
  reportAction(table, {
    plugin: 'failureLog',
    action,
    ...(failure ? { detail: { key: failure.key } } : {}),
    source: userSourceOf(event),
  })

/** Записи новые сверху; в одну миллисекунду — по порядку записи. */
const newestFirst = (failures: Failures | undefined) =>
  Object.values(failures ?? EMPTY)
    .map((failure, order) => ({ failure, order }))
    .sort((a, b) => b.failure.time - a.failure.time || b.order - a.order)
    .map(({ failure }) => failure)

/** Закрыть запись: отбросить отклонённое изменение, если источник умеет, и снять запись. */
const closeFailure = (table: unknown, failure: Failure) => {
  failure.discard?.()
  resolveFailure(table, failure.key)
}

const FailureEntry = ({
  table,
  failure,
  locale,
  onClosed,
  onDone,
}: {
  table: unknown
  failure: Failure
  locale: string | undefined
  /** Запись закрыта: её кнопки ушли вместе с фокусом. */
  onClosed: () => void
  /** Переход к цели и «Повторить» закрывают журнал. */
  onDone: () => void
}) => {
  const labels = useLocalization()
  const icons = useIcons()
  const time = new Date(failure.time)
  const { retry } = failure
  const target = objectTargetText(table, failure.target, labels)
  return (
    <PopupEntry
      mark={<Bubble size="dot" tone="error" />}
      label={
        <>
          {failureName(table, failure, labels)}
          {target && <span className={styles.target}> {target}</span>}
        </>
      }
      onShow={
        canShowTarget(failure.target)
          ? event => {
              report(table, 'show', failure, event)
              onDone()
              void showTarget(table, failure.target)
            }
          : undefined
      }
      aside={
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
      }
      actions={
        <>
          {retry && (
            <IconButton
              shape="square"
              size="compact"
              label={labels.failureRetry}
              data-action="retry"
              onClick={event => {
                report(table, 'retry', failure, event)
                onDone()
                retry()
              }}
            >
              <icons.retry />
            </IconButton>
          )}
          <IconButton
            shape="square"
            size="compact"
            label={failureLogLabels(labels).failureClose}
            data-action="close"
            onClick={event => {
              report(table, 'close', failure, event)
              closeFailure(table, failure)
              onClosed()
            }}
          >
            <icons.clear />
          </IconButton>
        </>
      }
    >
      <span className={styles.reason} data-failure-reason="">
        {failure.reason}
      </span>
    </PopupEntry>
  )
}

const FailureList = ({
  table,
  onClosed,
  onDone,
}: {
  table: unknown
  onClosed: () => void
  onDone: () => void
}) => {
  const labels = useLocalization()
  const icons = useIcons()
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
  if (failures.length === 0)
    return (
      <Stub
        size="compact"
        media={<icons.failureLogEmpty />}
        title={failureLogLabels(labels).failureLogEmpty}
        description={failureLogLabels(labels).failureLogEmptyDescription}
        data-testid="failure-log-empty"
      />
    )
  return (
    <>
      <div ref={scrollRef} className={styles.scroller} data-popup-scroller="">
        <div
          role="list"
          aria-label={failureLogLabels(labels).failureLog}
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
                <FailureEntry
                  table={table}
                  failure={failure}
                  locale={locale}
                  onClosed={onClosed}
                  onDone={onDone}
                />
              </div>
            )
          })}
        </div>
      </div>
      <PopupFooter>
        <Button
          variant="ghost"
          data-action="clear-all"
          onClick={event => {
            report(table, 'clearAll', undefined, event)
            for (const failure of failures) closeFailure(table, failure)
            onClosed()
          }}
        >
          {failureLogLabels(labels).failureClearAll}
        </Button>
      </PopupFooter>
    </>
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
  const labels = useLocalization()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  // Закрытая запись уносит свой кебаб, «Очистить всё» — себя: фокус — на журнал.
  const keepFocus = () => requestAnimationFrame(() => popupRef.current?.focus())

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <ToolbarButton
        ref={triggerRef}
        label={label}
        icon={icon}
        active={count > 0}
        count={count}
        indicatorTone="error"
        data-testid="failure-log-button"
        render={<Popover.Trigger />}
      />
      <Popover.Portal>
        <PopupSurface
          positioner={<Popover.Positioner side="bottom" align="end" />}
          popup={
            <Popover.Popup
              aria-label={failureLogLabels(labels).failureLog}
              ref={popupRef}
              finalFocus={triggerRef}
              data-testid="failure-log"
            />
          }
          className={styles.popup}
        >
          <PopupPanel title={failureLogLabels(labels).failureLog}>
            <FailureList
              table={table}
              onClosed={keepFocus}
              onDone={() => onOpenChange(false)}
            />
          </PopupPanel>
        </PopupSurface>
      </Popover.Portal>
    </Popover.Root>
  )
}
