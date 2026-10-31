// ActionMenuSections: меню действий грида с разделами (ADR 0079) — состояние разделов ядра
// в виде кита `MenuSections`, пункты уровня — `ActionMenuItems`.
import { sourceOf } from '../../core/debugActions'
import type { MenuSections } from '../../core/headerActions'
import { useLocalization } from '../../core/localization'
import { MenuSections as MenuSectionsView } from '../../ui/Popup/MenuSections'
import { ActionMenuItems, type ActionMenuItemsProps } from './ActionMenuItems'

interface ActionMenuSectionsProps extends Omit<
  ActionMenuItemsProps,
  'actions' | 'sections'
> {
  sections: MenuSections
}

export const ActionMenuSections = ({
  sections,
  ...items
}: ActionMenuSectionsProps) => {
  const labels = useLocalization()
  return (
    <MenuSectionsView
      sections={sections}
      backLabel={labels.menuBack(sections.level.title ?? '')}
      failedLabel={labels.sectionLoadFailed}
      onBack={event => sections.back(sourceOf(event))}
    >
      {(actions, closeOnSelect) => (
        <ActionMenuItems
          {...items}
          actions={actions}
          sections={sections}
          closeOnSelect={closeOnSelect}
        />
      )}
    </MenuSectionsView>
  )
}
