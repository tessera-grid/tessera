/**
 * Кнопка пульта черновиков в тулбаре (ADR 0178, DR11): видна всегда, бабл — число черновиков,
 * которые применимы в этой таблице; без них бабла нет. Поповер — ленивый модуль (ADR 0061).
 */
import { Suspense } from 'react'

import type { ToolbarComponentProps } from '../../core/createSlots'
import {
  DRAFTS_KEY,
  draftKindsOf,
  type Draft,
  useOpenDrafts,
} from '../../core/drafts/drafts'
import { useLazyPopover } from '../../core/lazyOpening'
import { useLocalization } from '../../core/localization'
import { preloadable } from '../../core/preloadable'
import { useSliceProjection } from '../../core/reactivity'
import { useIcons } from '../../ui/icons'
import { ToolbarButton } from '../../ui/ToolbarButton'

const UnsavedChangesPopover = preloadable(() =>
  import('./UnsavedChangesPopover').then(
    module => module.UnsavedChangesPopover,
  ),
)

export const UnsavedChangesButton = ({ table }: ToolbarComponentProps) => {
  const labels = useLocalization()
  const { unsavedChanges: UnsavedChangesIcon } = useIcons()
  const drafted = useSliceProjection(
    table,
    DRAFTS_KEY,
    (drafts: readonly Draft[] | undefined) => {
      const kinds = new Set(draftKindsOf(table).map(kind => kind.kind))
      return (drafts ?? []).filter(draft => kinds.has(draft.kind)).length
    },
  )
  // Открытая правка ячейки — тоже несохранённое изменение (ADR 0178, DR18).
  const count = drafted + useOpenDrafts(table)
  const popover = useLazyPopover(
    table,
    UnsavedChangesPopover,
    all => all.unsavedChanges,
    true,
    { plugin: 'unsavedChanges' },
  )
  const label =
    count > 0 ? labels.unsavedChangesButton(count) : labels.unsavedChanges
  const icon = <UnsavedChangesIcon width={16} height={16} />
  const placeholder = (
    <ToolbarButton
      label={label}
      icon={icon}
      active={count > 0}
      count={count}
      indicatorTone="draft"
      aria-haspopup="dialog"
      data-testid="unsaved-changes-button"
      {...popover.trigger}
    />
  )
  if (!popover.ready) return placeholder

  return (
    <Suspense fallback={placeholder}>
      <UnsavedChangesPopover.Component
        table={table}
        label={label}
        icon={icon}
        count={count}
        open={popover.open}
        onOpenChange={popover.onOpenChange}
      />
    </Suspense>
  )
}
