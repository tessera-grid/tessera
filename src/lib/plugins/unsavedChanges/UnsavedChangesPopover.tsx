/**
 * Поповер пульта черновиков (ADR 0178, §8; DR11, DR42–DR47): изменения данных облачками в порядке
 * появления, черновики колонок — разделом ниже; у записи «Применить» и «Откатить», нажатие на неё
 * показывает цель; внизу «Применить всё» и «Отменить всё». Переход и применение закрывают пульт. Отдельный чанк: открытием управляет эагерная кнопка (`UnsavedChangesButton`).
 */
import { type ReactNode, useId, useRef } from 'react'

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
  discardDraft,
  useOpenDrafts,
} from '../../core/drafts/drafts'
import { PopupFooter, PopupPanel } from '../../ui/Popup/PopupPanel'
import { PopupSurface } from '../../ui/Popup/PopupSurface'
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
import hidden from '../../ui/visuallyHidden.module.css'
import { ToolbarButton } from '../../ui/ToolbarButton'
import {
  canShowTarget,
  objectTargetText,
  showTarget,
} from '../../shared/objectTarget'

import { type DraftSection, draftSections } from './sections'
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
  return (
    <>
      <span className={hidden['visually-hidden']} data-visually-hidden="">
        {labels.draftWas}{' '}
      </span>
      {was}
      <span aria-hidden> → </span>
      <span className={hidden['visually-hidden']} data-visually-hidden="">
        {' '}
        {labels.draftNow}{' '}
      </span>
      {now}
    </>
  )
}

interface EntryHandlers {
  /** Черновик снят: его кнопки ушли вместе с фокусом. */
  onDiscarded: () => void
  /** Переход к цели и «Применить» закрывают пульт. */
  onDone: () => void
}

const DraftEntry = ({
  table,
  draft,
  onDiscarded,
  onDone,
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
              onDone()
              void showTarget(table, draft.target, 'arrived')
            }
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

const EntryList = ({
  table,
  drafts,
  ...handlers
}: { table: unknown; drafts: readonly Draft[] } & EntryHandlers &
  ({ 'aria-label': string } | { 'aria-labelledby': string })) => {
  const { onDiscarded, onDone, ...named } = handlers
  return (
    <div role="list" className={styles.list} {...named}>
      {drafts.map(draft => (
        <div
          key={draftKeyOf(draft.kind, draft.target)}
          role="listitem"
          data-draft-kind={draft.kind}
        >
          <DraftEntry
            table={table}
            draft={draft}
            onDiscarded={onDiscarded}
            onDone={onDone}
          />
        </div>
      ))}
    </div>
  )
}

/** Раздел черновиков с целью-колонкой: заголовок вида и его записи (DR44). */
const Section = ({
  table,
  section,
  ...handlers
}: { table: unknown; section: DraftSection } & EntryHandlers) => {
  const labels = useLocalization()
  const id = useId()
  const kind = draftKindOf(table, section.kind)
  return (
    <>
      <p id={id} className={styles.sectionTitle}>
        {kind?.sectionLabel?.(labels) ??
          (kind && draftKindLabel(table, kind, labels))}
      </p>
      <EntryList
        table={table}
        drafts={section.drafts}
        aria-labelledby={id}
        {...handlers}
      />
    </>
  )
}

const DraftList = ({
  table,
  onDiscarded,
  onDone,
}: { table: unknown } & EntryHandlers) => {
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
  const scrollerRef = useScrollFade<HTMLDivElement>()
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
  const { data, sections } = draftSections(drafts)
  const handlers = { onDiscarded, onDone }
  return (
    <>
      <div ref={scrollerRef} className={styles.scroller} data-popup-scroller="">
        {data.length > 0 && (
          <EntryList
            table={table}
            drafts={data}
            aria-label={unsavedChangesLabels(labels).unsavedChanges}
            {...handlers}
          />
        )}
        {sections.map(section => (
          <Section
            key={section.kind}
            table={table}
            section={section}
            {...handlers}
          />
        ))}
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
  // Отброшенная запись уносит свои кнопки, «Отменить всё» — себя: фокус — на пульт.
  const keepFocus = () => requestAnimationFrame(() => popupRef.current?.focus())

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
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
            />
          </PopupPanel>
        </PopupSurface>
      </Popover.Portal>
    </Popover.Root>
  )
}
