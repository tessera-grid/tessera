import { createContext, useContext } from 'react'

/** Шапка рисуется внутри скелета первой загрузки (ADR 0060): без кнопок плагинов. */
export const SkeletonModeContext = createContext(false)

export const useSkeletonMode = () => useContext(SkeletonModeContext)
