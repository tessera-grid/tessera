/**
 * Верхний тулбар грида (ADR 0035): кнопки плагинов из `toolbarSlot`, прижатые
 * вправо, по подгруппам с вертикальными разделителями; слоты с `align: 'start'`
 * (поле поиска, ADR 0045) — слева. Один tab-stop, стрелки
 * ходят по кнопкам (Base UI Toolbar).
 */
import { Fragment, memo, type KeyboardEvent } from 'react'

import { Toolbar as BaseToolbar } from '@base-ui/react/toolbar'

import type { RenderSlots } from '../../core/createSlots'
import { RenderSlot } from '../../core/renderSlots'
import { type ToolbarGroup, resolveToolbarSides } from '../../core/toolbar'
import { withViewSettingsButton } from '../../core/viewSettings'
import type { Table } from '../../types'
import { ViewSettingsButton } from '../ViewSettings/ViewSettingsButton'
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

const ToolbarGroups = ({
  groups,
  table,
}: {
  groups: ToolbarGroup[]
  table: Table<any, any>
}) =>
  groups.map((group, index) => (
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
  ))

// Мемо: перерисовка грида сдвигом окна строк или колонок тулбар не трогает — его кнопки
// подписаны на свои срезы сами (ADR 0149, PS12).
export const Toolbar = memo(({ table, label }: ToolbarProps) => {
  const slots = (table.getRenderSlots as () => RenderSlots | undefined)()
  const { start, end } = resolveToolbarSides(
    withViewSettingsButton(slots?.toolbarSlot ?? [], table, ViewSettingsButton),
  )

  return (
    <BaseToolbar.Root
      aria-label={label}
      loopFocus
      onKeyDown={handleEdgeKeys}
      className={styles.toolbar}
      data-testid="data-grid-toolbar"
    >
      {start.length > 0 && (
        <div className={styles.toolbar__start}>
          <ToolbarGroups groups={start} table={table} />
        </div>
      )}
      <div className={styles.toolbar__end}>
        <ToolbarGroups groups={end} table={table} />
      </div>
    </BaseToolbar.Root>
  )
})

Toolbar.displayName = 'Toolbar'
