/**
 * Поповер журнала отказов (ADR 0177, §7; ADR 0227, §4–§7): записи облачками — новые сверху;
 * отказы одного применения с одной причиной — группа, нажатие на неё меняет содержимое на список
 * её отказов. У записи с правкой — «Повторить» и «Сбросить правку», у записи без правки —
 * «Повторить» и «Закрыть»; внизу — «Сбросить все правки» (от десяти правок — с вопросом) или
 * «Закрыть все». Переход к цели закрывает журнал, только когда цель нашлась. Отдельный чанк:
 * открытием управляет эагерная кнопка (`FailureLogButton`).
 */
import {
  type MouseEvent,
  type ReactNode,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { Popover } from '@base-ui/react/popover'

import { announceLabel } from '../../core/announcer'
import {
  type Failure,
  type Failures,
  failureName,
} from '../../core/failures/failuresFeature'
import { reportAction, userSourceOf } from '../../core/debugActions'
import { type TableLabels, useLocalization } from '../../core/localization'
import { useSliceProjection } from '../../core/reactivity'
import { Bubble } from '../../ui/Bubble'
import { Button } from '../../ui/Button'
import { ItemButton } from '../../ui/Popup/ItemButton'
import { PopupEntry } from '../../ui/Popup/PopupEntry'
import {
  PopupLevelBack,
  PopupLevels,
  usePopupLevels,
} from '../../ui/Popup/PopupLevels'
import { PopupFooter, PopupPanel } from '../../ui/Popup/PopupPanel'
import { PopupSurface } from '../../ui/Popup/PopupSurface'
import { useScrollFade } from '../../ui/Popup/useScrollFade'
import { Question } from '../../ui/Question'
import { Stub } from '../../ui/Stub'
import { ToolbarButton } from '../../ui/ToolbarButton'
import { useIcons } from '../../ui/icons'
import { useVirtualizer } from '../../../vendor/tanstack-virtual/react-virtual'
import {
  canShowTarget,
  objectTargetText,
  showTarget,
} from '../../shared/objectTarget'

import styles from './FailureLog.module.css'
import {
  type JournalEntry,
  closeAll,
  discardAll,
  editsIn,
  journalOf,
  newestFirst,
  retryAll,
} from './journal'
import { failureLogLabels } from './labels'

const ENTRY_ESTIMATE = 96
const OVERSCAN = 4
/** Высота окна списка до замера — не выше окна карточек (`cardsScroll`). */
const LIST_WINDOW = 320
/** От стольких правок «Сбросить все правки» спрашивает (ADR 0227, §6). */
const DISCARD_ALL_CONFIRM = 10

type GroupEntry = Extract<JournalEntry, { kind: 'group' }>

export interface FailureLogPopoverProps {
  table: unknown
  label: string
  icon: ReactNode
  count: number
  open: boolean
  onOpenChange: (open: boolean, details?: unknown) => void
}

type LogAction =
  | 'show'
  | 'retry'
  | 'close'
  | 'discard'
  | 'clearAll'
  | 'discardAll'
  | 'retryGroup'
  | 'discardGroup'

/** Действие журнала — в канал действий (ADR 0125). */
const report = (
  table: unknown,
  action: LogAction,
  failures: readonly Failure[] | undefined,
  event: unknown,
) =>
  reportAction(table, {
    plugin: 'failureLog',
    action,
    ...(failures?.length === 1
      ? { detail: { key: failures[0]!.key } }
      : failures
        ? { detail: { keys: failures.map(failure => failure.key) } }
        : {}),
    source: userSourceOf(event),
  })

/** Строка цели группы: число целей по виду цели. */
const groupTargetText = (group: GroupEntry, labels: TableLabels) => {
  const own = failureLogLabels(labels)
  const count = group.failures.length
  return group.unit === 'cell'
    ? own.failureGroupCells(count)
    : group.unit === 'row'
      ? own.failureGroupRows(count)
      : own.failureGroupItems(count)
}

/** Обработчики записей: их зовут обе ступени журнала. */
interface EntryHandlers {
  table: unknown
  locale: string | undefined
  /** Ключи записей, к цели которых перейти не удалось. */
  notFound: ReadonlySet<string>
  onShowTarget: (failure: Failure, event: MouseEvent) => void
  /** Запись ушла с кнопками: фокус — на журнал. */
  onRemoved: () => void
  /** «Повторить» закрывает журнал. */
  onDone: () => void
}

const Time = ({ time, locale }: { time: number; locale?: string }) => {
  const date = new Date(time)
  return (
    <time
      className={styles.time}
      dateTime={date.toISOString()}
      title={date.toLocaleTimeString(locale)}
    >
      {date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
    </time>
  )
}

/** Кнопки записи или группы: «Повторить», затем «Сбросить» — у правок, иначе «Закрыть». */
const EntryActions = ({
  failures,
  group,
  table,
  onRemoved,
  onDone,
}: {
  failures: readonly Failure[]
  group: boolean
} & Pick<EntryHandlers, 'table' | 'onRemoved' | 'onDone'>) => {
  const labels = useLocalization()
  const icons = useIcons()
  const own = failureLogLabels(labels)
  const canRetry = failures.some(failure => failure.retry)
  const edits = editsIn(failures) > 0
  return (
    <>
      {canRetry && (
        <ItemButton
          label={labels.failureRetry}
          data-action="retry"
          onClick={event => {
            report(table, group ? 'retryGroup' : 'retry', failures, event)
            onDone()
            retryAll(failures)
          }}
        >
          <icons.retry />
        </ItemButton>
      )}
      {edits ? (
        <ItemButton
          label={group ? own.failureDiscardGroup : labels.failureDiscard}
          tone="danger"
          data-action="discard"
          onClick={event => {
            report(table, group ? 'discardGroup' : 'discard', failures, event)
            discardAll(table, failures)
            onRemoved()
          }}
        >
          <icons.draftDiscard />
        </ItemButton>
      ) : (
        <ItemButton
          label={group ? own.failureCloseGroup : own.failureClose}
          data-action="close"
          onClick={event => {
            report(table, 'close', failures, event)
            closeAll(table, failures)
            onRemoved()
          }}
        >
          <icons.clear />
        </ItemButton>
      )}
    </>
  )
}

const FailureEntry = ({
  failure,
  table,
  locale,
  notFound,
  onShowTarget,
  onRemoved,
  onDone,
}: { failure: Failure } & EntryHandlers) => {
  const labels = useLocalization()
  const target = objectTargetText(table, failure.target, labels)
  return (
    <PopupEntry
      mark={<Bubble size="dot" tone="error" />}
      markHint={failureLogLabels(labels).markHint}
      label={
        <>
          {failureName(table, failure, labels)}
          {target && (
            <span className={styles.target} data-failure-target="">
              {' '}
              {target}
            </span>
          )}
        </>
      }
      onShow={
        canShowTarget(failure.target)
          ? event => onShowTarget(failure, event)
          : undefined
      }
      aside={<Time time={failure.time} locale={locale} />}
      actions={
        <EntryActions
          failures={[failure]}
          group={false}
          table={table}
          onRemoved={onRemoved}
          onDone={onDone}
        />
      }
      error={
        notFound.has(failure.key)
          ? failureLogLabels(labels).targetNotFound
          : undefined
      }
    >
      <span className={styles.reason} data-failure-reason="">
        {failure.reason}
      </span>
    </PopupEntry>
  )
}

const GroupRow = ({
  group,
  table,
  locale,
  onOpen,
  onRemoved,
  onDone,
}: {
  group: GroupEntry
  onOpen: () => void
} & Pick<EntryHandlers, 'table' | 'locale' | 'onRemoved' | 'onDone'>) => {
  const labels = useLocalization()
  const first = group.failures[0]!
  return (
    <PopupEntry
      mark={<Bubble size="dot" tone="error" />}
      markHint={failureLogLabels(labels).markHint}
      label={
        <>
          {failureName(table, first, labels)}
          <span className={styles.target} data-failure-count="">
            {' '}
            {groupTargetText(group, labels)}
          </span>
        </>
      }
      onShow={onOpen}
      aside={<Time time={first.time} locale={locale} />}
      actions={
        <EntryActions
          failures={group.failures}
          group
          table={table}
          onRemoved={onRemoved}
          onDone={onDone}
        />
      }
    >
      <span className={styles.reason} data-failure-reason="">
        {first.reason}
      </span>
    </PopupEntry>
  )
}

/** Виртуализированный список облачков; `render` рисует облачко по месту. */
const EntryList = <T,>({
  items,
  keyOf,
  attributes,
  label,
  render,
}: {
  items: readonly T[]
  keyOf: (item: T) => string
  attributes: (item: T) => Record<string, string>
  label: string
  render: (item: T) => ReactNode
}) => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const scrollerRef = useScrollFade(scrollRef)
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ENTRY_ESTIMATE,
    overscan: OVERSCAN,
    getItemKey: index => keyOf(items[index]!),
    // Высота длинной записи меняет прокрутку и размер поповера.
    // Отложенный замер не меняет раскладку внутри ResizeObserver.
    useAnimationFrameWithResizeObserver: true,
    // Окно до замера: записи есть с первого кадра — фокус входа ставится на первую.
    initialRect: { width: 0, height: LIST_WINDOW },
  })
  return (
    <div ref={scrollerRef} className={styles.scroller} data-popup-scroller="">
      <div
        role="list"
        aria-label={label}
        data-count={items.length}
        className={styles.list}
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualizer.getVirtualItems().map(item => {
          const value = items[item.index]!
          return (
            <div
              key={item.key}
              ref={virtualizer.measureElement}
              role="listitem"
              data-index={item.index}
              {...attributes(value)}
              className={styles.entry}
              style={{ transform: `translateY(${item.start}px)` }}
            >
              {render(value)}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Куда поставить фокус после смены уровня или ухода кнопки. */
type FocusAfter =
  | { kind: 'first' }
  | { kind: 'entry'; key: string }
  | { kind: 'footer' }
  | { kind: 'popup' }

export const FailureLogPopover = ({
  table,
  label,
  icon,
  count,
  open,
  onOpenChange,
}: FailureLogPopoverProps) => {
  const labels = useLocalization()
  const icons = useIcons()
  const own = failureLogLabels(labels)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const levels = usePopupLevels()
  const [groupKey, setGroupKey] = useState<string>()
  const [asking, setAsking] = useState(false)
  const [notFound, setNotFound] = useState<ReadonlySet<string>>(() => new Set())
  const focusAfter = useRef<FocusAfter | undefined>(undefined)
  const failures = useSliceProjection(
    table,
    'failures',
    (all: Failures | undefined) => newestFirst(all),
  )
  const journal = useMemo(() => journalOf(failures), [failures])
  const group = journal.find(
    (entry): entry is GroupEntry =>
      entry.kind === 'group' && entry.key === groupKey,
  )
  const locale = (table as { options: { locale?: string } }).options.locale

  useLayoutEffect(() => {
    const target = focusAfter.current
    const level = levels.levelRef.current
    if (!target || !level) return
    focusAfter.current = undefined
    const pick = (selector: string) =>
      level.querySelector<HTMLElement>(selector)
    const firstButton = (entry: HTMLElement | null) =>
      entry?.querySelector<HTMLElement>('[data-action="show"]') ??
      entry?.querySelector<HTMLElement>('button')
    const focused =
      target.kind === 'first'
        ? firstButton(pick('[role="listitem"][data-index="0"]'))
        : target.kind === 'entry'
          ? // Ключ несёт нулевой символ: его не выразить селектором.
            firstButton(
              [
                ...level.querySelectorAll<HTMLElement>('[data-journal-key]'),
              ].find(entry => entry.dataset.journalKey === target.key) ?? null,
            )
          : target.kind === 'footer'
            ? pick('[data-popup-footer] button')
            : null
    ;(focused ?? popupRef.current)?.focus()
  })

  // Запись ушла вместе с кнопками: фокус — на журнал.
  const keepFocus = () => {
    focusAfter.current = { kind: 'popup' }
    requestAnimationFrame(() => {
      if (!popupRef.current?.contains(document.activeElement))
        popupRef.current?.focus()
    })
  }
  const close = () => onOpenChange(false)

  const enter = (key: string) => {
    focusAfter.current = { kind: 'first' }
    levels.go('forward')
    setGroupKey(key)
  }
  const back = () => {
    if (groupKey) focusAfter.current = { kind: 'entry', key: groupKey }
    levels.go('back')
    setGroupKey(undefined)
  }

  // Переход к цели: журнал закрывается, когда цель нашлась (ADR 0227, §7).
  const onShowTarget = (failure: Failure, event: MouseEvent) => {
    report(table, 'show', [failure], event)
    void showTarget(table, failure.target).then(found => {
      if (found) {
        close()
        return
      }
      setNotFound(prev => new Set(prev).add(failure.key))
      announceLabel(table, all => failureLogLabels(all).targetNotFound)
    })
  }

  const handlers: EntryHandlers = {
    table,
    locale,
    notFound,
    onShowTarget,
    onRemoved: keepFocus,
    onDone: close,
  }

  const edits = editsIn(failures)
  const runFooter = (event: unknown) => {
    report(table, edits > 0 ? 'discardAll' : 'clearAll', undefined, event)
    setAsking(false)
    discardAll(table, failures)
    keepFocus()
  }
  const footer = asking ? (
    <Question
      className={styles.question}
      title={own.failureDiscardAllQuestion(edits)}
      confirmLabel={own.failureDiscardAllConfirm}
      declineLabel={own.failureDiscardAllDecline}
      danger="confirm"
      focusOnShow="decline"
      onConfirm={runFooter}
      onDecline={() => {
        focusAfter.current = { kind: 'footer' }
        setAsking(false)
      }}
      data-testid="failure-log-question"
    />
  ) : (
    <Button
      variant="ghost"
      tone={edits > 0 ? 'danger' : undefined}
      data-action={edits > 0 ? 'discard-all' : 'clear-all'}
      onClick={event => {
        if (edits >= DISCARD_ALL_CONFIRM) setAsking(true)
        else runFooter(event)
      }}
    >
      {edits > 0 ? own.failureDiscardAll : own.failureClearAll}
    </Button>
  )

  const level = group ? (
    <PopupPanel className={styles.panel}>
      <PopupLevelBack
        label={`${failureName(table, group.failures[0]!, labels)} · ${groupTargetText(group, labels)}`}
        ariaLabel={labels.menuBack(
          `${failureName(table, group.failures[0]!, labels)} · ${groupTargetText(group, labels)}`,
        )}
        onClick={back}
      />
      <EntryList
        items={group.failures}
        keyOf={failure => failure.key}
        attributes={failure => ({ 'data-failure-key': failure.key })}
        label={own.failureLog}
        render={failure => <FailureEntry failure={failure} {...handlers} />}
      />
    </PopupPanel>
  ) : (
    <PopupPanel title={own.failureLog} className={styles.panel}>
      {journal.length === 0 ? (
        <Stub
          size="compact"
          media={<icons.failureLogEmpty />}
          title={own.failureLogEmpty}
          description={own.failureLogEmptyDescription}
          data-testid="failure-log-empty"
        />
      ) : (
        <>
          <EntryList
            items={journal}
            keyOf={entry => entry.key}
            attributes={entry => ({
              'data-journal-key': entry.key,
              ...(entry.kind === 'group'
                ? {
                    'data-failure-group': '',
                    'data-failure-count': String(entry.failures.length),
                  }
                : { 'data-failure-key': entry.key }),
            })}
            label={own.failureLog}
            render={entry =>
              entry.kind === 'group' ? (
                <GroupRow
                  group={entry}
                  onOpen={() => enter(entry.key)}
                  {...handlers}
                />
              ) : (
                <FailureEntry failure={entry.failure} {...handlers} />
              )
            }
          />
          <PopupFooter>{footer}</PopupFooter>
        </>
      )}
    </PopupPanel>
  )

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next, details) => {
        // Escape: вопрос — отказ, второй уровень — назад; журнал остаётся открытым.
        if (!next && details?.reason === 'escape-key') {
          if (asking) {
            focusAfter.current = { kind: 'footer' }
            setAsking(false)
            return
          }
          if (group) {
            back()
            return
          }
        }
        if (next) {
          setGroupKey(undefined)
          setAsking(false)
          setNotFound(new Set())
        }
        onOpenChange(next, details)
      }}
    >
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
              aria-label={own.failureLog}
              ref={popupRef}
              finalFocus={triggerRef}
              data-testid="failure-log"
            />
          }
          className={styles.popup}
        >
          <PopupLevels levels={levels} levelKey={group?.key ?? 'journal'}>
            {level}
          </PopupLevels>
        </PopupSurface>
      </Popover.Portal>
    </Popover.Root>
  )
}
