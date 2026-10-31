// Линии дерева в ячейке отступа (ADR 0102): ветки предков, поворот к строке и отросток
// к её детям. Декоративны: уровень строки несёт `aria-level`.
import { type CSSProperties, useLayoutEffect, useRef, useState } from 'react'

import { rowMotionTiming } from '../theme/rowMotionTiming'
import styles from './TreeLines.module.css'

/** Перетаскивание с движением строк: части линий проявляются и гаснут (ADR 0108, PV11). */
const FADE_WHILE = '[data-row-animation][data-row-dragging]'

interface Part {
  key: string
  className: string
  level: number
}

const partsOf = (branch: string, open: boolean): Part[] => {
  const depth = branch.length
  const parts: Part[] = []
  for (let level = 1; level < depth; level++) {
    if (branch[level - 1] === '1')
      parts.push({ key: `rail${level}`, className: styles.rail, level })
  }
  if (depth > 0) {
    // Линия родителя идёт дальше — вертикаль рисует она, поворот без своей.
    const joined = branch[depth - 1] === '1'
    parts.push({
      key: `${joined ? 'joined' : 'elbow'}${depth}`,
      className: joined ? styles.joinedElbow : styles.elbow,
      level: depth,
    })
    if (joined)
      parts.push({ key: `next${depth}`, className: styles.rail, level: depth })
  }
  if (open)
    parts.push({
      key: `stub${depth + 1}`,
      className: styles.stub,
      level: depth + 1,
    })
  return parts
}

/**
 * Часть линий. Появившаяся во время перетаскивания проявляется, ушедшая — гаснет и
 * сообщает \`onGone\`; вне перетаскивания ушедшая убирается сразу. Web Animations, а не
 * класс: React перезаписывает \`className\` при перерисовке, а правило на атрибут
 * контейнера проявило бы заново все линии на старте сессии.
 */
const Line = ({
  part,
  leaving,
  onGone,
}: {
  part: Part
  leaving: boolean
  onGone: (key: string) => void
}) => {
  const ref = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const node = ref.current
    const timing = node?.closest(FADE_WHILE) ? rowMotionTiming(node!) : null
    if (!node || !timing?.duration) {
      if (leaving) onGone(part.key)
      return
    }
    const fade = node.animate(
      leaving
        ? [{ opacity: 1 }, { opacity: 0 }]
        : [{ opacity: 0 }, { opacity: 1 }],
      { ...timing, fill: leaving ? 'forwards' : 'none' },
    )
    if (leaving) fade.onfinish = () => onGone(part.key)
    return () => fade.cancel()
  }, [leaving, onGone, part.key])
  return (
    <span
      ref={ref}
      data-leaving={leaving || undefined}
      className={part.className}
      style={{ '--tsr-tree-level': part.level } as CSSProperties}
    />
  )
}

export interface TreeLinesProps {
  /** Уровни 1…глубина: `1` — у ветки уровня ниже есть сёстры. */
  branch: string
  /** Следом идут дети строки. */
  open: boolean
}

export const TreeLines = ({ branch, open }: TreeLinesProps) => {
  const parts = partsOf(branch, open)
  const signature = parts.map(part => part.key).join(' ')
  // Ушедшие части держатся, пока гаснут: прошлый набор частей — в состоянии.
  const [shown, setShown] = useState({
    signature,
    parts,
    leaving: [] as Part[],
  })
  if (shown.signature !== signature) {
    const now = new Set(parts.map(part => part.key))
    const gone = new Map(
      [...shown.leaving, ...shown.parts]
        .filter(part => !now.has(part.key))
        .map(part => [part.key, part]),
    )
    setShown({ signature, parts, leaving: [...gone.values()] })
  }
  const [onGone] = useState(
    () => (key: string) =>
      setShown(current => ({
        ...current,
        leaving: current.leaving.filter(part => part.key !== key),
      })),
  )
  return (
    <span className={styles.lines} aria-hidden>
      {parts.map(part => (
        <Line key={part.key} part={part} leaving={false} onGone={onGone} />
      ))}
      {shown.leaving.map(part => (
        <Line key={`gone-${part.key}`} part={part} leaving onGone={onGone} />
      ))}
    </span>
  )
}
