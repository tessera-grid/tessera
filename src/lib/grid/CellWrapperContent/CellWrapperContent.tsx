import { PropsWithChildren, memo } from 'react'

import clsx from 'clsx'

import cellWrapperStyles from './CellWrapperContent.module.css'

export interface CellWrapperContentProps {
  flex?: 'center' | 'end'
  smallPadding?: boolean
  noPadding?: boolean
}

/** Классы обёртки содержимого ячейки: ячейка тела рисует её разметкой, без компонента (ADR 0208). */
export const cellWrapperClassName = ({
  flex,
  smallPadding,
  noPadding,
}: CellWrapperContentProps) =>
  clsx('data-grid__cell-wrapper-content', cellWrapperStyles.cell__wrapper, {
    [cellWrapperStyles['cell__wrapper--flexCenter']]: flex === 'center',
    [cellWrapperStyles['cell__wrapper--flexEnd']]: flex === 'end',
    [cellWrapperStyles['cell__wrapper--small-padding']]: smallPadding,
    [cellWrapperStyles['cell__wrapper--no-padding']]:
      !smallPadding && noPadding,
  })

/**
 * @description
 * Компонент-обертка над контентом ячейки. Включает в себя стилизацию обертки в зависимости от стилей родительских компонентов.
 */
export const CellWrapperContent = memo(
  ({ children, ...props }: PropsWithChildren<CellWrapperContentProps>) => (
    <div className={cellWrapperClassName(props)}>{children}</div>
  ),
)

CellWrapperContent.displayName = 'CellWrapperContent'
