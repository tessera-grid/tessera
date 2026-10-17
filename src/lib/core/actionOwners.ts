/**
 * Владелец декларативного действия (ADR 0125, AL4): `id` записи плагина, из которой ядро
 * собрало слот-, клавиатурное или контекстное действие. Описатель не меняется — владелец
 * запоминается рядом.
 */
const owners = new WeakMap<object, string>()

export const setActionOwner = (action: object, pluginId: string): void => {
  owners.set(action, pluginId)
}

/** `id` плагина-владельца; действие не из записи плагина — ядра. */
export const actionOwnerOf = (action: object): string =>
  owners.get(action) ?? 'core'

/** Цель действия для канала: колонка и строка контекста, если они есть. */
export const actionDetailOf = (
  ctx: unknown,
): Record<string, string> | undefined => {
  const context = ctx as
    { column?: { id?: string }; row?: { id?: string } } | undefined
  const column = context?.column?.id
  const row = context?.row?.id
  if (column === undefined && row === undefined) return undefined
  return {
    ...(column !== undefined && { column }),
    ...(row !== undefined && { row }),
  }
}
