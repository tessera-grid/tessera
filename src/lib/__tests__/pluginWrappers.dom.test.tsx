// @vitest-environment happy-dom
/**
 * Обёртки и декораторы плагинов перетаскивания (ADR 0168, §2): свёртка из записей и
 * вложение в гриде.
 * Запуск: npx vitest run --config vitest.node.config.ts pluginWrappers
 */
import { type ComponentType, type ReactNode, act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'

import { foldEntries } from '../core/features'
import {
  type PluginWrapper,
  createEmptyWrappers,
  registerWrappersInto,
} from '../core/pluginWrappers'
import { useDecorators, wrapWith } from '../grid/pluginWrappers'
import { columnDragging, rowDragging } from '../plugins'
;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

const renderToHtml = (node: ReactNode) => {
  const host = document.createElement('div')
  const root = createRoot(host)
  act(() => root.render(node))
  const html = host.innerHTML
  act(() => root.unmount())
  return html
}

const mark =
  (name: string, slot: string) =>
  ({ [slot]: Next, ...props }: Record<string, any>) => (
    <i data-layer={name}>
      <Next {...props} />
    </i>
  )

const Base = ({ label }: { label: string }) => <b>{label}</b>

/** Вложенные декораторы вокруг базы; без декораторов — база как есть. */
const Decorated = ({
  decorators,
  slot,
}: {
  decorators: PluginWrapper<any>[]
  slot: string
}) => {
  const decorated = useDecorators(decorators, Base, slot)
  if (!decorated) return <Base label="base" />
  const Outer = decorated.Outer as ComponentType<Record<string, unknown>>
  return <Outer label="base" {...{ [slot]: decorated.Inner }} />
}

describe('обёртки и декораторы (ADR 0168)', () => {
  it('DM4: слоты тела — обёртка тела и декоратор строки и незагруженной строки: без записи строка рисуется без лишних компонентов, записи вкладываются в порядке набора, повтор по id — на месте, обёртка тела собирается и у выключенного плагина', () => {
    const on = foldEntries([
      rowDragging({ onRowDragEnd: () => {} }),
    ] as never).wrappers
    expect(on.bodyBoundary.map(item => item.id)).toEqual(['rowDragging'])
    expect(on.rowDecorator.map(item => item.id)).toEqual(['rowDragging'])
    expect(on.pendingRowDecorator.map(item => item.id)).toEqual(['rowDragging'])
    const off = foldEntries([rowDragging({ enabled: false })] as never).wrappers
    expect(off.bodyBoundary).toHaveLength(1)
    expect(off.rowDecorator).toEqual([])
    expect(off.pendingRowDecorator).toEqual([])

    expect(renderToHtml(<Decorated decorators={[]} slot="Row" />)).toBe(
      '<b>base</b>',
    )
    const first = { id: 'first', component: mark('first', 'Row') }
    const second = { id: 'second', component: mark('second', 'Row') }
    expect(
      renderToHtml(<Decorated decorators={[first, second]} slot="Row" />),
    ).toBe('<i data-layer="first"><i data-layer="second"><b>base</b></i></i>')

    const folded = createEmptyWrappers()
    registerWrappersInto(folded, { rowDecorator: first }, true)
    registerWrappersInto(folded, { rowDecorator: second }, true)
    const replaced = { id: 'first', component: mark('replaced', 'Row') }
    registerWrappersInto(folded, { rowDecorator: replaced }, true)
    expect(folded.rowDecorator).toEqual([replaced, second])

    const Wrap =
      (name: string) =>
      ({ children }: { children: ReactNode }) => (
        <s data-wrapper={name}>{children}</s>
      )
    expect(
      renderToHtml(
        wrapWith(
          [
            { id: 'outer', component: Wrap('outer') },
            { id: 'inner', component: Wrap('inner') },
          ],
          {},
          <b>body</b>,
        ),
      ),
    ).toBe(
      '<s data-wrapper="outer"><s data-wrapper="inner"><b>body</b></s></s>',
    )
  })

  it('DM7: слоты шапки — обёртка шапки, обёртка серии соседей и декоратор ячейки шапки: без записи ячейка рисуется без лишних компонентов, записи вкладываются в порядке набора, обёртка шапки собирается и у выключенного плагина', () => {
    const on = foldEntries([columnDragging()] as never).wrappers
    expect(on.headBoundary.map(item => item.id)).toEqual(['columnDragging'])
    expect(on.headSeries.map(item => item.id)).toEqual(['columnDragging'])
    expect(on.headCellDecorator.map(item => item.id)).toEqual([
      'columnDragging',
    ])
    const off = foldEntries([
      columnDragging({ enabled: false }),
    ] as never).wrappers
    expect(off.headBoundary).toHaveLength(1)
    expect(off.headSeries).toEqual([])
    expect(off.headCellDecorator).toEqual([])

    expect(renderToHtml(<Decorated decorators={[]} slot="Cell" />)).toBe(
      '<b>base</b>',
    )
    expect(
      renderToHtml(
        <Decorated
          decorators={[
            { id: 'first', component: mark('first', 'Cell') },
            { id: 'second', component: mark('second', 'Cell') },
          ]}
          slot="Cell"
        />,
      ),
    ).toBe('<i data-layer="first"><i data-layer="second"><b>base</b></i></i>')
  })
})
