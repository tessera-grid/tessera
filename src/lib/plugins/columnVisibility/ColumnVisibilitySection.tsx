/**
 * Раздел «Колонки» «Настроек вида» (ADR 0215, §3): прежнее меню колонок — поиск, «Все колонки», дерево,
 * ластик. Ленивый модуль раздела; фокус при входе — на поле поиска (VW7). Каждое открытие
 * раздела — свой сеанс меню: подсказки «остаются» прошлого открытия не переживают (ADR 0204, HT6).
 */
import { useEffect, useRef } from 'react'

import type { ViewSettingsPanelProps } from '../../core/viewSettings'
import type { Table } from '../../types'
import { ColumnVisibilityMenu } from './ColumnVisibilityMenu'

export const ColumnVisibilitySection = ({ table }: ViewSettingsPanelProps) => {
  const searchRef = useRef<HTMLInputElement>(null)
  useEffect(() => searchRef.current?.focus(), [])
  return (
    <div data-testid="column-visibility-menu" data-open="">
      <ColumnVisibilityMenu
        table={table as Table<any, any>}
        searchRef={searchRef}
      />
    </div>
  )
}
