/**
 * Поповер пульта черновиков (ADR 0178, §8; DR11): черновики в порядке появления — подпись вида,
 * значение и цель; у записи — «Показать», «Применить», «Отбросить»; внизу «Применить всё» и
 * «Отменить всё». «Показать» и применение закрывают пульт. Отдельный чанк: открытием управляет
 * эагерная кнопка (`UnsavedChangesButton`).
 */
import { type ReactNode, useRef } from 'react'

import { Popover } from '@base-ui/react/popover'
import clsx from 'clsx'

import {
  applyAllDrafts,
  applyDraft,
  DRAFTS_KEY,
  type Draft,
  draftKeyOf,
  draftKindOf,
  draftKindsOf,
  discardDraft,
  useOpenDrafts,
} from '../../core/drafts/drafts'
import { reportAction, userSourceOf } from '../../core/debugActions'
import { useLocalization } from '../../core/localization'
import { useSliceProjection } from '../../core/reactivity'
import { Button } from '../../ui/Button'
import { IconButton } from '../../ui/IconButton'
import { Stub } from '../../ui/Stub'
import { useIcons } from '../../ui/icons'
import { POPUP_SIDE_OFFSET } from '../../ui/Popup/offset'
import { usePortalThemeClass, usePortalThemeData } from '../../ui/theme'
import { ToolbarButton } from '../../ui/ToolbarButton'
import {
  canShowTarget,
  objectTargetText,
  showTarget,
} from '../../shared/objectTarget'

import styles from './UnsavedChanges.module.css'

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

const DraftEntry = ({
  table,
  draft,
  onDiscarded,
  onDone,
}: {
  table: unknown
  draft: Draft
  /** Запись отброшена: её кнопки ушли вместе с фокусом. */
  onDiscarded: () => void
  /** «Показать» и «Применить» уводят к цели — пульт закрывается. */
  onDone: () => void
}) => {
  const labels = useLocalization()
  const icons = useIcons()
  const kind = draftKindOf(table, draft.kind)
  if (!kind) return null
  const target = objectTargetText(table, draft.target, labels)
  return (
    <>
      <span className={styles.label}>{kind.label(labels, draft)}</span>
      {kind.describe && (
        <span className={styles.value}>
          {kind.describe(labels, draft, table)}
        </span>
      )}
      <div className={styles.foot}>
        <span className={styles.target}>{target}</span>
        <div className={styles.actions}>
          {canShowTarget(draft.target) && (
            <IconButton
              shape="square"
              label={labels.draftShow}
              data-action="show"
              onClick={event => {
                report(table, 'show', draft, event)
                onDone()
                void showTarget(table, draft.target, 'arrived')
              }}
            >
              <icons.failureShow />
            </IconButton>
          )}
          <IconButton
            shape="square"
            label={labels.draftApply}
            data-action="apply"
            onClick={event => {
              report(table, 'apply', draft, event)
              onDone()
              void applyDraft(table, draft)
            }}
          >
            <icons.draftApply />
          </IconButton>
          <IconButton
            shape="square"
            label={labels.draftDiscard}
            data-action="discard"
            onClick={event => {
              report(table, 'discard', draft, event)
              discardDraft(table, draft)
              onDiscarded()
            }}
          >
            <icons.draftDiscard />
          </IconButton>
        </div>
      </div>
    </>
  )
}

const DraftList = ({
  table,
  onDiscarded,
  onDone,
}: {
  table: unknown
  onDiscarded: () => void
  onDone: () => void
}) => {
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
  if (drafts.length === 0 && open === 0)
    return (
      <Stub
        size="compact"
        media={<icons.unsavedChangesEmpty />}
        title={labels.unsavedChangesEmpty}
        description={labels.unsavedChangesEmptyDescription}
        data-testid="unsaved-changes-empty"
      />
    )
  return (
    <>
      <div className={styles.scroller}>
        <div role="list" aria-label={labels.unsavedChanges}>
          {drafts.map(draft => (
            <div
              key={draftKeyOf(draft.kind, draft.target)}
              role="listitem"
              data-draft-kind={draft.kind}
              className={styles.entry}
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
      </div>
      <div className={styles.footer}>
        <Button
          variant="ghost"
          data-action="discard-all"
          onClick={event => {
            report(table, 'discardAll', undefined, event)
            for (const draft of drafts) discardDraft(table, draft)
            onDiscarded()
          }}
        >
          {labels.draftDiscardAll}
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
          {labels.draftApplyAll}
        </Button>
      </div>
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
  const themeClass = usePortalThemeClass()
  const themeData = usePortalThemeData()
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
        data-testid="unsaved-changes-button"
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
            aria-label={labels.unsavedChanges}
            ref={popupRef}
            finalFocus={triggerRef}
            className={clsx(themeClass, styles.popup)}
            data-testid="unsaved-changes"
          >
            <p className={styles.title}>{labels.unsavedChanges}</p>
            <DraftList
              table={table}
              onDiscarded={keepFocus}
              onDone={() => onOpenChange(false)}
            />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
