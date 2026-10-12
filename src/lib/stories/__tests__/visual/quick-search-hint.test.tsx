import axe from 'axe-core'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { quickSearch } from '../../../plugins'
import { filteringColumns, filteringData } from '../../__mocks__/filteringData'
import { bodyRows } from '../helpers'
import { composed } from '../stories'

// Подсказка быстрого поиска (ADR 0053): QS1–QS2, QS4–QS5, QS8. QS3, QS6–QS7 —
// модульные (`src/lib/__tests__/quickSearchHint.dom.test.tsx`), QS9 — `play` истории
// «Filtering — Server».

const HINT = 'Search in columns: Name, City, Age, Visits'

const input = () =>
  document.querySelector<HTMLInputElement>('[data-testid="quick-search"]')
const info = () =>
  document.querySelector<HTMLElement>('[data-testid="quick-search-hint"]')!
/** Base UI держит недоступное поле тулбара фокусируемым — `aria-disabled`. */
const isDisabled = () =>
  input()!.disabled || input()!.getAttribute('aria-disabled') === 'true'
/** Текст открытых тултипов (попапы Base UI несут `data-side`). */
const tooltipText = () =>
  [...document.querySelectorAll('[data-side]')]
    .map(el => el.textContent)
    .join(' ')
const description = () =>
  document.getElementById(input()!.getAttribute('aria-describedby')!)
    ?.textContent ?? ''

const mount = async (node: React.ReactElement) => {
  const result = await render(node)
  // Тулбар грузится лениво.
  await expect.poll(input).not.toBeNull()
  return result
}

/** Снять или вернуть колонку в меню «Колонки». */
const toggleColumn = async (id: string) => {
  await userEvent.click(
    document.querySelector<HTMLElement>(
      '[data-testid="column-visibility-button"]',
    )!,
  )
  const checkbox = () =>
    document.querySelector<HTMLElement>(
      `[data-testid="column-visibility-menu"] [data-column-id="${id}"] [role="checkbox"]`,
    )
  await expect.poll(checkbox).not.toBeNull()
  await userEvent.click(checkbox()!)
  await userEvent.keyboard('{Escape}')
}

describe('Quick search hint', () => {
  test('QS1: the info icon shows the search columns, in display order, on hover and on focus', async () => {
    await mount(<composed.Filtering />)
    await userEvent.hover(info())
    await expect.poll(tooltipText, { timeout: 3000 }).toContain(HINT)
    await userEvent.unhover(info())
    await expect.poll(tooltipText).not.toContain(HINT)

    // Фокус с клавиатуры: подсказка от фокуса открывается только после ввода с клавиатуры.
    // Тулбар — роуминг-фокус: к иконке после поля ведёт стрелка вправо.
    input()!.focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(document.activeElement).toBe(info())
    await expect.poll(tooltipText, { timeout: 3000 }).toContain(HINT)
  })

  test('QS2: the same text is the accessible description of the field', async () => {
    await mount(<composed.Filtering />)
    expect(description()).toBe(HINT)
    expect(info().getAttribute('aria-label')).toBe(HINT)
  })

  test('QS4: the hint texts come from localization and the icon from icons', async () => {
    const Host = () => {
      const table = useCreateTable({
        columns: filteringColumns as never,
        data: filteringData,
        plugins: [quickSearch()],
      })
      return (
        <div style={{ height: 400 }}>
          <DataGrid
            table={table as never}
            localization={{
              searchColumnsHint: (columns: string[]) =>
                `Ищем: ${columns.join(' / ')}`,
              searchNoColumns: 'Нечего искать',
            }}
            icons={{ info: () => <svg data-testid="custom-info" /> }}
          />
        </div>
      )
    }
    await mount(<Host />)
    expect(description()).toBe('Ищем: Name / City / Age / Visits')
    expect(info().querySelector('[data-testid="custom-info"]')).not.toBeNull()
  })

  test('QS5: with no search columns the field is disabled with a reason; the typed search is kept and works again once a column returns', async () => {
    await mount(
      <composed.Filtering
        enableColumnVisibility
        columnsOverride={[
          { id: 'name', accessorKey: 'name', header: 'Name' },
          {
            id: 'vip',
            accessorKey: 'vip',
            header: 'VIP',
            filter: { type: 'boolean', nullable: true },
          },
        ]}
      />,
    )
    const total = bodyRows().length
    await userEvent.fill(input()!, 'Alice')
    await expect.poll(() => bodyRows().length).toBeLessThan(total)
    const filtered = bodyRows().length

    await toggleColumn('name')
    await expect.poll(() => isDisabled()).toBe(true)
    expect(input()!.value).toBe('Alice')
    expect(description()).toBe('No columns to search')
    await expect.poll(() => bodyRows().length).toBe(total)

    await toggleColumn('name')
    await expect.poll(() => isDisabled()).toBe(false)
    await expect.poll(() => bodyRows().length).toBe(filtered)
  })

  test.each(['light', 'dark'] as const)(
    'QS8: the icon and its tooltip pass axe with color-contrast (%s); the icon target is at least 24×24',
    async colorMode => {
      const { container } = await mount(
        <composed.Filtering colorMode={colorMode} />,
      )
      await userEvent.hover(info())
      await expect.poll(tooltipText, { timeout: 3000 }).toContain(HINT)
      const results = await axe.run(container, {
        rules: {
          region: { enabled: false },
          'scrollable-region-focusable': { enabled: false },
        },
      })
      expect(
        results.violations.map(
          v => `${v.id}: ${v.nodes.map(n => n.target).join(' ')}`,
        ),
      ).toEqual([])
      const { width, height } = info().getBoundingClientRect()
      expect(Math.min(width, height)).toBeGreaterThanOrEqual(24)
    },
  )
})
