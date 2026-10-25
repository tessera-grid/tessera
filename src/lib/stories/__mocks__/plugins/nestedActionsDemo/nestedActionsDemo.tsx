import {
  Archive,
  CircleDot,
  CirclePause,
  Clipboard,
  ClipboardCopy,
  Eraser,
  Link,
  Tag,
  Trash2,
  User,
  UserRoundPlus,
  Users,
} from 'lucide-react'

import type {
  MenuAction,
  RowAction,
} from '../../../../../lib/core/headerActions'

// Демо вложенных разделов меню (ADR 0079) на операциях над записью клиента:
// «Status» — короткий раздел с текущим значением, «Assign to» — сотрудники с сервера с
// третьим уровнем по командам, «Labels» — метки с сервера, загрузка падает с первого
// раза (повтор удаётся), меню не закрывается после выбора; «Copy» — что скопировать.

export const NESTED_DEMO_DELAY_MS = 800

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(signal.reason)
    })
  })

type Icon = typeof Tag

const icon = (Glyph: Icon) => () => <Glyph width={16} height={16} />
const rowId = (ctx: { row: { id: string } }) => ctx.row.id

const statuses = [
  { id: 'Active', glyph: CircleDot },
  { id: 'Paused', glyph: CirclePause },
  { id: 'Archived', glyph: Archive },
] as const
const statusOf = new Map<string, string>()
const assigneeOf = new Map<string, string>()

const teams: Record<string, string[]> = {
  Sales: ['Anna Petrova', 'Ben Carter'],
  Support: ['Chen Wei', 'Dana Silva'],
}

const labels = ['VIP', 'Follow up', 'Do not contact']
const labelsByRow = new Map<string, Set<string>>()
const labelsOf = (id: string) => {
  if (!labelsByRow.has(id)) labelsByRow.set(id, new Set())
  return labelsByRow.get(id)!
}

/** Метка-флажок: короткое «сохранение на сервере» — лоадер прямо в пункте. */
const toggleLabel = (name: string): MenuAction => ({
  id: `label:${name}`,
  icon: icon(Tag),
  label: () => name,
  active: ctx => labelsOf(rowId(ctx)).has(name),
  onSelect: async ctx => {
    await new Promise(resolve => setTimeout(resolve, 400))
    const set = labelsOf(rowId(ctx))
    if (set.has(name)) set.delete(name)
    else set.add(name)
  },
})

/** «Сервер» меток: `labelsDown` — загрузка падает; без него падает только первая. */
export interface NestedDemoServer {
  labelsDown?: () => boolean
}

const sections = (server?: NestedDemoServer): MenuAction[] => {
  let labelsFailed = false
  const person = (name: string): MenuAction => ({
    id: `assign:${name}`,
    icon: icon(User),
    label: () => name,
    active: ctx => assigneeOf.get(rowId(ctx)) === name,
    onSelect: ctx => {
      assigneeOf.set(rowId(ctx), name)
    },
  })
  const plain = (id: string, label: string, Glyph: Icon): MenuAction => ({
    id,
    icon: icon(Glyph),
    label: () => label,
    onSelect: () => {},
  })
  return [
    {
      id: 'demoStatus',
      icon: icon(CircleDot),
      label: () => 'Status',
      hint: ctx => statusOf.get(rowId(ctx)) ?? 'Active',
      onSelect: () => {},
      submenu: ctx => ({
        title: 'Status',
        items: statuses.map<MenuAction>(({ id, glyph }) => ({
          id: `status:${id}`,
          icon: icon(glyph),
          label: () => id,
          active: () => (statusOf.get(rowId(ctx)) ?? 'Active') === id,
          onSelect: () => {
            statusOf.set(rowId(ctx), id)
          },
        })),
      }),
    },
    {
      id: 'demoAssign',
      icon: icon(UserRoundPlus),
      label: () => 'Assign to',
      hint: ctx => assigneeOf.get(rowId(ctx)),
      onSelect: () => {},
      submenu: () => ({
        title: 'Assign to',
        items: async signal => {
          await wait(NESTED_DEMO_DELAY_MS, signal)
          return [
            person('Me'),
            ...Object.entries(teams).map<MenuAction>(([team, people]) => ({
              id: `team:${team}`,
              icon: icon(Users),
              label: () => team,
              onSelect: () => {},
              submenu: () => ({ title: team, items: people.map(person) }),
            })),
          ]
        },
      }),
    },
    {
      id: 'demoLabel',
      icon: icon(Tag),
      label: () => 'Labels',
      hint: ctx => {
        const count = labelsOf(rowId(ctx)).size
        return count > 0 ? String(count) : undefined
      },
      onSelect: () => {},
      // Метки расставляют по несколько — меню не закрывается после выбора.
      submenu: ctx => ({
        title: 'Labels',
        closeOnSelect: false,
        items: async signal => {
          await wait(NESTED_DEMO_DELAY_MS, signal)
          if (server?.labelsDown ? server.labelsDown() : !labelsFailed) {
            labelsFailed = true
            throw new Error('Label service is down')
          }
          return [
            ...labels.map(name => toggleLabel(name)),
            {
              id: 'label:clear',
              icon: icon(Eraser),
              label: () => 'Clear labels',
              closeOnSelect: true,
              disabled: () => labelsOf(rowId(ctx)).size === 0,
              onSelect: () => {
                labelsOf(rowId(ctx)).clear()
              },
            },
          ]
        },
      }),
    },
    {
      id: 'demoCopy',
      icon: icon(Clipboard),
      label: () => 'Copy',
      onSelect: () => {},
      submenu: () => ({
        title: 'Copy',
        items: [
          plain('copy:row', 'Row as text', ClipboardCopy),
          plain('copy:id', 'Record ID', ClipboardCopy),
          plain('copy:link', 'Link to record', Link),
        ],
      }),
    },
    plain('demoDelete', 'Delete', Trash2),
  ]
}

export const nestedRowActions = (server?: NestedDemoServer): RowAction[] =>
  sections(server).map((action, order) => ({
    ...action,
    slot: 'actionRowSlot',
    order,
  }))

export const nestedRowActionsDemo = nestedRowActions()

export const nestedContextActionsDemo: MenuAction[] = sections()
