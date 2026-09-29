/**
 * Верхний тулбар грида (ADR 0035): кнопки плагинов из `toolbarSlot`, прижатые
 * вправо, по подгруппам с вертикальными разделителями. Один tab-stop, стрелки
 * ходят по кнопкам (Base UI Toolbar).
 */
import { Fragment, type KeyboardEvent } from 'react'

import { Toolbar as BaseToolbar } from '@base-ui/react/toolbar'

import type { RenderSlots } from '../../core/createSlots'
import { RenderSlot } from '../../core/renderSlots'
import { resolveToolbarGroups } from '../../core/toolbar'
import type { Table } from '../../types'
import styles from './Toolbar.module.css'

interface ToolbarProps {
  table: Table<any, any>
  label: string
}

const ITEM_SELECTOR = 'button, a[href], input'

/** `Home`/`End` — к первой/последней кнопке: Base UI Toolbar их не обрабатывает. */
const handleEdgeKeys = (event: KeyboardEvent<HTMLDivElement>) => {
  if (event.key !== 'Home' && event.key !== 'End') {
    return
  }
  const items = [
    ...event.currentTarget.querySelectorAll<HTMLElement>(ITEM_SELECTOR),
  ]
  const target = event.key === 'Home' ? items[0] : items.at(-1)
  if (target) {
    event.preventDefault()
    target.focus()
  }
}

export const Toolbar = ({ table, label }: ToolbarProps) => {
  const slots = (table.getRenderSlots as () => RenderSlots | undefined)()
  const groups = resolveToolbarGroups(slots?.toolbarSlot ?? [])

  return (
    <BaseToolbar.Root
      aria-label={label}
      loopFocus
      onKeyDown={handleEdgeKeys}
      className={styles.toolbar}
      data-testid="data-grid-toolbar"
    >
      <div className={styles.toolbar__end}>
        {groups.map((group, index) => (
          <Fragment key={group.id}>
            {index > 0 && (
              <BaseToolbar.Separator
                orientation="vertical"
                className={styles.toolbar__separator}
              />
            )}
            <BaseToolbar.Group
              className={styles.toolbar__group}
              data-group={group.id}
            >
              <RenderSlot slot={group.items} context={{ table }} />
            </BaseToolbar.Group>
          </Fragment>
        ))}
      </div>
    </BaseToolbar.Root>
  )
}
