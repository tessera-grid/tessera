import { RenderSlots } from './types'

/** Пустой набор слотов — база, в которую ядро сворачивает объявления плагинов. */
export const createEmptyRenderSlots = (): RenderSlots => ({
  leftHeaderSlot: [],
  rightCellSlot: [],
  leftCellSlot: [],
  rightHeaderSlot: [],
  actionRowSlot: [],
})
