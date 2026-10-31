/**
 * Таблица `useCreateTable` без DOM — серверным рендером (EV4): стражам контракта нужен живой
 * экземпляр, а файловые помощники стражей работают только в node.
 */
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'

import { useCreateTable } from '../core/useCreateTable'

export type HostTable = ReturnType<typeof useCreateTable<any, readonly []>>

/** Экземпляр таблицы после одного рендера с параметрами `useCreateTable`. */
export const hostTable = (params: Record<string, unknown>): HostTable => {
  let table: HostTable | undefined
  const Host = () => {
    table = useCreateTable({
      data: [{ id: 'r1', name: 'Alice' }],
      ...params,
    } as never) as HostTable
    return null
  }
  renderToString(createElement(Host))
  return table!
}
