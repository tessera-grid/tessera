/**
 * Единый контракт производных кнопок кита (ADR 0128): имена пропсов в публичных типах
 * `/ui` (DB3) и устройство их историй (DB4); пропа вспышки ошибки нет (FB3, ADR 0136).
 */
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { ENTRY, exportNames, typeProps } from './publicTypes'

const BUTTONS = [
  'CellButton',
  'RowButton',
  'ExpandButton',
  'GroupButton',
  'PinButton',
  'SortButton',
  'ToolbarButton',
] as const

/** Кнопки ячейки, заголовка и строки — с `revealOnHover`. */
const REVEALING = [
  'CellButton',
  'RowButton',
  'GroupButton',
  'PinButton',
  'SortButton',
]

/** История включённого состояния у кнопок со своим состоянием и с `active`. */
const ACTIVE_STORY: Partial<Record<(typeof BUTTONS)[number], string>> = {
  CellButton: 'Active',
  RowButton: 'Active',
  ExpandButton: 'Expanded',
  GroupButton: 'Grouped',
  PinButton: 'Pinned',
  SortButton: 'Sorted',
  ToolbarButton: 'Active',
}

const COMMON = [
  'disabled',
  'tooltipWhenDisabled',
  'pending',
  'failure',
  'onClick',
  'data-testid',
]

const OLD = [
  'showOnHover',
  'isVisible',
  'showTooltipWhenDisabled',
  'isPinned',
  'isGrouped',
  'testId',
]

const names = (button: string) =>
  typeProps(ENTRY.ui, `${button}Props`).map(prop => prop.name)

describe('Производные кнопки кита (ADR 0128)', () => {
  it('DB3: публичные типы /ui — label вместо title, revealOnHover вместо showOnHover и isVisible, tooltipWhenDisabled вместо showTooltipWhenDisabled, pinned и grouped вместо isPinned и isGrouped, data-testid вместо testId, тип CellButtonProps; старых имён нет; DerivedButtonProps экспортируется', () => {
    const exported = exportNames(ENTRY.ui)
    expect(exported).toEqual(
      expect.arrayContaining([
        'DerivedButtonProps',
        ...BUTTONS.map(button => `${button}Props`),
      ]),
    )
    expect(exported).not.toContain('CellEditButtonProps')
    for (const button of BUTTONS) {
      const props = names(button)
      expect(props, button).toEqual(expect.arrayContaining(COMMON))
      for (const old of OLD)
        expect(props, `${button}: ${old}`).not.toContain(old)
      expect(props.includes('revealOnHover'), `${button}: revealOnHover`).toBe(
        REVEALING.includes(button),
      )
    }
    for (const button of ['CellButton', 'RowButton']) {
      expect(names(button), button).toContain('label')
      expect(names(button), button).not.toContain('title')
    }
    expect(names('PinButton')).toContain('pinned')
    expect(names('GroupButton')).toContain('grouped')
  })

  it('DB4: истории UI/<Кнопка> — первая Playground в рамке своего места, есть Pending и Disabled, у кнопок со своим состоянием и у CellButton и RowButton — история включённого, у кнопок с revealOnHover — Always visible', () => {
    for (const button of BUTTONS) {
      const source = readFileSync(
        new URL(`../stories/UI.${button}.stories.tsx`, import.meta.url),
        'utf8',
      )
      const stories = [
        ...source.matchAll(/export const (\w+): Story = \{\s*name: '([^']+)'/g),
      ].map(([, id, name]) => ({ id, name }))
      expect(stories[0], button).toEqual({
        id: `${button}Playground`,
        name: 'Playground',
      })
      expect(
        /<UiCanvas\s+host="(cell|head|row)"|<Toolbar\.Root>/.test(source),
        `${button}: рамка своего места`,
      ).toBe(true)
      const ids = stories.map(story => story.id)
      const expected = [
        `${button}Pending`,
        `${button}Disabled`,
        ...(ACTIVE_STORY[button] ? [`${button}${ACTIVE_STORY[button]}`] : []),
        ...(REVEALING.includes(button) ? [`${button}AlwaysVisible`] : []),
      ]
      expect(ids, button).toEqual(expect.arrayContaining(expected))
    }
  })

  it('FB3: у кнопок кита и производных нет пропа errorFlash — отказ задаёт failure', () => {
    for (const button of ['IconButton', 'Button', ...BUTTONS]) {
      const props = names(button)
      expect(props, button).toContain('failure')
      expect(props, button).not.toContain('errorFlash')
    }
  })
})
