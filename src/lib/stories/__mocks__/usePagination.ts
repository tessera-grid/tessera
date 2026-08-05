import { useEffect, useMemo, useState } from 'react'

import { StoryProps } from '../DataGrid.stories'

export interface UsePaginationParams {
  data: any[]
  page: number
  recordsOnPage: number
  updateArgs: StoryProps['updateArgs']
}

export const usePagination = ({
  data,
  page,
  recordsOnPage,
  updateArgs,
}: UsePaginationParams) => {
  const slicedData = useMemo(
    () => data.slice(page * recordsOnPage, (page + 1) * recordsOnPage),
    [data, page, recordsOnPage],
  )

  const [dataOnPage, setDataOnPage] = useState(slicedData)

  useEffect(() => {
    setDataOnPage(slicedData)
  }, [slicedData])

  useEffect(() => {
    if (dataOnPage.length === 0) {
      updateArgs({
        page: 0,
      })
    }
  }, [dataOnPage.length, updateArgs])

  return { dataOnPage, setDataOnPage }
}
