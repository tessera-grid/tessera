/**
 * Встроенные плагины — все фабрики входа `@mstrvtt/tessera/plugins` (ADR 0036).
 * Перечисляются по экспортам, а не списком: новый плагин попадает в контрактные
 * тесты (PQ1, PQ4) сам.
 */
import * as plugins from '../plugins'

type Entry = { id: string; diagnose?: unknown }

const isEntry = (value: unknown): value is Entry =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Entry).id === 'string'

export const builtinPluginEntries = (): Entry[] =>
  Object.values(plugins).flatMap(value => {
    if (typeof value !== 'function') return []
    try {
      const entry = (value as () => unknown)()
      return isEntry(entry) ? [entry] : []
    } catch {
      return []
    }
  })
