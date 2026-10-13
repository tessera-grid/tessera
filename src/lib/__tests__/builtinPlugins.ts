/**
 * Встроенные плагины — все фабрики входа `@tessera-grid/tessera/plugins` (ADR 0036).
 * Перечисляются по экспортам, а не списком: новый плагин попадает в контрактные
 * тесты (PQ1, PQ4) сам.
 */
import * as plugins from '../plugins'

type Entry = { id: string; diagnose?: unknown }

const isEntry = (value: unknown): value is Entry =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Entry).id === 'string'

const entryOf = (value: unknown): Entry | undefined => {
  if (typeof value !== 'function') return undefined
  try {
    const entry = (value as () => unknown)()
    return isEntry(entry) ? entry : undefined
  } catch {
    return undefined
  }
}

export const builtinPluginEntries = (): Entry[] =>
  Object.values(plugins).flatMap(value => entryOf(value) ?? [])

/** Имена экспортов-фабрик входа `/plugins` (ADR 0106). */
export const pluginFactoryNames = (): string[] =>
  Object.entries(plugins).flatMap(([name, value]) =>
    entryOf(value) ? [name] : [],
  )
