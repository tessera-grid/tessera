/**
 * Кнопка «Настройки вида» в тулбаре (ADR 0215, §2): разделы плагинов из факта ядра `viewSettingsSections`, бабл —
 * число активных разделов. Поповер грузится лениво; пока модуль не пришёл, стоит та же кнопка без
 * Base UI Popover (ADR 0061). Пока колонки не пришли с сервера — скелет (ADR 0122).
 */
import type { ToolbarComponentProps } from '../../core/createSlots'
import { useLazyPopover } from '../../core/lazyOpening'
import { useLocalization } from '../../core/localization'
import { useTableState } from '../../core/reactivity'
import { isWaitingForColumns } from '../../core/skeletonOptions'
import { dataColumnsOf } from '../../core/stubs'
import {
  shownViewSettingsSections,
  viewSettingsSectionsOf,
} from '../../core/viewSettings'
import { useIcons } from '../../ui/icons'
import { ToolbarButton, ToolbarSkeleton } from '../../ui/ToolbarButton'
import { preloadable } from '../../util/preloadable'

const ViewSettingsPopover = preloadable(() =>
  import('./ViewSettingsPopover').then(module => module.ViewSettingsPopover),
)

/** Срезы, на которые подписаны разделы: кнопку будят только они (VW11). */
const slicesOf = (table: unknown) => [
  ...new Set(viewSettingsSectionsOf(table).flatMap(section => section.slices)),
]

export const ViewSettingsButton = ({ table }: ToolbarComponentProps) => {
  const labels = useLocalization()
  const { viewSettings: ViewIcon } = useIcons()
  const slices = slicesOf(table)
  useTableState(table, state =>
    slices.map(slice => (state as unknown as Record<string, unknown>)[slice]),
  )
  const active = shownViewSettingsSections(table).filter(section =>
    section.active(table),
  ).length
  const label =
    active > 0 ? labels.viewSettingsActive(active) : labels.viewSettings
  const icon = <ViewIcon width={16} height={16} />
  const popover = useLazyPopover(
    table,
    ViewSettingsPopover,
    all => all.viewSettings,
    true,
    {
      plugin: 'core',
      detail: () => ({ menu: 'view' }),
    },
  )

  if (isWaitingForColumns(table)) {
    return <ToolbarSkeleton data-testid="view-settings-skeleton" />
  }

  // Колонок нет совсем — настраивать нечего (ADR 0123, ES10).
  if (dataColumnsOf(table).length === 0) {
    return (
      <ToolbarButton
        label={label}
        icon={icon}
        disabled
        data-testid="view-settings-button"
      />
    )
  }

  const placeholder = (
    <ToolbarButton
      label={label}
      icon={icon}
      active={active > 0}
      count={active}
      aria-haspopup="dialog"
      data-testid="view-settings-button"
      {...popover.trigger}
    />
  )
  if (!popover.ready) return placeholder

  return (
    <ViewSettingsPopover.Component
      fallback={placeholder}
      table={table}
      label={label}
      icon={icon}
      count={active}
      open={popover.open}
      onOpenChange={popover.onOpenChange}
    />
  )
}
