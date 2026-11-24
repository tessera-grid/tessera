import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'

export { useSyncExternalStore } from 'react'

const memoizeSelector = <Snapshot, Selection>(
  selector: (snapshot: Snapshot) => Selection,
  isEqual: (previous: Selection, next: Selection) => boolean,
  readCommitted: () => { selection: Selection } | undefined,
) => {
  let cached: { snapshot: Snapshot; selection: Selection } | undefined

  return (snapshot: Snapshot) => {
    if (cached && Object.is(cached.snapshot, snapshot)) {
      return cached.selection
    }

    const next = selector(snapshot)
    const previous = cached ?? readCommitted()
    const selection =
      previous && isEqual(previous.selection, next) ? previous.selection : next
    cached = { snapshot, selection }
    return selection
  }
}

export const useSyncExternalStoreWithSelector = <Snapshot, Selection>(
  subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => Snapshot,
  getServerSnapshot: (() => Snapshot) | undefined,
  selector: (snapshot: Snapshot) => Selection,
  isEqual: (previous: Selection, next: Selection) => boolean = Object.is,
) => {
  const committed = useRef<{ selection: Selection } | undefined>(undefined)
  const [readSelection, readServerSelection] = useMemo(() => {
    // Последний коммит читается из функции снимка для сохранения ссылки при смене селектора.
    // eslint-disable-next-line react-hooks/refs
    const select = memoizeSelector(selector, isEqual, () => committed.current)

    return [
      () => select(getSnapshot()),
      getServerSnapshot ? () => select(getServerSnapshot()) : undefined,
    ] as const
  }, [getSnapshot, getServerSnapshot, selector, isEqual])

  const selection = useSyncExternalStore(
    subscribe,
    readSelection,
    readServerSelection,
  )
  useEffect(() => {
    committed.current = { selection }
  }, [selection])
  return selection
}
