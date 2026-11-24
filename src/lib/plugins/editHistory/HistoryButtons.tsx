/**
 * Кнопки тулбара «Отменить» и «Повторить» (ADR 0222, §11, UD16): подсказка называет запись,
 * без записи кнопка выключена; пока шаг идёт — ожидание со «стопом». Кнопка «История» —
 * ленивый попап (ADR 0061).
 */
import type { ToolbarComponentProps } from '../../core/createSlots'
import { pluginStateKey } from '../../core/definePlugin'
import { useLazyPopover } from '../../core/lazyOpening'
import { useLocalization } from '../../core/localization'
import { keyboardShortcut, shortcutTitle } from '../../core/keyboardShortcut'
import { useSlice } from '../../core/reactivity'
import { ToolbarButton } from '../../ui/ToolbarButton'
import { preloadable } from '../../util/preloadable'
import {
  EMPTY_SLICE,
  type EditHistorySlice,
  ID,
  cancelStep,
  nextLabel,
  step,
} from './history'
import { HistoryIcon, RedoIcon, UndoIcon } from './icons'
import { editHistoryLabels } from './labels'

const useHistorySlice = (table: unknown): EditHistorySlice =>
  (useSlice(table as never, pluginStateKey(ID) as never) as
    EditHistorySlice | undefined) ?? EMPTY_SLICE

export const UndoRedoButtons = ({ table }: ToolbarComponentProps) => {
  const labels = useLocalization()
  const own = editHistoryLabels(labels)
  const slice = useHistorySlice(table)
  const undoName = nextLabel(table, 'undo', labels)
  const redoName = nextLabel(table, 'redo', labels)
  const button = (direction: 'undo' | 'redo') => {
    const name = direction === 'undo' ? undoName : redoName
    const pending = slice.running === direction
    const unavailable = !name && !pending
    const combo = direction === 'undo' ? 'Mod+Z' : 'Mod+Shift+Z'
    const text = name
      ? direction === 'undo'
        ? own.undoEntry(name)
        : own.redoEntry(name)
      : direction === 'undo'
        ? own.undo
        : own.redo
    return (
      <ToolbarButton
        key={direction}
        label={text}
        tooltip={shortcutTitle(table, labels, text, combo)}
        aria-keyshortcuts={keyboardShortcut(table, labels, combo).aria}
        icon={direction === 'undo' ? <UndoIcon /> : <RedoIcon />}
        // Кнопка остаётся в группе фокуса, поэтому состав элементов тулбара неизменен.
        aria-disabled={unavailable || undefined}
        data-disabled={unavailable || undefined}
        tooltipWhenDisabled
        pending={pending}
        onCancel={() => cancelStep(table)}
        data-testid={`${direction}-button`}
        onClick={event => {
          if (unavailable) {
            event.preventDefault()
            return
          }
          void step(table, direction, 'pointer')
        }}
      />
    )
  }
  return (
    <>
      {button('undo')}
      {button('redo')}
    </>
  )
}

const HistoryPopover = preloadable(() =>
  import('./HistoryPopover').then(module => module.HistoryPopover),
)

export const HistoryButton = ({ table }: ToolbarComponentProps) => {
  const labels = useLocalization()
  const label = editHistoryLabels(labels).history
  const popover = useLazyPopover(
    table,
    HistoryPopover,
    all => editHistoryLabels(all).history,
    true,
    { plugin: ID },
  )
  const placeholder = (
    <ToolbarButton
      label={label}
      icon={<HistoryIcon />}
      aria-haspopup="dialog"
      data-testid="edit-history-button"
      {...popover.trigger}
    />
  )
  if (!popover.ready) return placeholder
  return (
    <HistoryPopover.Component
      fallback={placeholder}
      table={table}
      label={label}
      open={popover.open}
      onOpenChange={popover.onOpenChange}
    />
  )
}
