import { describe, expect, test } from 'vitest'
import { render } from 'vitest-browser-react'

import { dataGridArgTypes } from '../../__mocks__/utils/dataGridControls'
import { Stories } from '../helpers'

// Контролы историй DataGrid (ADR 0117): аргументы, которые меняют грид на лету.

const BODY_ROW = '.data-grid__body-row'

describe('контролы историй (ADR 0117)', () => {
  test('SN10: контрол expandAll раскрывает все строки и сворачивает их на лету, без перемонтирования грида; виден только при включённом раскрытии строк', async () => {
    expect(
      (dataGridArgTypes as Record<string, { if?: { arg?: string } }>).expandAll
        ?.if?.arg,
    ).toBe('enableRowExpanding')

    const props = (expandAll: boolean) => ({
      containerHeight: 600,
      height: 500,
      maxHeight: 500,
      dataCount: 30,
      dataNesting: 'nested' as const,
      enableRowExpanding: true,
      expandAll,
    })
    const screen = await render(<Stories.AllFeatures {...props(false)} />)
    await expect
      .poll(() => document.querySelectorAll(BODY_ROW).length)
      .toBeGreaterThan(3)
    const first = document.querySelector<HTMLElement>(BODY_ROW)!
    const child = () =>
      document.querySelector(
        `${BODY_ROW}[data-row-id="${first.dataset.rowId}-0"]`,
      )
    expect(child()).toBeNull()

    await screen.rerender(<Stories.AllFeatures {...props(true)} />)
    await expect.poll(child).not.toBeNull()
    // Та же строка на месте: грид не перемонтирован.
    expect(document.querySelector(BODY_ROW)).toBe(first)

    await screen.rerender(<Stories.AllFeatures {...props(false)} />)
    await expect.poll(child).toBeNull()
    expect(document.querySelector(BODY_ROW)).toBe(first)
  })
})
