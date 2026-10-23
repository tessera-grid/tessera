import { describe, expect, it, vi } from 'vitest'

import {
  type MenuAction,
  createSectionLoads,
  enterSection,
  leaveSection,
  loadSection,
  resolveMenuItems,
  resolveMenuLevel,
  sectionKey,
} from '../core/headerActions'
import { ENGLISH_LABELS } from '../core/localization'

// Вложенные разделы меню (ADR 0079, NM17): стек уровней и разрешение раздела без DOM;
// меню без `submenu` работает как прежде.

const leaf = (id: string): MenuAction => ({
  id,
  icon: () => null,
  label: () => id,
  onSelect: () => {},
})

const flush = () => new Promise(resolve => setTimeout(resolve, 0))

describe('menuSections', () => {
  it('NM17: стек уровней и разрешение раздела без DOM; меню без submenu работает как прежде', async () => {
    // Стек: вход и возврат по id.
    expect(enterSection([], 'a')).toEqual(['a'])
    expect(enterSection(['a'], 'b')).toEqual(['a', 'b'])
    expect(leaveSection(['a', 'b'])).toEqual(['a'])
    expect(leaveSection([])).toEqual([])

    // Меню без разделов: корень как есть, пункты — как прежде.
    const plain = [leaf('edit'), leaf('delete')]
    const onChange = vi.fn()
    const loads = createSectionLoads(onChange)
    const root = resolveMenuLevel(plain, [], {}, ENGLISH_LABELS, loads)
    expect(root).toEqual({ path: [], items: { status: 'done', items: plain } })
    expect(resolveMenuItems(plain[0]!, {}, ENGLISH_LABELS)).toHaveLength(1)

    // Синхронный раздел внутри раздела.
    const inner: MenuAction = {
      ...leaf('projects'),
      submenu: () => ({ title: 'Projects', items: [leaf('tessera')] }),
    }
    let answer!: (items: MenuAction[]) => void
    let fail!: (error: unknown) => void
    const load = vi.fn(
      (signal: AbortSignal) =>
        new Promise<MenuAction[]>((ok, ko) => {
          answer = ok
          fail = ko
          signal.addEventListener('abort', () => ko(signal.reason))
        }),
    )
    const move: MenuAction = {
      ...leaf('move'),
      submenu: () => ({ title: 'Move to', items: load }),
    }
    const menu = [leaf('edit'), move]

    // Асинхронный раздел: без загрузки — «загрузка», чтение её не начинает.
    expect(
      resolveMenuLevel(menu, ['move'], {}, ENGLISH_LABELS, loads).items,
    ).toEqual({ status: 'loading' })
    expect(load).not.toHaveBeenCalled()

    loadSection(move, sectionKey(['move']), {}, ENGLISH_LABELS, loads)
    loadSection(move, sectionKey(['move']), {}, ENGLISH_LABELS, loads)
    expect(load).toHaveBeenCalledTimes(1)
    // Путь глубже незагруженного раздела обрезается.
    expect(
      resolveMenuLevel(menu, ['move', 'projects'], {}, ENGLISH_LABELS, loads)
        .path,
    ).toEqual(['move'])

    answer([leaf('inbox'), inner])
    await flush()
    const nested = resolveMenuLevel(
      menu,
      ['move', 'projects'],
      {},
      ENGLISH_LABELS,
      loads,
    )
    expect(nested.title).toBe('Projects')
    expect(nested.path).toEqual(['move', 'projects'])
    expect(nested.items.status).toBe('done')
    expect(
      nested.items.status === 'done' && nested.items.items.map(a => a.id),
    ).toEqual(['tessera'])
    expect(onChange).toHaveBeenCalled()

    // Исчезнувший раздел обрезает путь до живого уровня.
    expect(
      resolveMenuLevel(menu, ['gone', 'x'], {}, ENGLISH_LABELS, loads).path,
    ).toEqual([])

    // Отказ и повтор только с force; abort оставляет итоги, reset забывает.
    loads.reset()
    loadSection(move, sectionKey(['move']), {}, ENGLISH_LABELS, loads)
    fail(new Error('down'))
    await flush()
    expect(loads.get(sectionKey(['move']))?.status).toBe('failed')
    loadSection(move, sectionKey(['move']), {}, ENGLISH_LABELS, loads)
    expect(load).toHaveBeenCalledTimes(2)
    loadSection(move, sectionKey(['move']), {}, ENGLISH_LABELS, loads, true)
    expect(load).toHaveBeenCalledTimes(3)
    expect(loads.get(sectionKey(['move']))?.status).toBe('loading')
    loads.abort()
    expect(loads.get(sectionKey(['move']))).toBeUndefined()

    loadSection(move, sectionKey(['move']), {}, ENGLISH_LABELS, loads)
    answer([leaf('inbox')])
    await flush()
    loads.abort()
    expect(loads.get(sectionKey(['move']))?.status).toBe('done')
    loads.reset()
    expect(loads.get(sectionKey(['move']))).toBeUndefined()
  })
})
