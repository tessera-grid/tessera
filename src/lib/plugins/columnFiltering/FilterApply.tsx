/** «Применить» панели фильтра в серверном режиме (ADR 0154): отправляет условие черновика. */
import { useLocalization } from '../../core/localization'
import { Button } from '../../ui/Button'
import { columnFilteringLabels } from './labels'

export const FilterApply = ({
  dirty,
  commit,
}: {
  dirty: boolean
  commit: () => void
}) => {
  const labels = useLocalization()
  return (
    <Button disabled={!dirty} onClick={commit} data-testid="filter-apply">
      {columnFilteringLabels(labels).filterApply}
    </Button>
  )
}
