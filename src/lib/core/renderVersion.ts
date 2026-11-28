/**
 * Версия отрисовки предикатов плагинов (ADR 0039, RX2; ADR 0171, §3): растёт, когда у
 * аргумента из `refreshOn` новая ссылка на функцию. Атом поднимает эффект коммита. Читатели
 * предиката подписаны на свой ответ (ADR 0193): после новой версии пересчитывают его и
 * перерисовываются до кадра, только если он изменился. Модели и колонки от версии не зависят.
 */
import { createContext, useContext } from 'react'

import { createAtom, useSelector } from '@tanstack/react-store'

export type RenderVersionAtom = ReturnType<typeof createAtom<number>>

export const createRenderVersion = (): RenderVersionAtom => createAtom(0)

/** Версия без хранилища аргументов: таблица собрана не `useCreateTable`. */
export const NO_RENDER_VERSION = createRenderVersion()

export const PluginRenderVersionContext =
  createContext<RenderVersionAtom>(NO_RENDER_VERSION)

/** Атом версии грида: узел канала вклада берёт его в источник подписки (ADR 0193, §3). */
export const usePluginRenderVersionAtom = (): RenderVersionAtom =>
  useContext(PluginRenderVersionContext)

/**
 * A `refreshOn` predicate at render time (ADR 0193, RP1): `read` is called during render and
 * after each new version; the component re-renders only when the answer changes (`Object.is`).
 */
export const usePredicateResult = <T>(read: () => T): T =>
  useSelector(useContext(PluginRenderVersionContext), () => read(), {
    compare: Object.is,
  })
