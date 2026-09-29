import { userEvent } from 'vitest/browser'

/**
 * Увести указатель за пределы грида. `userEvent.unhover` ставит его в центр body —
 * а там может оказаться заголовок; маленькая мишень в углу окна от этого свободна.
 */
export const parkPointer = async () => {
  const target = document.createElement('div')
  target.style.cssText =
    'position:fixed;right:0;bottom:0;width:4px;height:4px;z-index:2147483647'
  document.body.appendChild(target)
  await userEvent.hover(target)
  target.remove()
}
