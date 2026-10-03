import { userEvent } from 'vitest/browser'

const PARK_ID = 'tsr-test-pointer-park'

/**
 * Увести указатель за пределы грида. `userEvent.unhover` ставит его в центр body —
 * а там может оказаться заголовок; маленькая мишень в углу окна от этого свободна.
 * `id` обязателен: без него vitest адресует мишень как `body > div:nth-child(N)`, а
 * портал Base UI прошлого теста, уходящий асинхронно, сдвигает N на себя.
 */
export const parkPointer = async () => {
  const target = document.createElement('div')
  target.id = PARK_ID
  target.style.cssText =
    'position:fixed;right:0;bottom:0;width:4px;height:4px;z-index:2147483647'
  document.body.appendChild(target)
  await userEvent.hover(target)
  target.remove()
}
