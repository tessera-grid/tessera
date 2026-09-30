/**
 * Версия отрисовки предикатов плагинов (ADR 0039, RX2, RX11): растёт, когда у
 * аргумента из `refreshOn` новая ссылка на функцию. Ячейки подписаны на неё через
 * контекст — смена предиката перерисовывает их сразу, мимо мемоизации. Модели и
 * колонки от неё не зависят.
 */
import { createContext, useContext } from 'react'

export const PluginRenderVersionContext = createContext(0)

export const usePluginRenderVersion = (): number =>
  useContext(PluginRenderVersionContext)
