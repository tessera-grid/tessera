/**
 * Попап истории правок (ADR 0222, §11; UD18–UD20): записи — пункты списка, новые сверху; текущая —
 * последняя действующая — выбрана, с точкой и подсказкой, остальные приглушены, откаченные — над ней.
 * Нажатие на пункт — откат или повтор до записи и вспышка изменённого; на текущий — её ячейки. Стрелки
 * ходят по записям. Отдельный чанк: открытием управляет кнопка (`HistoryButton`).
 */
import { type KeyboardEvent, useRef, useState } from 'react'

import { Popover } from '@base-ui/react/popover'

import { pluginStateKey } from '../../core/definePlugin'
import { DRAFTS_KEY } from '../../core/drafts/drafts'
import { useLocalization } from '../../core/localization'
import { useSlice } from '../../core/reactivity'
import { Bubble } from '../../ui/Bubble'
import { useIcons } from '../../ui/icons'
import { PopupItem } from '../../ui/Popup/PopupItem'
import { Button } from '../../ui/Button'
import { PopupFooter, PopupPanel } from '../../ui/Popup/PopupPanel'
import { PopupSurface } from '../../ui/Popup/PopupSurface'
import { useScrollFade } from '../../ui/Popup/useScrollFade'
import hidden from '../../ui/visuallyHidden.module.css'
import { Stub } from '../../ui/Stub'
import { ToolbarButton } from '../../ui/ToolbarButton'
import { useVirtualizer } from '../../../vendor/tanstack-virtual/react-virtual'
import {
  type EditHistoryApplied,
  type EditHistoryEntry,
  ID,
  historyOf,
  rewind,
} from './history'
import { HistoryIcon } from './icons'
import { editHistoryLabels } from './labels'

import styles from './EditHistory.module.css'

const ENTRY_ESTIMATE = 48
const OVERSCAN = 4

export interface HistoryPopoverProps {
  table: unknown
  label: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Item =
  | {
      kind: 'entry'
      entry: EditHistoryEntry
      undone: boolean
      current: boolean
    }
  | { kind: 'applied'; applied: EditHistoryApplied }

const HistoryEntry = ({
  table,
  entry,
  undone,
  current,
  locale,
}: {
  table: unknown
  entry: EditHistoryEntry
  undone: boolean
  current: boolean
  locale: string | undefined
}) => {
  const labels = useLocalization()
  const own = editHistoryLabels(labels)
  const time = new Date(entry.time)
  return (
    <div
      data-history-entry={entry.id}
      data-undone={undone || undefined}
      data-unsaved={entry.unsaved || undefined}
    >
      {/* Пункт списка, как выбор размера страницы: текущий — серой подложкой выбранного, прочие
          приглушены (§11). Нажатие — переход к записи, на текущую — её ячейки. */}
      <PopupItem
        render={<button type="button" />}
        className={styles.item}
        data-history-item=""
        data-selected={current || undefined}
        aria-current={current ? 'step' : undefined}
        onClick={() => void rewind(table, entry.id, 'pointer')}
        // Точка — только у текущей: синяя — применено, тоном черновика — ещё нет (§11, §14).
        icon={
          current ? (
            <Bubble
              size="dot"
              tone={entry.unsaved ? 'draft' : 'active'}
              data-history-dot=""
            />
          ) : null
        }
        iconHint={
          current
            ? entry.unsaved
              ? own.historyCurrentUnsaved
              : own.historyCurrent
            : undefined
        }
        label={
          <>
            <span data-history-label="">{entry.action}</span>
            {/* Отменённую видно местом над текущей; словами — скринридеру. */}
            {undone && (
              <span className={hidden['visually-hidden']}>
                {' '}
                {own.historyUndone}
              </span>
            )}
            {entry.unsaved && (
              <span className={hidden['visually-hidden']}>
                {' '}
                {own.historyUnsaved}
              </span>
            )}
          </>
        }
        caption={
          entry.detail !== undefined ? (
            <span data-history-detail="">{entry.detail}</span>
          ) : undefined
        }
        end={
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
      />
    </div>
  )
}

/** Разделитель «Применено»: ориентир во времени, не шаг (§14). */
const AppliedMark = ({
  applied,
  locale,
}: {
  applied: EditHistoryApplied
  locale: string | undefined
}) => {
  const own = editHistoryLabels(useLocalization())
  const time = new Date(applied.time)
  return (
    <div className={styles.applied} data-history-applied="">
      <span>{own.historyApplied(applied.count)}</span>
      <time className={styles.time} dateTime={time.toISOString()}>
        {time.toLocaleTimeString(locale, {
          hour: '2-digit',
          minute: '2-digit',
        })}
      </time>
    </div>
  )
}

/** Стрелки ходят по облачкам записей; фокус — на их главной кнопке. */
const moveFocus = (event: KeyboardEvent<HTMLDivElement>) => {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
  // Главная кнопка облачка — первая в записи.
  const entries = [
    ...event.currentTarget.querySelectorAll<HTMLElement>(
      '[data-history-entry]',
    ),
  ].flatMap(entry => entry.querySelector<HTMLElement>('button') ?? [])
  const index = entries.indexOf(document.activeElement as HTMLElement)
  const next = entries[index + (event.key === 'ArrowDown' ? 1 : -1)]
  if (!next) return
  event.preventDefault()
  next.focus()
}

const HistoryList = ({ table }: { table: unknown }) => {
  const labels = useLocalization()
  const icons = useIcons()
  const own = editHistoryLabels(labels)
  // Срез будит список; записи с подписями — из стека истории. Черновики будят пометку
  // неприменённого (§14).
  useSlice(table as never, pluginStateKey(ID) as never)
  useSlice(table as never, DRAFTS_KEY as never)
  const { entries, position, applied } = historyOf(table, labels)
  const locale = (table as { options: { locale?: string } }).options.locale
  const items: Item[] = []
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i]!
    // Разделитель «Применено» — над записью, после которой применили (§14).
    for (let k = applied.length - 1; k >= 0; k--)
      if (applied[k]!.after === entry.id)
        items.push({ kind: 'applied', applied: applied[k]! })
    items.push({
      kind: 'entry',
      entry,
      undone: i >= position,
      current: i === position - 1,
    })
  }
  const [rewinding, setRewinding] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const scrollerRef = useScrollFade(scrollRef)
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ENTRY_ESTIMATE,
    overscan: OVERSCAN,
    getItemKey: index => {
      const item = items[index]!
      return item.kind === 'entry'
        ? item.entry.id
        : `applied:${item.applied.after}:${item.applied.time}`
    },
  })
  if (entries.length === 0)
    return (
      <Stub
        size="compact"
        media={<icons.editHistoryEmpty />}
        title={own.historyEmpty}
        description={own.historyEmptyDescription}
        data-testid="edit-history-empty"
      />
    )
  return (
    <>
      <div ref={scrollerRef} className={styles.scroller} data-popup-scroller="">
        <div
          role="list"
          aria-label={own.history}
          className={styles.list}
          style={{ height: virtualizer.getTotalSize() }}
          onKeyDown={moveFocus}
        >
          {virtualizer.getVirtualItems().map(virtual => {
            const item = items[virtual.index]!
            return (
              <div
                key={virtual.key}
                ref={virtualizer.measureElement}
                role="listitem"
                data-index={virtual.index}
                className={styles.entry}
                style={{ transform: `translateY(${virtual.start}px)` }}
              >
                {item.kind === 'applied' ? (
                  <AppliedMark applied={item.applied} locale={locale} />
                ) : (
                  <HistoryEntry
                    table={table}
                    entry={item.entry}
                    undone={item.undone}
                    current={item.current}
                    locale={locale}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
      <PopupFooter>
        <Button
          variant="outline"
          data-action="back-to-original"
          disabled={position === 0}
          pending={rewinding}
          onClick={() => {
            setRewinding(true)
            void rewind(table, null, 'pointer').finally(() =>
              setRewinding(false),
            )
          }}
        >
          {own.historyOriginal}
        </Button>
      </PopupFooter>
    </>
  )
}

export const HistoryPopover = ({
  table,
  label,
  open,
  onOpenChange,
}: HistoryPopoverProps) => {
  const labels = useLocalization()
  const triggerRef = useRef<HTMLButtonElement>(null)
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <ToolbarButton
        ref={triggerRef}
        label={label}
        icon={<HistoryIcon />}
        data-testid="edit-history-button"
        render={<Popover.Trigger />}
      />
      <Popover.Portal>
        <PopupSurface
          positioner={<Popover.Positioner side="bottom" align="end" />}
          popup={
            <Popover.Popup
              aria-label={editHistoryLabels(labels).history}
              finalFocus={triggerRef}
              data-testid="edit-history"
            />
          }
          className={styles.popup}
        >
          <PopupPanel title={editHistoryLabels(labels).history}>
            <HistoryList table={table} />
          </PopupPanel>
        </PopupSurface>
      </Popover.Portal>
    </Popover.Root>
  )
}
