// Коммиты React для счётчиков работы (ADR 0099, PF2): свой `__REACT_DEVTOOLS_GLOBAL_HOOK__`,
// поставленный до загрузки `react-dom` (первый импорт `vitest.setup.ts`). Без слушателя
// хук ничего не делает и ничего не держит — наборы утечек (ADR 0092) его не видят.

export interface FiberRoot {
  current: unknown
}

type CommitListener = (root: FiberRoot) => void

let listener: CommitListener | undefined

/** Слушатель коммитов всех корней; `undefined` снимает. */
export const onReactCommit = (next: CommitListener | undefined) => {
  listener = next
}

declare global {
  interface Window {
    __REACT_DEVTOOLS_GLOBAL_HOOK__?: unknown
  }
}

if (typeof window !== 'undefined' && !window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
  const renderers = new Map<number, unknown>()
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    renderers,
    inject: (renderer: unknown) => {
      const id = renderers.size + 1
      renderers.set(id, renderer)
      return id
    },
    onCommitFiberRoot: (_id: number, root: FiberRoot) => listener?.(root),
    onCommitFiberUnmount: () => {},
    onPostCommitFiberRoot: () => {},
    checkDCE: () => {},
  }
}
