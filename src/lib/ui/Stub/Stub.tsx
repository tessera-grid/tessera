/**
 * Заглушка (ADR 0123, ES11): иллюстрация или иконка, заголовок, описание и действие по
 * центру. Встроенные заглушки грида рисуются ею; приложение собирает ею свои.
 */
import {
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
  useCallback,
  useRef,
  useState,
} from 'react'

import clsx from 'clsx'

import { useIsomorphicLayoutEffect } from '../../util/useIsomorphicLayoutEffect'
import { assignRef } from '../assignRef'
import { Tooltip } from '../Tooltip'

import styles from './Stub.module.css'

export interface StubProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'title' | 'children'
> {
  /** Иллюстрация или иконка; не умещается целиком вместе с текстом — скрыта. */
  media?: ReactNode
  title: string
  /** Подробности: не больше двух строк, полный текст в тултипе. */
  description?: string
  /** Действие — кнопка кита. */
  action?: ReactNode
  /** `compact` — для поповеров и панелей: меньше отступы, кегль и иллюстрация. */
  size?: 'default' | 'compact'
}

/**
 * Высота содержимого без иллюстрации и место, которое она займёт вместе с зазором. Размеры —
 * дробные и без трансформаций: округления целых высот в рамке по содержимому и масштаб
 * поповера на анимации прятали бы иллюстрацию.
 */
const layoutHeight = (element: Element) =>
  parseFloat(getComputedStyle(element).height) || 0

const mediaFits = (
  root: HTMLElement,
  media: HTMLElement,
  mediaHeight: number,
) => {
  const style = getComputedStyle(root)
  const gap = parseFloat(style.rowGap) || 0
  const rest = [...root.children].filter(child => child !== media)
  const content = rest.reduce(
    (sum, child) => sum + layoutHeight(child),
    gap * Math.max(rest.length - 1, 0),
  )
  const needed =
    parseFloat(style.paddingTop) +
    parseFloat(style.paddingBottom) +
    content +
    mediaHeight +
    gap
  return needed <= parseFloat(style.height) + 0.5
}

export const Stub = forwardRef<HTMLDivElement, StubProps>(function Stub(
  { media, title, description, action, size = 'default', className, ...rest },
  ref,
) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const setRoot = useCallback(
    (node: HTMLDivElement | null) => {
      rootRef.current = node
      assignRef(ref, node)
    },
    [ref],
  )
  const mediaRef = useRef<HTMLSpanElement>(null)
  const mediaHeight = useRef(0)
  const [mediaHidden, setMediaHidden] = useState(false)

  // Начальный размер проверяем до первого кадра. Скрытие иллюстрации меняет
  // размер наблюдаемых узлов, поэтому ответ на ResizeObserver — в другом кадре.
  const hasMedia = media != null && media !== false
  const parts = `${hasMedia}|${title}|${description ?? ''}|${action != null}`
  useIsomorphicLayoutEffect(() => {
    const root = rootRef.current
    const mediaNode = mediaRef.current
    if (!root || !mediaNode) return
    const measure = () => {
      if (!mediaNode.hidden) mediaHeight.current = layoutHeight(mediaNode)
      setMediaHidden(!mediaFits(root, mediaNode, mediaHeight.current))
    }
    measure()
    let frame = 0
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    })
    observer.observe(root)
    for (const child of root.children) observer.observe(child)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [parts])

  return (
    <div
      ref={setRoot}
      className={clsx(styles.stub, className)}
      data-stub=""
      data-size={size}
      data-media-hidden={(hasMedia && mediaHidden) || undefined}
      {...rest}
    >
      {hasMedia && (
        <span
          ref={mediaRef}
          className={styles.media}
          aria-hidden="true"
          hidden={mediaHidden}
        >
          {media}
        </span>
      )}
      <p className={styles.title}>{title}</p>
      {description && (
        <Tooltip title={description} overflowOnly>
          <p className={styles.description}>{description}</p>
        </Tooltip>
      )}
      {action}
    </div>
  )
})
