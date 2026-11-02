import { createContext, useContext } from 'react'

/** Запись значения ячейки в данные истории — для своих ячеек демо (ADR 0176). */
export type WriteStoryCell = (
  rowId: string,
  columnId: string,
  value: unknown,
) => void

export const StoryRowsContext = createContext<WriteStoryCell>(() => {})

export const useWriteStoryCell = () => useContext(StoryRowsContext)
