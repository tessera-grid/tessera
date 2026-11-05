import { Skeleton } from '../Skeleton'
import styles from './ToolbarSkeleton.module.css'

const ICON = 'var(--tsr-comp-button-icon-size)'

/**
 * Скелет на месте контрола тулбара до прихода данных или колонок (ADR 0122): место — как у
 * контрола, скелет — его видимая часть. У кнопки фон прозрачный, видна иконка: квадрат
 * иконки в центре; у поля — поле целиком. В общей волне рамки; не фокусируется.
 */
export const ToolbarSkeleton = ({
  kind = 'button',
  'data-testid': testId,
}: {
  kind?: 'button' | 'field'
  'data-testid'?: string
}) =>
  kind === 'field' ? (
    <span aria-hidden data-testid={testId} className={styles.field}>
      <Skeleton
        width="var(--tsr-comp-quick-search-width)"
        height="var(--tsr-comp-toolbar-button-size)"
        className={styles.fieldBar}
      />
    </span>
  ) : (
    <span aria-hidden data-testid={testId} className={styles.button}>
      <Skeleton width={ICON} height={ICON} />
    </span>
  )
