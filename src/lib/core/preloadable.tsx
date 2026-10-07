import { type ComponentType, lazy, useEffect, useState } from 'react'

/**
 * Ленивый компонент с явной загрузкой: после `load()` рисуется синхронно, без
 * Suspense-фолбэка — у `React.lazy` первый рендер приостанавливается всегда. До
 * загрузки (и при её ошибке) `Component` приостанавливается как `React.lazy`.
 */
export function preloadable<P extends object>(
  factory: () => Promise<ComponentType<P>>,
) {
  let loaded: ComponentType<P> | undefined
  let pending: Promise<ComponentType<P>> | undefined

  const load = () =>
    (pending ??= factory().then(
      component => (loaded = component),
      error => {
        pending = undefined
        throw error
      },
    ))

  const Lazy = lazy(() => load().then(component => ({ default: component })))

  const Component = (props: P) => {
    const Loaded = loaded ?? Lazy
    return <Loaded {...props} />
  }

  return { load, isLoaded: () => !!loaded, Component }
}

export interface Preloadable {
  load: () => Promise<unknown>
  isLoaded: () => boolean
}

/**
 * Загружен ли модуль: перерисовывает компонент, когда загрузка завершится (и при
 * ошибке — тогда `Component` отдаст её границе ошибок).
 */
export function usePreloaded(module: Preloadable) {
  const [ready, setReady] = useState(module.isLoaded)
  // Загрузка начинается уже при рендере, как у `React.lazy`; промис общий.
  const loading = ready ? undefined : module.load()
  useEffect(() => {
    if (!loading) return
    let alive = true
    const done = () => {
      if (alive) setReady(true)
    }
    loading.then(done, done)
    return () => {
      alive = false
    }
  }, [loading])
  return ready
}
