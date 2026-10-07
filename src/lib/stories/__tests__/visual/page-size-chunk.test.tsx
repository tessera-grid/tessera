import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { pagination } from '../../../plugins'

// Клик по выбору размера страницы до загрузки его модуля (ADR 0038, PG20). Отдельный
// файл: модуль грузится один раз на документ, а каждый файл набора идёт в своём
// iframe — здесь первый клик приходится на заглушку.

const DATA = Array.from({ length: 60 }, (_, i) => ({
  id: String(i),
  name: `Row ${i}`,
}))

const Grid = () => {
  const table = useCreateTable({
    columns: [{ id: 'name', accessorKey: 'name', header: 'Name' }] as never,
    data: DATA,
    plugins: [pagination()],
  })
  return (
    <div style={{ height: 400 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const options = () =>
  [...document.querySelectorAll<HTMLElement>('[role="option"]')].map(option =>
    option.textContent?.trim(),
  )

describe('Page size chunk', () => {
  test('PG20: клик по выбору размера страницы, пока его модуль грузится, не теряется — список открывается после загрузки', async () => {
    await render(<Grid />)
    // Модуль ещё не пришёл: кликают по заглушке — кнопке без `page-size-select`.
    expect(
      document.querySelector('[data-testid="page-size-select"]'),
    ).toBeNull()
    const placeholder = document.querySelector<HTMLElement>(
      'nav[data-testid="pagination"] button[aria-label="Rows per page"]',
    )
    expect(placeholder).not.toBeNull()
    placeholder!.click()

    await expect
      .poll(() => document.querySelector('[data-testid="page-size-select"]'))
      .not.toBeNull()
    await expect.poll(options).toContain('25')
    expect(placeholder!.getAttribute('aria-haspopup')).toBe('listbox')
  })
})
