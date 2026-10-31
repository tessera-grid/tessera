import { CellWrapperContentProps } from './CellWrapperContent'

export interface GetAlignContentParams {
  isActionsColumn: boolean
  /** Колонка зоны действий строки: `fill` записи `ServiceColumn` (ADR 0165). */
  isFillColumn: boolean
}

export const getAlignContent = ({
  isActionsColumn,
  isFillColumn,
}: GetAlignContentParams): CellWrapperContentProps['flex'] => {
  if (isActionsColumn && !isFillColumn) {
    return 'center'
  }

  if (isFillColumn) {
    return 'end'
  }

  return undefined
}
