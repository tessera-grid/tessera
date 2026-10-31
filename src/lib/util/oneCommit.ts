import { flushSync } from 'react-dom'

import { REACT_MAJOR } from './reactVersion'

/**
 * Записи вне событий React (таймер, промис) одним коммитом (ADR 0091). React 18
 * коммитит атомы TanStack в микрозадаче, а `setState` приложения — отдельной задачей:
 * между ними грид видел бы половину изменения. React 19 сводит их сам.
 */
export const inOneCommit = (write: () => void) => {
  if (REACT_MAJOR < 19) flushSync(write)
  else write()
}
