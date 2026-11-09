import { type ComponentType, type ReactNode, useEffect, useState } from 'react'

const noop = () => {}

/**
 * Ленивый компонент с явной загрузкой. Рендер не приостанавливается: до загрузки рисуется
 * `fallback`, загруженный модуль подменяет его обычным обновлением, а не раскрытием Suspense —
 * раскрытие внутри `<ViewTransition>` приложения запустило бы его View Transition (ADR 0107,
 * RM33). После загрузки рисуется синхронно.
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

  const module: Preloadable = { load, reload, isLoaded: () => !!loaded }

  /** До загрузки — `fallback`; модуль начинает грузиться с первого рендера. */
  const Component = ({
    fallback = null,
    ...props
  }: P & { fallback?: ReactNode }) => {
    usePreloaded(module)
    const Loaded = loaded
    return Loaded ? <Loaded {...(props as P)} /> : fallback
  }

  return { ...module, Component }
}

export interface Preloadable {
  load: () => Promise<unknown>
  reload: () => Promise<unknown>
  isLoaded: () => boolean
}

/**
 * Загружен ли модуль: загрузка начинается уже при рендере, и компонент перерисовывается,
 * когда она завершится. Ошибка оставляет `false` — повторить её может только `reload()` по
 * действию пользователя.
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
