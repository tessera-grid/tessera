import {
  Table,
  TableState,
  Updater,
  functionalUpdate,
} from '@tanstack/react-table'

export function stateUpdater<T = TableState, TState = T & Partial<TableState>>(
  key: keyof TState,
  instance: Table<any, any, TState, any>,
) {
  return (updater: Updater<TState[keyof TState]>) => {
    instance.setState(old => {
      return {
        ...old,
        // TODO: разобраться чуть позже
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        [key]: functionalUpdate(updater, old[key]),
      }
    })
  }
}
