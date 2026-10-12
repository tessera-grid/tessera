// Линии дерева в ячейке отступа (ADR 0102): ветки предков, поворот к строке и отросток
// к её детям. Декоративны: уровень строки несёт `aria-level`.
import type { CSSProperties } from 'react'

import styles from './TreeLines/TreeLines.module.css'

const at = (level: number) => ({ '--tsr-tree-level': level }) as CSSProperties

export interface TreeLinesProps {
  /** Уровни 1…глубина: `1` — у ветки уровня ниже есть сёстры. */
  branch: string
  /** Следом идут дети строки. */
  open: boolean
}

export const TreeLines = ({ branch, open }: TreeLinesProps) => {
  const depth = branch.length
  const lines = []
  for (let level = 1; level < depth; level++) {
    if (branch[level - 1] === '1')
      lines.push(<span key={level} className={styles.rail} style={at(level)} />)
  }
  if (depth > 0) {
    // Линия родителя идёт дальше — вертикаль рисует она, поворот без своей.
    const joined = branch[depth - 1] === '1'
    lines.push(
      <span
        key="elbow"
        className={joined ? styles.joinedElbow : styles.elbow}
        style={at(depth)}
      />,
    )
    if (joined)
      lines.push(<span key="next" className={styles.rail} style={at(depth)} />)
  }
  if (open)
    lines.push(
      <span key="stub" className={styles.stub} style={at(depth + 1)} />,
    )
  return (
    <span className={styles.lines} aria-hidden>
      {lines}
    </span>
  )
}
