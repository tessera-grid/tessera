// @vitest-environment happy-dom
/**
 * Включённое состояние кнопок (ADR 0129): узел бабла только у кнопки с `active` (AV4),
 * предупреждение о неизменной подписи (AV8), истории (AV9). Файлы историй — от корня
 * репозитория: happy-dom подменяет `URL`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { Toolbar } from '@base-ui/react/toolbar'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { __resetLogger } from '../core/logger'
import { CellButton } from '../grid/Actions/CellButton'
import { RowButton } from '../grid/Actions/RowButton'
import { IconButton, type IconButtonProps } from '../ui/IconButton'
import { ToolbarButton } from '../ui/ToolbarButton'

;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  __resetLogger()
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
  vi.restoreAllMocks()
})

const show = (node: React.ReactNode) => act(() => root.render(node))
const bubbles = () => host.querySelectorAll('[data-active-indicator]').length

const Kit = (props: Partial<IconButtonProps>) => (
  <IconButton {...props}>
    <svg />
  </IconButton>
)

describe('Включённое состояние кнопок (ADR 0129)', () => {
  it('AV4: кнопка без пропа active не держит в DOM узел бабла; узел есть только у кнопки, которой передан active', () => {
    show(
      <>
        <Kit label="Plain" />
        <CellButton label="Edit" icon={<svg />} />
        <RowButton label="Options" icon={<svg />} />
        <Toolbar.Root>
          <ToolbarButton label="Export" icon={<svg />} />
        </Toolbar.Root>
      </>,
    )
    expect(bubbles()).toBe(0)

    show(
      <>
        <Kit label="Plain" active={false} />
        <CellButton label="Edit" icon={<svg />} active={false} />
        <RowButton label="Options" icon={<svg />} active />
        <Toolbar.Root>
          <ToolbarButton label="Columns" icon={<svg />} active={false} />
        </Toolbar.Root>
      </>,
    )
    expect(bubbles()).toBe(4)
  })

  it('AV8: active не ставит aria-pressed; в разработке — одно предупреждение, если active сменился, а доступное имя нет, и у кнопки нет своего aria-pressed, aria-expanded или aria-checked', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const button = () => host.querySelector('button')!
    const warnings = () =>
      warn.mock.calls.filter(([message]) => String(message).includes('AV8'))

    show(<Kit label="Filter" active={false} />)
    show(<Kit label="Filter" active />)
    expect(button().hasAttribute('aria-pressed')).toBe(false)
    expect(warnings()).toHaveLength(1)
    show(<Kit label="Filter" active={false} />)
    show(<Kit label="Filter" active />)
    expect(warnings(), 'одно на подпись').toHaveLength(1)

    // Подпись следующего действия меняется вместе с active — молчим.
    show(<Kit label="Pin" active={false} />)
    show(<Kit label="Unpin" active />)
    // Имя — aria-label, тултип прежний.
    show(<Kit label="Columns" aria-label="Columns" active={false} />)
    show(<Kit label="Columns" aria-label="Columns, 2 hidden" active />)
    // Своё состояние ARIA у кнопки.
    for (const own of [
      { 'aria-pressed': false },
      { 'aria-expanded': false },
      { 'aria-checked': false },
    ]) {
      show(<Kit label="Toggle" {...own} active={false} />)
      show(<Kit label="Toggle" {...own} active />)
    }
    expect(warnings()).toHaveLength(1)
  })

  it('AV9: истории UI/IconButton «Active», «Active — count», «Active — icon»; у ToolbarButton в истории «Active» бабл виден', () => {
    const stories = (file: string) =>
      [
        ...readFileSync(
          join(process.cwd(), `src/lib/stories/${file}.stories.tsx`),
          'utf8',
        ).matchAll(
          /export const (\w+): Story = \{\s*name: '([^']+)',?\s*(?:parameters: [^\n]*\n\s*)?(?:args: (\{[^}]*\}))?/g,
        ),
      ].map(([, id, name, args]) => ({ id, name, args: args ?? '' }))

    const icon = stories('UI.IconButton')
    for (const [id, name, args] of [
      ['IconButtonActive', 'Active', /active: true/],
      ['IconButtonActiveCount', 'Active — count', /count: [1-9]/],
      ['IconButtonActiveIcon', 'Active — icon', /withActiveIcon: true/],
    ] as const) {
      const story = icon.find(entry => entry.id === id)
      expect(story?.name, id).toBe(name)
      expect(story?.args, id).toMatch(args)
    }

    const toolbar = stories('UI.ToolbarButton').find(
      entry => entry.id === 'ToolbarButtonActive',
    )
    expect(toolbar?.args).toMatch(/active: true/)
    show(
      <Toolbar.Root>
        <ToolbarButton label="Columns, 2 hidden" icon={<svg />} active />
      </Toolbar.Root>,
    )
    expect(
      host.querySelector('[data-active-indicator]')?.getAttribute('data-shown'),
    ).toBe('true')
  })
})
