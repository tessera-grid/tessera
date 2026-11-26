/**
 * Поповер пульта черновиков (ADR 0178, §8; DR11, DR42–DR47): изменения данных облачками в порядке
 * появления, черновики колонок — разделом ниже; у записи «Применить» и «Сбросить», нажатие на неё
 * показывает цель; внизу «Применить всё» и «Сбросить всё». Применение и переход к найденной цели
 * закрывают пульт; цель не нашлась — у записи строка ошибки (ADR 0227, §7). Отдельный чанк:
 * открытием управляет эагерная кнопка (`UnsavedChangesButton`).
 */
import { type ReactNode, useId, useRef, useState } from 'react'

import { Popover } from '@base-ui/react/popover'

import {
  applyAllDrafts,
  applyDraft,
  DRAFTS_KEY,
  type Draft,
  draftKeyOf,
  draftKindLabel,
  draftKindOf,
  draftKindsOf,
  draftValueDetails,
  discardDraft,
  useOpenDrafts,
} from '../../core/drafts/drafts'
import { PopupFooter, PopupPanel } from '../../ui/Popup/PopupPanel'
import { PopupSurface } from '../../ui/Popup/PopupSurface'
import { announceLabel } from '../../core/announcer'
import { reportAction, userSourceOf } from '../../core/debugActions'
import { useLocalization } from '../../core/localization'
import { useSliceProjection } from '../../core/reactivity'
import { Bubble } from '../../ui/Bubble'
import { Button } from '../../ui/Button'
import { ItemButton } from '../../ui/Popup/ItemButton'
import { Stub } from '../../ui/Stub'
import { useIcons } from '../../ui/icons'
import { PopupEntry } from '../../ui/Popup/PopupEntry'
import { useScrollFade } from '../../ui/Popup/useScrollFade'
import {
  defaultRangeExtractor,
  useVirtualizer,
} from '../../../vendor/tanstack-virtual/react-virtual'
import hidden from '../../ui/visuallyHidden.module.css'
import { ToolbarButton } from '../../ui/ToolbarButton'
import {
  canShowTarget,
  objectTargetText,
  showTarget,
} from '../../shared/objectTarget'

import { draftSections } from './sections'
import styles from './UnsavedChanges.module.css'
import { unsavedChangesLabels } from './labels'

export interface UnsavedChangesPopoverProps {
  table: unknown
  label: string
  icon: ReactNode
  count: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Действие пульта — в канал действий (ADR 0125). */
const report = (
  table: unknown,
  action: 'show' | 'apply' | 'discard' | 'applyAll' | 'discardAll',
  draft: Draft | undefined,
  event: unknown,
) =>
  reportAction(table, {
    plugin: 'unsavedChanges',
    action,
    ...(draft ? { detail: { kind: draft.kind, target: draft.target } } : {}),
    source: userSourceOf(event),
  })

/** Значение записи: «было → стало»; скринридер читает «Было», «Стало» словами. */
const ChangeValue = ({ was, now }: { was?: string; now: string }) => {
  const labels = useLocalization()
  if (was === undefined) return <>{now}</>
  const [previous, current] = draftValueDetails(labels, was, now)
  return (
    <>
      <span className={hidden['visually-hidden']} data-visually-hidden="">
        {previous.label}{' '}
      </span>
      {previous.value}
      <span aria-hidden> → </span>
      <span className={hidden['visually-hidden']} data-visually-hidden="">
        {' '}
        {current.label}{' '}
      </span>
      {current.value}
    </>
  )
}

interface EntryHandlers {
  /** Черновик снят: его кнопки ушли вместе с фокусом. */
  onDiscarded: () => void
  /** Переход к цели и «Применить» закрывают пульт. */
  onDone: () => void
  /** Ключи записей, к цели которых перейти не удалось. */
  notFound: ReadonlySet<string>
  onNotFound: (key: string) => void
}

const DraftEntry = ({
  table,
  draft,
  onDiscarded,
  onDone,
  notFound,
  onNotFound,
}: { table: unknown; draft: Draft } & EntryHandlers) => {
  const labels = useLocalization()
  const icons = useIcons()
  const kind = draftKindOf(table, draft.kind)
  if (!kind) return null
  const now = kind.describe?.(labels, draft, table)
  const was =
    now === undefined ? undefined : kind.previous?.(labels, draft, table)
  const target = objectTargetText(table, draft.target, labels)
  // Операция над строкой названа видом; правка ячейки и колонки — целью и значением.
  const operation = 'row' in draft.target
  return (
    <PopupEntry
      mark={<Bubble size="dot" tone="draft" />}
      markHint={unsavedChangesLabels(labels).markHint}
      label={
        <>
          {operation && <span>{draftKindLabel(table, kind, labels)} </span>}
          {target && <span className={styles.target}>{target} </span>}
          {now !== undefined && (
            <span className={styles.value} data-draft-value="">
              <ChangeValue was={was} now={now} />
            </span>
          )}
        </>
      }
      onShow={
        canShowTarget(draft.target)
          ? event => {
              report(table, 'show', draft, event)
              void showTarget(table, draft.target, 'arrived').then(found =>
                found
                  ? onDone()
                  : onNotFound(draftKeyOf(draft.kind, draft.target)),
              )
            }
          : undefined
      }
      error={
        notFound.has(draftKeyOf(draft.kind, draft.target))
          ? unsavedChangesLabels(labels).targetNotFound
          : undefined
      }
      actions={
        <>
          <ItemButton
            label={unsavedChangesLabels(labels).draftApply}
            data-action="apply"
            onClick={event => {
              report(table, 'apply', draft, event)
              onDone()
              void applyDraft(table, draft)
            }}
          >
            <icons.draftApply />
          </ItemButton>
          <ItemButton
            label={unsavedChangesLabels(labels).draftDiscard}
            tone="danger"
            data-action="discard"
            onClick={event => {
              report(table, 'discard', draft, event)
              discardDraft(table, draft)
              onDiscarded()
            }}
          >
            <icons.draftDiscard />
          </ItemButton>
        </>
      }
    />
  )
}

/** Оценка высоты облачка и заголовка раздела до замера; окно — плюс записи рядом. */
const ENTRY_ESTIMATE = 48
const TITLE_ESTIMATE = 30
const OVERSCAN = 4

/** Ряд списка пульта: заголовок раздела или запись своего списка. */
type Row =
  | { kind: 'title'; list: number }
  | { kind: 'entry'; list: number; draft: Draft; first: boolean }

/** Список пульта: изменения данных или раздел; его записи — ряды `first`–`last`. */
interface List {
  kind: string | undefined
  first: number
  last: number
  title?: number
}

/** Ряды пульта одним рядом для виртуализатора: изменения данных, затем разделы с заголовками. */
const rowsOf = (drafts: readonly Draft[]) => {
  const { data, sections } = draftSections(drafts)
  const rows: Row[] = []
  const lists: List[] = []
  const push = (kind: string | undefined, items: readonly Draft[]) => {
    const list = lists.length
    const title = kind === undefined ? undefined : rows.length
    if (title !== undefined) rows.push({ kind: 'title', list })
    const first = rows.length
    items.forEach((draft, index) =>
      rows.push({ kind: 'entry', list, draft, first: index === 0 }),
    )
    lists.push({ kind, first, last: rows.length - 1, title })
  }
  if (data.length > 0) push(undefined, data)
  for (const section of sections) push(section.kind, section.drafts)
  return { rows, lists }
}

const DraftList = ({
  table,
  ...handlers
}: { table: unknown } & EntryHandlers) => {
  const { onDiscarded, onDone } = handlers
  const labels = useLocalization()
  const icons = useIcons()
  const drafts = useSliceProjection(
    table,
    DRAFTS_KEY,
    (all: readonly Draft[] | undefined) => {
      const kinds = new Set(draftKindsOf(table).map(kind => kind.kind))
      return (all ?? []).filter(draft => kinds.has(draft.kind))
    },
  )
  // Открытая правка без черновиков — кнопки внизу остаются: «Применить всё» её сохранит.
  const open = useOpenDrafts(table)
  const { rows, lists } = rowsOf(drafts)
  const titleId = useId()
  // Заголовки разделов — всегда в DOM: на них ссылается имя списка раздела (DR56).
  const titles = lists.flatMap(list => list.title ?? [])
  const scrollRef = useRef<HTMLDivElement>(null)
  const scrollerRef = useScrollFade(scrollRef)
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: index =>
      rows[index]!.kind === 'title' ? TITLE_ESTIMATE : ENTRY_ESTIMATE,
    // Изменение высоты записи меняет размер списка и поповера.
    useAnimationFrameWithResizeObserver: true,
    overscan: OVERSCAN,
    getItemKey: index => {
      const row = rows[index]!
      return row.kind === 'title'
        ? `title:${lists[row.list]!.kind}`
        : draftKeyOf(row.draft.kind, row.draft.target)
    },
    rangeExtractor: range =>
      [...new Set([...titles, ...defaultRangeExtractor(range)])].sort(
        (x, y) => x - y,
      ),
  })
  if (drafts.length === 0 && open === 0)
    return (
      <Stub
        size="compact"
        media={<icons.unsavedChangesEmpty />}
        title={unsavedChangesLabels(labels).unsavedChangesEmpty}
        description={
          unsavedChangesLabels(labels).unsavedChangesEmptyDescription
        }
        data-testid="unsaved-changes-empty"
      />
    )
  const items = virtualizer.getVirtualItems()
  const placed = virtualizer.measurementsCache
  const nameOf = (list: List) => {
    const kind =
      list.kind === undefined ? undefined : draftKindOf(table, list.kind)
    return (
      kind?.sectionLabel?.(labels) ??
      (kind && draftKindLabel(table, kind, labels))
    )
  }
  return (
    <>
      <div ref={scrollerRef} className={styles.scroller} data-popup-scroller="">
        <div
          className={styles.rows}
          style={{ height: virtualizer.getTotalSize() }}
        >
          {items.map(item =>
            rows[item.index]!.kind === 'title' ? (
              <p
                key={item.key}
                ref={virtualizer.measureElement}
                id={`${titleId}-${rows[item.index]!.list}`}
                data-index={item.index}
                className={styles.sectionTitle}
                style={{ transform: `translateY(${item.start}px)` }}
              >
                {nameOf(lists[rows[item.index]!.list]!)}
              </p>
            ) : null,
          )}
          {lists.map((list, index) => {
            const own = items.filter(
              item =>
                rows[item.index]!.kind === 'entry' &&
                rows[item.index]!.list === index,
            )
            if (own.length === 0) return null
            // Список стоит от своей первой записи до последней, записи — от его верха.
            const top = placed[list.first]?.start ?? 0
            const bottom = placed[list.last]?.end ?? top
            return (
              <div
                key={list.kind ?? 'data'}
                role="list"
                className={styles.list}
                style={{ top, height: bottom - top }}
                {...(list.title === undefined
                  ? {
                      'aria-label': unsavedChangesLabels(labels).unsavedChanges,
                    }
                  : { 'aria-labelledby': `${titleId}-${index}` })}
              >
                {own.map(item => {
                  const row = rows[item.index] as Extract<
                    Row,
                    { kind: 'entry' }
                  >
                  return (
                    <div
                      key={item.key}
                      ref={virtualizer.measureElement}
                      role="listitem"
                      data-index={item.index}
                      data-draft-kind={row.draft.kind}
                      data-first={row.first || undefined}
                      className={styles.entry}
                      style={{
                        transform: `translateY(${item.start - top}px)`,
                      }}
                    >
                      <DraftEntry
                        table={table}
                        draft={row.draft}
                        {...handlers}
                      />
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
      <PopupFooter>
        <Button
          variant="ghost"
          tone="danger"
          data-action="discard-all"
          onClick={event => {
            report(table, 'discardAll', undefined, event)
            for (const draft of drafts) discardDraft(table, draft)
            onDiscarded()
          }}
        >
          {unsavedChangesLabels(labels).draftDiscardAll}
        </Button>
        <Button
          variant="outline"
          data-action="apply-all"
          onClick={event => {
            report(table, 'applyAll', undefined, event)
            onDone()
            applyAllDrafts(table)
          }}
        >
          {unsavedChangesLabels(labels).draftApplyAll}
        </Button>
      </PopupFooter>
    </>
  )
}

export const UnsavedChangesPopover = ({
  table,
  label,
  icon,
  count,
  open,
  onOpenChange,
}: UnsavedChangesPopoverProps) => {
  const labels = useLocalization()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const [notFound, setNotFound] = useState<ReadonlySet<string>>(() => new Set())
  // Сброшенная запись уносит свои кнопки, «Сбросить всё» — себя: фокус — на пульт.
  const keepFocus = () => requestAnimationFrame(() => popupRef.current?.focus())

  return (
    <Popover.Root
      open={open}
      onOpenChange={next => {
        if (next) setNotFound(new Set())
        onOpenChange(next)
      }}
    >
      <ToolbarButton
        ref={triggerRef}
        label={label}
        icon={icon}
        active={count > 0}
        count={count}
        indicatorTone="draft"
        data-testid="unsaved-changes-button"
        render={<Popover.Trigger />}
      />
      <Popover.Portal>
        <PopupSurface
          positioner={<Popover.Positioner side="bottom" align="end" />}
          popup={
            <Popover.Popup
              aria-label={unsavedChangesLabels(labels).unsavedChanges}
              ref={popupRef}
              finalFocus={triggerRef}
              data-testid="unsaved-changes"
            />
          }
          className={styles.popup}
        >
          <PopupPanel title={unsavedChangesLabels(labels).unsavedChanges}>
            <DraftList
              table={table}
              onDiscarded={keepFocus}
              onDone={() => onOpenChange(false)}
              notFound={notFound}
              onNotFound={key => {
                setNotFound(prev => new Set(prev).add(key))
                announceLabel(
                  table,
                  all => unsavedChangesLabels(all).targetNotFound,
                )
              }}
            />
          </PopupPanel>
        </PopupSurface>
      </Popover.Portal>
    </Popover.Root>
  )
}
