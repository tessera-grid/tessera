import { expect, test } from 'vitest'
import { render } from 'vitest-browser-react'

import { useSyncExternalStoreWithSelector } from '../../../util/useSyncExternalStore'

test('EV11 — подписка обновляет выбранное значение и сохраняет равную проекцию', async () => {
  let snapshot = { selected: 'first', other: 0 }
  const listeners = new Set<() => void>()
  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }
  const getSnapshot = () => snapshot
  const publish = (next: typeof snapshot) => {
    snapshot = next
    listeners.forEach(listener => listener())
  }
  const select = ({ selected }: typeof snapshot) => ({ selected })
  const isEqual = (
    a: ReturnType<typeof select>,
    b: ReturnType<typeof select>,
  ) => a.selected === b.selected
  let renders = 0

  function View() {
    renders++
    const { selected } = useSyncExternalStoreWithSelector(
      subscribe,
      getSnapshot,
      getSnapshot,
      select,
      isEqual,
    )
    return <output>{selected}</output>
  }

  const screen = await render(<View />)
  await expect.element(screen.getByRole('status')).toHaveTextContent('first')
  const initialRenders = renders
  publish({ selected: 'first', other: 1 })
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  expect(renders).toBe(initialRenders)

  publish({ selected: 'second', other: 1 })
  await expect.element(screen.getByRole('status')).toHaveTextContent('second')
})
