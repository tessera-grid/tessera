/**
 * Заглушка пустой таблицы по записи реестра (ADR 0123): тексты — из `localization`,
 * иллюстрация и иконка действия — из `icons`; своя заглушка приложения из пропа
 * `stubs` заменяет вид, получая действие записи и ошибку загрузки.
 */
import { useLocalization } from '../../core/localization'
import type { StubContext, StubEntry, StubRender } from '../../core/stubs'
import { Button } from '../../ui/Button'
import { useIcons } from '../../ui/icons'
import { Stub } from '../../ui/Stub'

interface EmptyStubProps {
  entry: StubEntry
  context: StubContext
  render?: StubRender
  className?: string
}

export const EmptyStub = ({
  entry,
  context,
  render,
  className,
}: EmptyStubProps) => {
  const labels = useLocalization()
  const icons = useIcons()
  const action = entry.action?.(context, labels)
  const marks = {
    'data-testid': entry.testId ?? `${entry.id}-stub`,
    'data-stub': entry.id,
  }

  if (render !== undefined) {
    return (
      <div className={className} {...marks}>
        {typeof render === 'function'
          ? render({ action: action?.run, error: context.loadError.error })
          : render}
      </div>
    )
  }

  const Media = entry.media && icons[entry.media]
  const ActionIcon = action?.icon && icons[action.icon]
  return (
    <Stub
      className={className}
      {...marks}
      media={
        Media && (
          <span style={{ display: 'contents', color: entry.mediaColor }}>
            <Media width={entry.mediaSize} height={entry.mediaSize} />
          </span>
        )
      }
      title={entry.title(labels)}
      description={entry.description?.(context)}
      action={
        action && (
          <Button
            pending={action.pending}
            onClick={action.run}
            icon={
              ActionIcon && (
                <ActionIcon width={16} height={16} aria-hidden="true" />
              )
            }
            data-testid={action.testId}
          >
            {action.label}
          </Button>
        )
      }
    />
  )
}
