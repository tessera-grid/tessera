/**
 * Попап истории правок (ADR 0222, §11; UD18–UD20): записи облачками, новые сверху; текущая —
 * последняя действующая — выделена, выше неё откаченные, приглушённые; нажатие на облачко — откат
 * или повтор до записи, «Показать» — выделение её ячеек без отката. Стрелки ходят по записям. Отдельный чанк:
 * открытием управляет кнопка (`HistoryButton`).
 */
import { type KeyboardEvent, useRef, useState } from 'react'

import { Popover } from '@base-ui/react/popover'

import { pluginStateKey } from '../../core/definePlugin'
import { useLocalization } from '../../core/localization'
import { useSlice } from '../../core/reactivity'
import { Bubble } from '../../ui/Bubble'
import { useIcons } from '../../ui/icons'
import { ItemButton } from '../../ui/Popup/ItemButton'
import { PopupEntry } from '../../ui/Popup/PopupEntry'
import { Button } from '../../ui/Button'
import { PopupFooter, PopupPanel } from '../../ui/Popup/PopupPanel'
import { PopupSurface } from '../../ui/Popup/PopupSurface'
import { useScrollFade } from '../../ui/Popup/useScrollFade'
import { Stub } from '../../ui/Stub'
import { ToolbarButton } from '../../ui/ToolbarButton'
import { useVirtualizer } from '../../../vendor/tanstack-virtual/react-virtual'
import {
  type EditHistoryEntry,
  ID,
  historyOf,
  rewind,
  showEntry,
} from './history'
import { HistoryIcon } from './icons'
import { editHistoryLabels } from './labels'

import styles from './EditHistory.module.css'

const ENTRY_ESTIMATE = 72
const OVERSCAN = 4

export interface HistoryPopoverProps {
  table: unknown
  label: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface Item {
  entry: EditHistoryEntry
  undone: boolean
  current: boolean
}

const HistoryEntry = ({
  table,
  entry,
  undone,
  current,
  locale,
  onDone,
}: {
  table: unknown
  entry: EditHistoryEntry
  undone: boolean
  current: boolean
  locale: string | undefined
  onDone: () => void
}) => {
  const labels = useLocalization()
  const icons = useIcons()
  const own = editHistoryLabels(labels)
  const time = new Date(entry.time)
  return (
    <div data-history-entry={entry.id} data-undone={undone || undefined}>
      <PopupEntry
        mark={undone ? null : <Bubble size="dot" />}
        current={current}
        label={
          <>
            <span className={styles.label} data-history-label="">
              {entry.label}
            </span>
            {undone && (
              <span className={styles.undone}> {own.historyUndone}</span>
            )}
          </>
        }
        onShow={() => void rewind(table, entry.id, 'pointer')}
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
          entry.cells > 0 ? (
            <ItemButton
              label={own.historyShow}
              data-action="reveal"
              onClick={() => {
                onDone()
                showEntry(table, entry.id)
              }}
            >
              <icons.failureShow />
            </ItemButton>
          ) : undefined
        }
      />
    </div>
  )
}

/** Стрелки ходят по облачкам записей; фокус — на их главной кнопке. */
const moveFocus = (event: KeyboardEvent<HTMLDivElement>) => {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
  // Главная кнопка облачка — первая в записи; «Показать» идёт за ней.
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

const HistoryList = ({
  table,
  onDone,
}: {
  table: unknown
  onDone: () => void
}) => {
  const labels = useLocalization()
  const icons = useIcons()
  const own = editHistoryLabels(labels)
  // Срез будит список; записи с подписями — из стека истории.
  useSlice(table as never, pluginStateKey(ID) as never)
  const { entries, position } = historyOf(table, labels)
  const locale = (table as { options: { locale?: string } }).options.locale
  const items: Item[] = []
  for (let i = entries.length - 1; i >= 0; i--)
    items.push({
      entry: entries[i]!,
      undone: i >= position,
      current: i === position - 1,
    })
  const [rewinding, setRewinding] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const scrollerRef = useScrollFade(scrollRef)
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ENTRY_ESTIMATE,
    overscan: OVERSCAN,
    getItemKey: index => items[index]!.entry.id,
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
                <HistoryEntry
                  table={table}
                  entry={item.entry}
                  undone={item.undone}
                  current={item.current}
                  locale={locale}
                  onDone={onDone}
                />
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
            <HistoryList table={table} onDone={() => onOpenChange(false)} />
          </PopupPanel>
        </PopupSurface>
      </Popover.Portal>
    </Popover.Root>
  )
}
