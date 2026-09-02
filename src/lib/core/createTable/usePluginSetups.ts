import { useEffect } from 'react'

import { Table } from '@tanstack/react-table'

import { RegistryEntry } from '../pluginContract'

export interface UsePluginSetupsParams {
  table: Table<any>
  activePlugins: RegistryEntry[]
}

// Запускает `setup` всех активных плагинов (generic-escape ADR 0010) в ОДНОМ
// эффекте. Один фиксированный хук вне зависимости от длины списка — плагины
// приносят императивный сетап, не нарушая rules-of-hooks. Возвращённые cleanup'ы
// вызываются при пересборке/размонтировании.
export const usePluginSetups = ({
  table,
  activePlugins,
}: UsePluginSetupsParams) => {
  useEffect(() => {
    const cleanups = activePlugins
      .map(plugin => plugin.setup?.(table))
      .filter((cleanup): cleanup is () => void => typeof cleanup === 'function')

    return () => cleanups.forEach(cleanup => cleanup())
  }, [table, activePlugins])
}
