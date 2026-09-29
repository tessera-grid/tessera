/**
 * Слот-машинерия (сборка/регистрация). Чистые `createEmptyRenderSlots`/
 * `registerSlotInto` — реактивная свёртка слотов из активных плагинов.
 */
import type { PluginSlot, RegisterSlotParams, RenderSlots } from './types'

export type {
  RenderSlots,
  RegisterSlotParams,
  HeaderSlot,
  CellSlot,
  ToolbarSlot,
  PluginSlot,
  HeaderComponentProps,
  CellComponentProps,
  ToolbarComponentProps,
} from './types'

/** Пустой набор слотов — база, в которую ядро сворачивает объявления плагинов. */
export const createEmptyRenderSlots = (): RenderSlots => ({
  leftHeaderSlot: [],
  rightHeaderSlot: [],
  leftCellSlot: [],
  rightCellSlot: [],
  cellSlot: [],
  actionRowSlot: [],
  toolbarSlot: [],
})

/**
 * Регистрирует слот в переданный `RenderSlots` (чистая операция). Дедуплицирует
 * по `id` в пределах слота: повторная регистрация обновляет запись на месте,
 * иначе вставляет по `order` (число — индекс splice) или пушит в конец.
 */
export const registerSlotInto = (
  slots: RenderSlots,
  {
    id,
    order,
    visible = true,
    slot,
    render,
    component,
    countsAsHeaderAction,
    group,
    pluginId,
  }: PluginSlot,
) => {
  const currentSlot = slots[slot]

  const pluginIndexInSlot = currentSlot.findIndex(plugin => plugin.id === id)

  if (pluginIndexInSlot !== -1) {
    currentSlot[pluginIndexInSlot].visible = visible
    currentSlot[pluginIndexInSlot].render = render
    currentSlot[pluginIndexInSlot].component = component
    currentSlot[pluginIndexInSlot].countsAsHeaderAction = countsAsHeaderAction
    currentSlot[pluginIndexInSlot].group = group
    currentSlot[pluginIndexInSlot].pluginId = pluginId

    return
  }

  const entry: RegisterSlotParams<any> = {
    id,
    order,
    render,
    component,
    countsAsHeaderAction,
    group,
    pluginId,
  }

  if (order === undefined || order === 'last') {
    currentSlot.push(entry)
  } else {
    currentSlot.splice(order, 0, entry)
  }
}

/**
 * Императивная регистрация слота на инстансе таблицы (generic-escape для
 * пользовательских плагинов). Реактивное появление слота обеспечивает
 * декларативный `slots` записи реестра; это — не реактивный запасной путь.
 */
export const registerSlot = ({
  table,
  ...params
}: PluginSlot & {
  table: { getRenderSlots: () => RenderSlots | undefined }
}) => {
  const slots = table.getRenderSlots()

  if (slots) {
    registerSlotInto(slots, params)
  }
}
