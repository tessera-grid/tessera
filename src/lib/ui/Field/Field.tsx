/**
 * Поле ввода кита (ADR 0183, PK5, PK12): поле, текст ошибки под ним и поле поиска с лупой,
 * крестиком очистки и кнопкой-подсказкой. Поле рисуется и поверх поля примитива Base UI
 * (тулбара, комбобокса) через `render`.
 */
import type {
  HTMLAttributes,
  InputHTMLAttributes,
  ReactElement,
  ReactNode,
} from 'react'
import { forwardRef } from 'react'

import { useRender } from '@base-ui/react/use-render'
import clsx from 'clsx'

import { IconButton } from '../IconButton'
import { useIcons } from '../icons'

import styles from './Field.module.css'

export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Элемент поля; по умолчанию `<input>`. */
  render?: ReactElement
  /** Значение не принято: рамка цветом ошибки, `aria-invalid`. */
  invalid?: boolean
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(
  ({ render, invalid, className, ...rest }, ref) =>
    useRender({
      render,
      ref,
      defaultTagName: 'input',
      props: {
        ...rest,
        'aria-invalid': invalid || rest['aria-invalid'] || undefined,
        className: clsx(styles.field, className),
      },
    }),
)
Field.displayName = 'Field'

export interface FieldErrorProps extends HTMLAttributes<HTMLSpanElement> {
  /** В ячейке: мельче и в одну строку. */
  compact?: boolean
}

/** Текст ошибки под полем; поле ссылается на его `id` через `aria-describedby`. */
export const FieldError = ({
  compact,
  className,
  ...rest
}: FieldErrorProps) => (
  <span
    {...rest}
    data-compact={compact || undefined}
    className={clsx(styles.error, className)}
  />
)

export interface SearchFieldButton {
  label: string
  /** Элемент кнопки в композите — кнопка тулбара Base UI. */
  render?: ReactElement
  'data-testid'?: string
}

export interface SearchFieldProps {
  /** Лупа слева. */
  icon?: ReactNode
  /** Крестик очистки — пока в поле есть текст. */
  clear?: SearchFieldButton & { onClick: () => void }
  /** Кнопка-подсказка: что ищет поле. */
  hint?: SearchFieldButton & { icon: ReactNode }
  className?: string
  /** Поле — `Field`. */
  children: ReactNode
}

export const SearchField = ({
  icon,
  clear,
  hint,
  className,
  children,
}: SearchFieldProps) => {
  const { clear: ClearIcon } = useIcons()
  const buttons = (clear ? 1 : 0) + (hint ? 1 : 0)
  return (
    <div
      className={clsx(styles.search, className)}
      data-icon={icon ? '' : undefined}
      data-buttons={buttons || undefined}
    >
      {icon && (
        <span className={styles.searchIcon} aria-hidden>
          {icon}
        </span>
      )}
      {children}
      {buttons > 0 && (
        <span className={styles.searchButtons}>
          {hint && (
            <IconButton
              shape="square"
              size="compact"
              label={hint.label}
              render={hint.render}
              data-testid={hint['data-testid']}
            >
              {hint.icon}
            </IconButton>
          )}
          {clear && (
            <IconButton
              shape="square"
              size="compact"
              label={clear.label}
              render={clear.render}
              onClick={clear.onClick}
              data-testid={clear['data-testid']}
            >
              <ClearIcon />
            </IconButton>
          )}
        </span>
      )}
    </div>
  )
}
