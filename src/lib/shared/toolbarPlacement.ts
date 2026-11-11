/**
 * Место кнопки плагина в тулбаре (ADR 0205): аргумент `toolbar` фабрики перекрывает группу,
 * порядок и сторону её слота, незаданное поле — прежнее; `false` — кнопки нет. Раскладка — по
 * правилам ADR 0051.
 */
import type { RegisterSlotParams } from '../core/createSlots'
import type { ToolbarPlacement } from '../core/toolbar'

export type { ToolbarPlacement }

/** Аргумент фабрики с кнопкой тулбара. */
export interface ToolbarPlacementOption {
  /** Место встроенной кнопки в тулбаре; `false` — без кнопки (ADR 0205). */
  toolbar?: ToolbarPlacement | false
}

/** Слот кнопки по аргументу `toolbar`: с его полями поверх своих или ни одного. */
export const placeToolbarSlot = <
  const S extends RegisterSlotParams<any> & { slot: 'toolbarSlot' },
>(
  slot: S,
  toolbar: ToolbarPlacement | false | undefined,
): S[] => {
  if (toolbar === false) return []
  if (!toolbar) return [slot]
  const { group, order, align } = toolbar
  return [
    {
      ...slot,
      ...(group !== undefined && { group }),
      ...(order !== undefined && { order }),
      ...(align !== undefined && { align }),
    },
  ]
}

/** У плагина есть своя кнопка в тулбаре: слот не снят аргументом `toolbar: false`. */
export const hasOwnToolbarSlot = (table: unknown, pluginId: string) => {
  const slots = (
    table as {
      getRenderSlots?: () =>
        { toolbarSlot?: readonly { pluginId?: string }[] } | undefined
    }
  ).getRenderSlots?.()
  // Таблица без свёрнутых слотов (стенд без отрисовки) о кнопке не знает — не снята.
  if (!slots) return true
  return (slots.toolbarSlot ?? []).some(slot => slot.pluginId === pluginId)
}
