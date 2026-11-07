// @vitest-environment happy-dom
/**
 * Результат предиката плагина (ADR 0193, RP1): после новой версии отрисовки компонент
 * пересчитывает результат и перерисовывается, только если он изменился.
 * Запуск: npx vitest run --config vitest.node.config.ts predicateResult
 */
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'

import {
  PluginRenderVersionContext,
  createRenderVersion,
  usePredicateResult,
} from '../core/renderVersion'
;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

describe('usePredicateResult (ADR 0193)', () => {
  it('RP1: после новой ссылки на предикат хук пересчитывает результат и перерисовывает компонент, только если результат изменился; новый результат виден до кадра', () => {
    const version = createRenderVersion()
    let answer = 'a'
    let renders = 0
    const Reader = () => {
      renders++
      const value = usePredicateResult(() => answer)
      return createElement('span', { 'data-value': value })
    }
    const host = document.createElement('div')
    const root = createRoot(host)
    act(() =>
      root.render(
        createElement(
          PluginRenderVersionContext.Provider,
          { value: version },
          createElement(Reader),
        ),
      ),
    )
    const shown = () => host.querySelector('span')!.getAttribute('data-value')
    expect(shown()).toBe('a')
    const mounted = renders

    // Новая ссылка, ответ прежний: перерисовки нет.
    act(() => version.set(v => v + 1))
    expect(renders).toBe(mounted)

    // Ответ сменился: перерисовка с новым ответом в том же обновлении.
    answer = 'b'
    act(() => version.set(v => v + 1))
    expect(renders).toBe(mounted + 1)
    expect(shown()).toBe('b')
    act(() => root.unmount())
  })
})
