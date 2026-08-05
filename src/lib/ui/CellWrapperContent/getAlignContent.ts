import { CellWrapperContentProps } from './CellWrapperContent'

export interface GetAlignContentParams {
  isActionsColumn: boolean
  isRowActionsColumn: boolean
}

export const getAlignContent = ({
  isActionsColumn,
  isRowActionsColumn,
}: GetAlignContentParams): CellWrapperContentProps['flex'] => {
  if (isActionsColumn && !isRowActionsColumn) {
    return 'center'
  }

  if (isRowActionsColumn) {
    return 'end'
  }

  return undefined
}
