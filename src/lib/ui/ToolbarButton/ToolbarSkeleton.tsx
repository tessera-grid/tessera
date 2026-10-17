import { Skeleton } from '../Skeleton'

const BUTTON = 'var(--tsr-comp-toolbar-button-size)'
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
    <span aria-hidden data-testid={testId} style={{ display: 'flex' }}>
      <Skeleton
        width="var(--tsr-comp-quick-search-width)"
        height={BUTTON}
        style={{
          maxWidth: '100%',
          flex: 'none',
          borderRadius: 'var(--tsr-comp-control-radius)',
        }}
      />
    </span>
  ) : (
    <span
      aria-hidden
      data-testid={testId}
      style={{
        display: 'flex',
        flex: 'none',
        alignItems: 'center',
        justifyContent: 'center',
        width: BUTTON,
        height: BUTTON,
      }}
    >
      <Skeleton width={ICON} height={ICON} />
    </span>
  )
