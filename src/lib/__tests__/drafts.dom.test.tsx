// @vitest-environment happy-dom
/**
 * Реестр черновиков (ADR 0178, §1, DR1–DR3): срез данных, опции ядра и виды плагинов.
 * Запуск: npx vitest run --config vitest.node.config.ts drafts
 */
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { definePlugin } from '../core/definePlugin'
import { activeDrafts, type Draft, type DraftKind } from '../core/drafts/drafts'
import type { TesseraFeatureEntry } from '../core/features'
import { useCreateTable } from '../core/useCreateTable'

;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

type Row = { id: string; name: string }

const columns = [{ id: 'name', accessorKey: 'name', header: 'Name' }]
const ROWS: Row[] = [{ id: '1', name: 'A' }]

let captured: any
let root: Root | undefined
let container: HTMLElement | undefined

afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  container?.remove()
  container = undefined
  vi.restoreAllMocks()
})

interface HostProps {
  plugins?: TesseraFeatureEntry[]
  drafts?: readonly Draft[]
  onDraftsChange?: (next: readonly Draft[]) => void
  initialDrafts?: readonly Draft[]
}

const Host = ({ plugins = [], ...options }: HostProps) => {
  captured = useCreateTable({
    columns: columns as never,
    data: ROWS,
    getRowId: (row: Row) => row.id,
    plugins,
    ...options,
  } as never)
  return null
}

const mount = (props: HostProps) => {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  act(() => root!.render(createElement(Host, props)))
}
const rerender = (props: HostProps) =>
  act(() => root!.render(createElement(Host, props)))

const noteKind: DraftKind = {
  kind: 'note',
  label: () => 'Note',
  apply: () => {},
}
const notes = definePlugin<{ enabled?: boolean }>()({
  id: 'notes',
  draftKinds: [noteKind],
})

const note = (columnId: string, value: unknown): Draft => ({
  kind: 'note',
  target: { column: columnId },
  value,
})

describe('реестр черновиков (ADR 0178)', () => {
  it('DR1: срез ядра drafts — записи { kind, target, value }, одна на пару вида и цели; table.getDrafts(), setDraft, discardDraft; срез переживает JSON.stringify и JSON.parse без потерь', () => {
    mount({ plugins: [notes()] })
    expect(captured.getDrafts()).toEqual([])

    act(() => captured.setDraft(note('name', 'first')))
    act(() => captured.setDraft({ ...note('name', 'second') }))
    act(() =>
      captured.setDraft({
        kind: 'note',
        target: { cell: ['1', 'name'] },
        value: { at: '2026-11-02', list: [1, 2] },
      }),
    )
    // Та же пара вида и цели заменяет запись, другая цель — своя запись.
    expect(captured.getDrafts()).toEqual([
      note('name', 'second'),
      {
        kind: 'note',
        target: { cell: ['1', 'name'] },
        value: { at: '2026-11-02', list: [1, 2] },
      },
    ])
    expect(JSON.parse(JSON.stringify(captured.getDrafts()))).toEqual(
      captured.getDrafts(),
    )

    act(() => captured.discardDraft({ column: 'name' }, 'note'))
    expect(captured.getDrafts()).toHaveLength(1)
    act(() => captured.discardDraft({ column: 'missing' }, 'note'))
    expect(captured.getDrafts()).toHaveLength(1)
  })

  it('DR2: опции ядра drafts, onDraftsChange, initialDrafts — черновики приложения появляются в гриде, правки грида приходят колбэком', () => {
    // Без внешнего значения — начальное значение и колбэк о каждой правке.
    const onDraftsChange = vi.fn()
    mount({
      plugins: [notes()],
      initialDrafts: [note('name', 'start')],
      onDraftsChange,
    })
    expect(captured.getDrafts()).toEqual([note('name', 'start')])
    act(() => captured.setDraft(note('name', 'typed')))
    expect(onDraftsChange).toHaveBeenLastCalledWith([note('name', 'typed')])
    act(() => root!.unmount())

    // С внешним значением — грид показывает его и сообщает правки, не меняя сам.
    const controlled = vi.fn()
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    act(() =>
      root!.render(
        createElement(Host, {
          plugins: [notes()],
          drafts: [note('name', 'from app')],
          onDraftsChange: controlled,
        }),
      ),
    )
    expect(captured.getDrafts()).toEqual([note('name', 'from app')])
    act(() => captured.setDraft(note('name', 'typed')))
    expect(controlled).toHaveBeenLastCalledWith([note('name', 'typed')])
    expect(captured.getDrafts()).toEqual([note('name', 'from app')])
    rerender({
      plugins: [notes()],
      drafts: [note('name', 'typed')],
      onDraftsChange: controlled,
    })
    expect(captured.getDrafts()).toEqual([note('name', 'typed')])
  })

  it('DR3: вид черновика объявляет плагин-владелец (применить, отбросить, цель, подпись); черновик вида без включённого владельца инертен, в разработке — предупреждение', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const draft = note('name', 'x')
    mount({ plugins: [notes()], initialDrafts: [draft] })
    expect(
      captured.options.draftKinds.map((kind: DraftKind) => kind.kind),
    ).toEqual(['note'])
    expect(activeDrafts(captured)).toEqual([draft])
    expect(warn).not.toHaveBeenCalled()
    act(() => root!.unmount())

    // Владелец выключен: запись лежит в срезе, но инертна, и об этом — предупреждение.
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    act(() =>
      root!.render(
        createElement(Host, {
          plugins: [notes({ enabled: false })],
          initialDrafts: [draft],
        }),
      ),
    )
    expect(captured.getDrafts()).toEqual([draft])
    expect(activeDrafts(captured)).toEqual([])
    expect(
      warn.mock.calls.some(([message]) => String(message).includes('"note"')),
    ).toBe(true)
  })
})
