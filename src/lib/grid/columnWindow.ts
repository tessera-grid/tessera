// Окно виртуализатора колонок для ячеек строк тела (ADR 0149, PS10): сдвиг окна при
// горизонтальной прокрутке перерисовывает только список ячеек строки, а не строку с её
// хуками и обёртками плагинов.
import { createContext } from 'react'

import type { VirtualItem } from '../../vendor/tanstack-virtual/react-virtual'

export const ColumnWindowContext = createContext<VirtualItem[] | null>(null)
