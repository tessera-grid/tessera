/**
 * Версия отрисовки предикатов плагинов (ADR 0039, RX2, RX11; ADR 0171, §3): растёт, когда у
 * аргумента из `refreshOn` новая ссылка на функцию. Атом поднимает эффект коммита, ячейки
 * подписаны на него — смена предиката перерисовывает их до кадра, мимо мемоизации и без
 * перерисовки хоста. Модели и колонки от неё не зависят.
 */
import { createContext, useContext } from 'react'

import { createAtom, useSelector } from '@tanstack/react-store'

export type RenderVersionAtom = ReturnType<typeof createAtom<number>>

export const createRenderVersion = (): RenderVersionAtom => createAtom(0)

/** Версия без хранилища аргументов: таблица собрана не `useCreateTable`. */
export const NO_RENDER_VERSION = createRenderVersion()

export const PluginRenderVersionContext =
  createContext<RenderVersionAtom>(NO_RENDER_VERSION)

export const usePluginRenderVersion = (): number =>
  useSelector(useContext(PluginRenderVersionContext))
