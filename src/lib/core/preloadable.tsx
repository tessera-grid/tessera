import { type ComponentType, lazy, useEffect, useState } from 'react'

const noop = () => {}

/**
 * Ленивый компонент с явной загрузкой: после `load()` рисуется синхронно, без
 * Suspense-фолбэка — у `React.lazy` первый рендер приостанавливается всегда. До
 * загрузки `Component` приостанавливается как `React.lazy`.
 *
 * `load()` грузит один раз и помнит исход, в том числе ошибку; `reload()` после
 * ошибки пробует снова — для явного действия пользователя (ADR 0061).
 */
export function preloadable<P extends object>(
  factory: () => Promise<ComponentType<P>>,
) {
  let loaded: ComponentType<P> | undefined
  let pending: Promise<ComponentType<P>> | undefined
  let failed = false

  const load = () => {
    if (!pending) {
      failed = false
      pending = factory().then(
        component => (loaded = component),
        error => {
          failed = true
          throw error
        },
      )
      pending.catch(noop)
    }
    return pending
  }

  const reload = () => {
    if (failed) pending = undefined
    return load()
  }

  const Lazy = lazy(() => load().then(component => ({ default: component })))

  const Component = (props: P) => {
    const Loaded = loaded ?? Lazy
    return <Loaded {...props} />
  }

  return { load, reload, isLoaded: () => !!loaded, Component }
}

export interface Preloadable {
  load: () => Promise<unknown>
  reload: () => Promise<unknown>
  isLoaded: () => boolean
}

/**
 * Загружен ли модуль: загрузка начинается уже при рендере, как у `React.lazy`, и
 * компонент перерисовывается, когда она завершится. Ошибка оставляет `false` —
 * повторить её может только `reload()` по действию пользователя.
 */
export function usePreloaded(module: Preloadable, enabled = true) {
  const [, setLoaded] = useState(module.isLoaded)
  const ready = module.isLoaded()
  const loading = ready || !enabled ? undefined : module.load()
  useEffect(() => {
    if (!loading) return
    let alive = true
    loading.then(() => {
      if (alive) setLoaded(true)
    }, noop)
    return () => {
      alive = false
    }
  }, [loading])
  return ready
}
