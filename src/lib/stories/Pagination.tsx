import { Grid, PaginationRow } from './_shims'

import { StoryProps } from './DataGridStory.types'

export interface PaginationProps {
  currentPage: number
  recordsOnPage: number
  totalPageAmount: number
  totalRecordsAmount: number

  updateArgs: StoryProps['updateArgs']
}

export const Pagination = ({
  currentPage,
  recordsOnPage,
  totalPageAmount,
  totalRecordsAmount,
  updateArgs,
}: PaginationProps) => {
  return (
    <Grid
      container
      justify="center"
      alignItems="center"
      style={{ padding: 16 }}
    >
      <PaginationRow
        paging={{
          recordsOnPage,
          currentPage,
          totalPageAmount,
          totalRecordsAmount,
        }}
        onChangePage={(_, page) => {
          updateArgs({
            page: page - 1,
          })
        }}
        onChangeRowsNumber={e => {
          updateArgs({
            recordsOnPage: e.target.value as number,
          })
        }}
        recordsOnPageVariables={[5]}
      />
    </Grid>
  )
}
