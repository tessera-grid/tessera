import { useEffect } from 'react'

import { useLatest } from '../../util/useLatest'

const GRID_SCROLLER = '.data-grid__container'

/**
 * Открытое меню закрывает прокрутка грида пользователем — колесо или касание над
 * областью прокрутки (ADR 0085, MM4). Прокрутка, которую делает сам грид (к активной
 * ячейке), этих событий не даёт и меню не закрывает; колесо над самим меню — в
 * портале вне грида — тоже.
 */
export const useCloseOnGridScroll = (open: boolean, close: () => void) => {
  const closeRef = useLatest(close)
  useEffect(() => {
    if (!open) return
    const onScrollGesture = (event: Event) => {
      if ((event.target as Element | null)?.closest?.(GRID_SCROLLER)) {
        closeRef.current()
      }
    }
    const options = { capture: true, passive: true }
    document.addEventListener('wheel', onScrollGesture, options)
    document.addEventListener('touchmove', onScrollGesture, options)
    return () => {
      document.removeEventListener('wheel', onScrollGesture, options)
      document.removeEventListener('touchmove', onScrollGesture, options)
    }
  }, [open, closeRef])
}
