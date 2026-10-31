// Стек разделов открытого меню (ADR 0079): путь по `id` пунктов-разделов, загрузки
// асинхронных разделов, снимок уходящего уровня для анимации и фокус после смены.
import { useCallback, useEffect, useReducer, useRef, useState } from 'react'

import { actionOwnerOf } from '../actionOwners'
import { announceLabel } from '../announcer'
import { type DebugActionSource, reportAction } from '../debugActions'
import { useLatest } from '../../util/useLatest'
import type { TableLabels } from '../localization'
import {
  createSectionLoads,
  enterSection,
  leaveSection,
  loadSection,
  resolveMenuLevel,
  sectionKey,
} from './menuSections'
import type { MenuAction } from './types'

export type SectionDirection = 'forward' | 'back'

export const useMenuSections = (
  root: MenuAction[],
  context: unknown,
  labels: TableLabels,
  /** Раздел-корень: мини-меню инлайн-кнопки открывается сразу в нём. */
  base?: MenuAction,
  /** Пункты раздела стали известны — до их отрисовки (проверка доступности). */
  onSectionItems?: (items: MenuAction[]) => void,
) => {
  const itemsListener = useLatest(onSectionItems)
  const [, rerender] = useReducer((count: number) => count + 1, 0)
  const [loads] = useState(() =>
    createSectionLoads(rerender, items => itemsListener.current?.(items)),
  )
  const initialPath = base ? [base.id] : []
  const minDepth = initialPath.length
  const [path, setPath] = useState<string[]>(initialPath)
  // Из какого пункта вошли на каждый уровень — туда вернуть фокус.
  const [origins, setOrigins] = useState<string[]>([])
  const [direction, setDirection] = useState<SectionDirection | null>(null)
  const levelRef = useRef<HTMLDivElement>(null)
  const ghostRef = useRef<HTMLDivElement>(null)

  useEffect(() => () => loads.reset(), [loads])

  const level = resolveMenuLevel(
    base ? [base] : root,
    path,
    context,
    labels,
    loads,
  )

  // Снимок уходящего уровня — разметка без обработчиков и ролей: Base UI не ведёт по
  // нему стрелки, а скринридер его не видит. Классы снимка задаёт вид меню на слое снимков.
  const snapshot = (towards: SectionDirection) => {
    const current = levelRef.current
    const host = ghostRef.current
    if (!current || !host) return
    const ghost = current.cloneNode(true) as HTMLElement
    ghost.querySelectorAll('[id], [role], [tabindex]').forEach(node => {
      node.removeAttribute('id')
      node.removeAttribute('role')
      node.removeAttribute('tabindex')
    })
    ghost.removeAttribute('data-menu-level')
    ghost.setAttribute('aria-hidden', 'true')
    ghost.setAttribute('inert', '')
    ghost.className =
      (towards === 'forward'
        ? host.dataset.leaveForward
        : host.dataset.leaveBack) ?? ''
    ghost.style.width = `${current.offsetWidth}px`
    host.replaceChildren(ghost)
    void Promise.all(
      ghost.getAnimations().map(animation => animation.finished),
    ).then(
      () => ghost.remove(),
      () => ghost.remove(),
    )
  }

  /** Вход в раздел — сразу; асинхронный раздел до ответа показывает скелет. */
  const enter = (owner: MenuAction, source: DebugActionSource = 'pointer') => {
    if (!owner.submenu) return
    reportAction((context as { table?: unknown }).table, {
      plugin: actionOwnerOf(owner),
      action: 'enterSection',
      detail: { action: owner.id },
      source,
    })
    const next = enterSection(level.path, owner.id)
    const { items } = owner.submenu(context, labels)
    if (Array.isArray(items)) onSectionItems?.(items)
    loadSection(owner, sectionKey(next), context, labels, loads)
    snapshot('forward')
    setOrigins([...origins.slice(0, level.path.length), owner.id])
    setDirection('forward')
    setPath(next)
    const table = (context as { table?: unknown }).table
    if (table) {
      const { title } = owner.submenu(context, labels)
      announceLabel(table, all => all.announceMenuSection(title))
    }
  }

  /** Уровень выше; `false` — уже корень. */
  const back = (source: DebugActionSource = 'keyboard') => {
    if (level.path.length <= minDepth) return false
    const top = root.find(action => action.id === level.path[0])
    reportAction((context as { table?: unknown }).table, {
      plugin: top ? actionOwnerOf(top) : 'core',
      action: 'leaveSection',
      detail: { action: level.path.at(-1) },
      source,
    })
    snapshot('back')
    setDirection('back')
    setPath(leaveSection(level.path))
    return true
  }

  const preload = (owner: MenuAction) => {
    if (!owner.submenu) return
    loadSection(
      owner,
      sectionKey(enterSection(level.path, owner.id)),
      context,
      labels,
      loads,
    )
  }

  const retry = () => {
    if (!level.owner) return
    loadSection(
      level.owner,
      sectionKey(level.path),
      context,
      labels,
      loads,
      true,
    )
  }

  /** Меню открывается: раздел-корень начинает загрузку. */
  const prime = () => {
    if (base) loadSection(base, sectionKey([base.id]), context, labels, loads)
  }

  /** Меню закрывается: идущие загрузки прерываются. */
  const abort = useCallback(() => loads.abort(), [loads])

  /** Меню закрылось до конца: следующее открытие — с корня. */
  const reset = useCallback(() => {
    loads.reset()
    setPath(base ? [base.id] : [])
    setOrigins([])
    setDirection(null)
  }, [loads, base])

  return {
    level,
    depth: level.path.length - minDepth,
    direction,
    /** Пункт, на который вернуть фокус при возврате на этот уровень. */
    returnTo: direction === 'back' ? origins[level.path.length] : undefined,
    levelRef,
    ghostRef,
    enter,
    back,
    preload,
    retry,
    prime,
    abort,
    reset,
  }
}

export type MenuSections = ReturnType<typeof useMenuSections>
