/**
 * Вложенные разделы меню (ADR 0079): стек уровней — путь по `id` пунктов-разделов от
 * корня; раздел разрешается заново на каждом рендере, асинхронные пункты берутся из
 * загрузок открытого меню. Без DOM — модель для `useMenuSections`.
 */
import type { TableLabels } from '../localization'
import { rememberSectionSlot } from './sectionSlots'
import type { MenuAction } from './types'

export type SectionItems =
  | { status: 'loading' }
  | { status: 'done'; items: MenuAction[] }
  | { status: 'failed'; error: unknown }

/** Загрузки асинхронных разделов открытого меню по ключу пути. */
export interface SectionLoads {
  get: (key: string) => SectionItems | undefined
  /** Начать загрузку, если её ещё нет; `force` — заново после отказа. */
  start: (
    key: string,
    load: (signal: AbortSignal) => Promise<MenuAction[]>,
    force?: boolean,
  ) => void
  /** Прервать идущие загрузки, итоги оставить — меню закрывается. */
  abort: () => void
  /** Прервать загрузки и забыть итоги — меню закрылось. */
  reset: () => void
}

export const createSectionLoads = (
  onChange: () => void,
  /** Пункты пришли — до перерисовки (проверка доступности в сессии). */
  onLoaded?: (items: MenuAction[]) => void,
): SectionLoads => {
  let controller = new AbortController()
  const loads = new Map<string, SectionItems>()
  return {
    get: key => loads.get(key),
    start: (key, load, force = false) => {
      const current = loads.get(key)
      if (current && !(force && current.status === 'failed')) return
      const { signal } = controller
      loads.set(key, { status: 'loading' })
      onChange()
      load(signal).then(
        items => {
          if (signal.aborted) return
          loads.set(key, { status: 'done', items })
          onLoaded?.(items)
          onChange()
        },
        (error: unknown) => {
          if (signal.aborted) return
          loads.set(key, { status: 'failed', error })
          onChange()
        },
      )
    },
    abort: () => {
      controller.abort()
      controller = new AbortController()
      for (const [key, entry] of loads) {
        if (entry.status === 'loading') loads.delete(key)
      }
    },
    reset: () => {
      controller.abort()
      controller = new AbortController()
      loads.clear()
    },
  }
}

/** Ключ раздела по пути `id` от корня. */
export const sectionKey = (path: readonly string[]) => path.join('\u0001')

export const enterSection = (path: readonly string[], id: string) => [
  ...path,
  id,
]

export const leaveSection = (path: readonly string[]) => path.slice(0, -1)

/** Пункты раздела действия: сразу или из загрузки. Чистая — загрузку не начинает. */
export const sectionItemsOf = (
  owner: MenuAction,
  key: string,
  ctx: unknown,
  labels: TableLabels,
  loads: SectionLoads,
): SectionItems => {
  const { items } = owner.submenu!(ctx, labels)
  if (Array.isArray(items)) {
    rememberSectionSlot(owner, items)
    return { status: 'done', items }
  }
  const loaded = loads.get(key) ?? { status: 'loading' }
  if (loaded.status === 'done') rememberSectionSlot(owner, loaded.items)
  return loaded
}

/** Начать загрузку асинхронного раздела (наведение, вход, повтор после отказа). */
export const loadSection = (
  owner: MenuAction,
  key: string,
  ctx: unknown,
  labels: TableLabels,
  loads: SectionLoads,
  force = false,
) => {
  const { items } = owner.submenu!(ctx, labels)
  if (!Array.isArray(items)) loads.start(key, items, force)
}

export interface MenuLevelView {
  /** Действие, чей раздел открыт; у корня — нет. */
  owner?: MenuAction
  title?: string
  /** Умолчание раздела для закрытия меню после выбора. */
  closeOnSelect?: boolean
  /** Действительный путь: обрезан, если раздел исчез или ещё не загружен. */
  path: string[]
  items: SectionItems
}

/** Разрешить текущий уровень по пути от корневых действий. */
export const resolveMenuLevel = (
  root: MenuAction[],
  path: readonly string[],
  ctx: unknown,
  labels: TableLabels,
  loads: SectionLoads,
): MenuLevelView => {
  let level: MenuLevelView = {
    path: [],
    items: { status: 'done', items: root },
  }
  for (const id of path) {
    if (level.items.status !== 'done') break
    const owner = level.items.items.find(action => action.id === id)
    if (!owner?.submenu) break
    const nextPath = [...level.path, id]
    const section = owner.submenu(ctx, labels)
    level = {
      owner,
      title: section.title,
      closeOnSelect: section.closeOnSelect,
      path: nextPath,
      items: sectionItemsOf(owner, sectionKey(nextPath), ctx, labels, loads),
    }
  }
  return level
}
