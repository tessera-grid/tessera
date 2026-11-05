import type { CSSProperties } from 'react'

import { Meta, StoryObj } from '@storybook/react'

import { getTreeLines } from '../plugins/treeLines/branches'
import { TreeLines } from '../ui/TreeLines/TreeLinesLayer'
import { UiCanvas } from './__mocks__/UiCanvas'
import { defaultControls } from './__mocks__/utils/dataGridControls'

/**
 * Линии дерева (ADR 0102): в отступе первой колонки — ветки предков, поворот к строке и отросток
 * к её детям. Линии декоративны, уровень строки несёт `aria-level`. Глубина дерева — в панели.
 */
interface TreeLinesStoryArgs {
  depth: 1 | 2 | 3
}

interface Node {
  label: string
  children?: Node[]
}

const TREE: Node[] = [
  {
    label: 'Engineering',
    children: [
      {
        label: 'Platform',
        children: [
          {
            label: 'Storage',
            children: [{ label: 'Alice Smith' }, { label: 'Bob Jones' }],
          },
          { label: 'Carol White' },
        ],
      },
      { label: 'Dan Brown' },
    ],
  },
  {
    label: 'Sales',
    children: [
      {
        label: 'Europe',
        children: [
          { label: 'Berlin', children: [{ label: 'Eve Black' }] },
          { label: 'Frank Green' },
        ],
      },
      { label: 'Grace Hall' },
    ],
  },
]

/** Дерево с `levels` уровнями групп: глубже группы становятся строками. */
const treeOf = (levels: number, nodes: Node[] = TREE): Node[] =>
  nodes.map(node =>
    node.children && levels > 0
      ? { ...node, children: treeOf(levels - 1, node.children) }
      : { label: node.label },
  )

/** Строки дерева по порядку показа; линии считает то же, что плагин линий дерева. */
const rowsOf = (nodes: Node[], depth = 0): { label: string; depth: number }[] =>
  nodes.flatMap(node => [
    { label: node.label, depth },
    ...(node.children ? rowsOf(node.children, depth + 1) : []),
  ])

const Tree = ({ depth }: TreeLinesStoryArgs) => {
  const rows = rowsOf(treeOf(depth))
  const lines = getTreeLines(rows)
  return rows.map((row, index) => (
    <div
      key={index}
      role="row"
      aria-level={row.depth + 1}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        height: 'var(--tsr-comp-row-height)',
        paddingInlineStart: `calc(var(--tsr-comp-cell-content-padding-x) + var(--tsr-comp-row-nesting-indent) * ${row.depth})`,
      }}
    >
      <TreeLines branch={lines.branch(index)} open={lines.open(index)} />
      <span role="gridcell">{row.label}</span>
    </div>
  ))
}

const meta = {
  title: 'Tessera/UI/TreeLines',
  args: { depth: 2 },
  argTypes: {
    depth: {
      control: 'inline-radio',
      options: [1, 2, 3],
      description: 'Уровней групп над строками',
    },
  },
  render: ({ depth }) => (
    <UiCanvas>
      <div
        role="treegrid"
        aria-label="Teams"
        data-tree-lines=""
        style={
          {
            // Шаг отступа с линиями — свой, как в таблице с линиями дерева.
            '--tsr-comp-row-nesting-indent': 'var(--tsr-comp-tree-line-indent)',
            width: 320,
            overflow: 'hidden',
            border:
              'var(--tsr-comp-frame-border-width) solid var(--tsr-comp-frame-border-color)',
            borderRadius: 'var(--tsr-comp-frame-radius)',
            background: 'var(--tsr-comp-row-bg)',
            fontSize: 'var(--tsr-comp-cell-font-size)',
          } as CSSProperties
        }
      >
        <Tree depth={depth} />
      </div>
    </UiCanvas>
  ),
} satisfies Meta<TreeLinesStoryArgs>

export default meta

type Story = StoryObj<typeof meta>

export const TreeLinesPlayground: Story = {
  name: 'Playground',
  parameters: defaultControls('depth'),
}
