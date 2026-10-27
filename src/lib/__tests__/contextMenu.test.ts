/**
 * Headless/чистые проверки плагина contextMenu и вклада cellSelection (ADR 0030).
 * CM3/CM4/CM8 + свёртка канала contextMenuActions.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { foldEntries } from '../core/features'
import { resolveVisibleActions } from '../core/headerActions'
import type {
  ContextMenuAction,
  ContextMenuContext,
} from '../core/headerActions'
import { cellSelection } from '../plugins/cellSelection'
import { copyContextAction } from '../plugins/cellSelection/contextActions'
import { contextMenu } from '../plugins/contextMenu'

const ctxWith = (
  selection: Partial<ContextMenuContext['selection']>,
): ContextMenuContext =>
  ({
    selection: {
      count: 0,
      isSingle: false,
      isMultiple: false,
      isInSelection: false,
      ...selection,
    },
  }) as ContextMenuContext

describe('contextMenu — плагин и канал', () => {
  it('CM12: enabled по умолчанию → enableContextMenu true; enabled:false → false', () => {
    expect(
      foldEntries([contextMenu()] as never).options.enableContextMenu,
    ).toBe(true)
    expect(
      foldEntries([contextMenu({ enabled: false })] as never).options
        .enableContextMenu,
    ).toBe(false)
  })

  it('CM1: активный плагин контрибьютит пункт в contextMenuActions; disabled — нет', () => {
    const active = foldEntries([cellSelection()] as never)
    expect(active.contextMenuActions.map(a => a.id)).toContain(
      'cellSelection:copy',
    )

    const disabled = foldEntries([cellSelection({ enabled: false })] as never)
    expect(disabled.contextMenuActions).toHaveLength(0)
  })

  it('дедуп пунктов по id (последний побеждает)', () => {
    const a: ContextMenuAction = {
      id: 'dup',
      icon: () => null,
      label: () => 'A',
      onSelect: () => {},
    }
    const b: ContextMenuAction = { ...a, label: () => 'B' }
    const folded = foldEntries([
      { id: 'p1', contextMenuActions: [a] },
      { id: 'p2', contextMenuActions: [b] },
    ] as never)
    const dup = folded.contextMenuActions.filter(x => x.id === 'dup')
    expect(dup).toHaveLength(1)
    expect(dup[0].label(undefined as never, undefined as never)).toBe('B')
  })
})

describe('contextMenu — гейтинг по выбору (CM3)', () => {
  const single: ContextMenuAction = {
    id: 'single',
    icon: () => null,
    label: () => 'single',
    onSelect: () => {},
    visible: ctx => ctx.selection.isSingle,
  }
  const multi: ContextMenuAction = {
    id: 'multi',
    icon: () => null,
    label: () => 'multi',
    onSelect: () => {},
    visible: ctx => ctx.selection.isMultiple,
  }

  it('CM3: одиночный выбор — только single-действие', () => {
    const visible = resolveVisibleActions(
      [single, multi],
      ctxWith({ count: 1, isSingle: true }),
    )
    expect(visible.map(a => a.id)).toEqual(['single'])
  })

  it('CM13: мультивыбор — только multi-действие', () => {
    const visible = resolveVisibleActions(
      [single, multi],
      ctxWith({ count: 3, isMultiple: true }),
    )
    expect(visible.map(a => a.id)).toEqual(['multi'])
  })

  it('resolveVisibleActions сортирует по order', () => {
    const mk = (id: string, order?: number): ContextMenuAction => ({
      id,
      order,
      icon: () => null,
      label: () => id,
      onSelect: () => {},
    })
    const visible = resolveVisibleActions(
      [mk('c', 2), mk('a', 0), mk('b', 1)],
      ctxWith({}),
    )
    expect(visible.map(a => a.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('cellSelection — пункт «Копировать» (CM4)', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('CM4: «Копировать» виден, когда ячейка под курсором в выделении; иначе (в т.ч. сервисные) — нет', () => {
    expect(
      copyContextAction.visible?.(ctxWith({ count: 0, isInSelection: false })),
    ).toBe(false)
    // Сервисная ячейка: выбор где-то есть (count>0), но сама она не в выделении.
    expect(
      copyContextAction.visible?.(ctxWith({ count: 3, isInSelection: false })),
    ).toBe(false)
    expect(
      copyContextAction.visible?.(ctxWith({ count: 1, isInSelection: true })),
    ).toBe(true)
  })

  it('CM14: onSelect сериализует выделение в буфер (TSV-фолбэк)', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    vi.stubGlobal('ClipboardItem', undefined)

    const ctx = {
      ...ctxWith({ count: 4, isMultiple: true }),
      // Пункт идёт путём Ctrl+C (ADR 0146): прямоугольники выделения и источник строк.
      table: {
        store: {},
        options: {},
        atoms: {},
        getRowSource: () => ({ keyByIndex: false }),
        getCellSelectionBounds: () => [
          {
            minRowIndex: 0,
            maxRowIndex: 1,
            minColumnIndex: 0,
            maxColumnIndex: 1,
          },
        ],
        getSelectedCellRangesData: () => [
          [
            ['a', 'b'],
            ['c', 'd'],
          ],
        ],
      },
    } as unknown as ContextMenuContext

    copyContextAction.onSelect(ctx)
    await Promise.resolve()
    await Promise.resolve()

    expect(writeText).toHaveBeenCalledWith('a\tb\nc\td')
  })

  it('CM15: пустой выбор — в буфер не пишем', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    vi.stubGlobal('ClipboardItem', undefined)

    const ctx = {
      ...ctxWith({ count: 0 }),
      table: { getSelectedCellRangesData: () => [] },
    } as unknown as ContextMenuContext

    copyContextAction.onSelect(ctx)
    await Promise.resolve()

    expect(writeText).not.toHaveBeenCalled()
  })
})
