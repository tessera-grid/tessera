/**
 * Поле поиска вариантов с кнопкой очистки (ADR 0048; ADR 0175, ED26): у панели фильтра
 * вариантов и редакторов `select`, `object`, `multiSelect`. Поле — своё у каждого, обёртка
 * ставит рядом крестик, пока в поле есть текст.
 */
import type { ReactNode } from 'react'

import { useLocalization } from '../../core/localization'
import { useIcons } from '../../ui/icons'

import styles from './OptionChecklist.module.css'
import { optionsLabels } from './labels'

export const OptionSearch = ({
  children,
  value,
  onClear,
  clearTestId,
}: {
  children: ReactNode
  value: string
  onClear: () => void
  clearTestId?: string
}) => {
  const labels = useLocalization()
  const { clear: ClearIcon } = useIcons()
  return (
    <div className={styles.searchRow}>
      {children}
      {value !== '' && (
        <button
          type="button"
          className={styles.clearSearch}
          aria-label={optionsLabels(labels).clearSearch}
          data-testid={clearTestId}
          onClick={onClear}
        >
          <ClearIcon width={14} height={14} aria-hidden />
        </button>
      )}
    </div>
  )
}
