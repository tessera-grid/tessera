import { createContext } from 'react'

import type { ConsoleLog } from './consoleLog'

/** Журнал консоли для гридов внутри `WithConsole` (ADR 0124). */
export const ConsoleContext = createContext<ConsoleLog | undefined>(undefined)
