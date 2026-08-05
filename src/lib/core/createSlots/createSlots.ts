import { useMemo } from 'react'

import { RenderSlots } from './types'

export const useCreateSlots = (): RenderSlots =>
  useMemo(
    () => ({
      leftHeaderSlot: [],
      rightCellSlot: [],
      leftCellSlot: [],
      rightHeaderSlot: [],
      actionRowSlot: [],
    }),
    [],
  )
