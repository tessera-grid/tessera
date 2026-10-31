import { useMemo } from 'react'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { __resetLogger } from '../../../util/logger'
import {
  type LabelDictionary,
  unknownLabelKeys,
} from '../../../core/localization'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { pagination, quickSearch, rowSelection } from '../../../plugins'
import { RU_LABELS } from '../../__mocks__/localization.ru'

// Словарь подписей на таблице (ADR 0132): перевод из JSON, язык чисел и форм слова,
// проверка ключей.

/** Неразрывный пробел — разделитель тысяч в русском `Intl.NumberFormat`. */
const NBSP = ' '
const ROWS = 12_340

const columns = [{ id: 'name', accessorKey: 'name', header: 'Name' }]

interface HostProps {
  localization?: LabelDictionary
  locale?: string
  /** Выбор строк со счётчиком в нижней панели. */
  selection?: boolean
  /** Поле быстрого поиска в тулбаре, без задержки. */
  search?: boolean
}

const Host = ({
  localization,
  locale,
  selection = false,
  search = false,
}: HostProps) => {
  const data = useMemo(
    () =>
      Array.from({ length: ROWS }, (_, index) => ({
        id: String(index),
        name: `Name ${index}`,
      })),
    [],
  )
  const plugins = useMemo(
    () => [
      pagination(),
      ...(selection ? [rowSelection({ selectedCount: true })] : []),
      ...(search ? [quickSearch({ debounceMs: 0 })] : []),
    ],
    [selection, search],
  )
  const table = useCreateTable({
    columns: columns as never,
    data,
    plugins,
    locale,
  })
  return (
    <div style={{ height: 400 }}>
      <DataGrid table={table} localization={localization} />
    </div>
  )
}

const range = () =>
  document.querySelector('[data-testid="pagination-range"]')?.textContent

afterEach(() => {
  vi.restoreAllMocks()
  __resetLogger()
})

const selectedText = () =>
  document.querySelector('[data-testid="selected-rows-count"]')?.textContent
const announcements = () =>
  [...document.querySelectorAll('[role="status"][aria-live="polite"]')]
    .map(node => node.textContent ?? '')
    .join(' | ')
/** Флажки строк, видимых под шапкой: смонтированные за краем области — не в счёт. */
const rowBoxes = () => {
  const top = document
    .querySelector('.data-grid__head')!
    .getBoundingClientRect().bottom
  return [...document.querySelectorAll<HTMLElement>('.data-grid__body-row')]
    .filter(row => row.getBoundingClientRect().top >= top - 1)
    .sort((a, b) => Number(a.dataset.index) - Number(b.dataset.index))
    .map(row => row.querySelector<HTMLElement>('[role="checkbox"]')!)
}
const selectFirst = async (count: number) => {
  for (const box of rowBoxes().slice(0, count)) {
    if (box.getAttribute('aria-checked') !== 'true') await userEvent.click(box)
  }
}

describe('Словарь подписей на таблице', () => {
  test('LC10: смена localization и locale на лету меняет подписи и объявления без пересоздания таблицы; выбор, фильтры и прокрутка на месте', async () => {
    const view = await render(<Host selection search />)
    const input = () =>
      document.querySelector<HTMLInputElement>('[data-testid="quick-search"]')
    await expect.poll(input).not.toBeNull()
    await userEvent.fill(input()!, '1')
    await expect.poll(range).not.toBe('1–25 of 12,340')
    const scroller = document.querySelector<HTMLElement>(
      '.data-grid__container',
    )!
    scroller.scrollTop = 200
    // Firefox хранит прокрутку дробной — допуск в пиксель.
    await expect
      .poll(() => Math.abs(scroller.scrollTop - 200))
      .toBeLessThanOrEqual(1)
    await new Promise(resolve => requestAnimationFrame(resolve))
    await selectFirst(2)
    await expect.poll(selectedText).toBe('2 rows selected')
    const body = document.querySelector('.data-grid__body')
    const scrollTop = scroller.scrollTop

    await view.rerender(
      <Host selection search localization={RU_LABELS} locale="ru-RU" />,
    )
    await expect.poll(selectedText).toBe('Выбрано: 2 строки')
    expect(input()!.placeholder).toBe('Поиск')
    expect(input()!.value).toBe('1')
    expect(scroller.scrollTop).toBe(scrollTop)
    expect(document.querySelector('.data-grid__body')).toBe(body)

    await selectFirst(3)
    await expect.poll(announcements).toContain('Выбрано: 3 строки')
  })

  test('LC9: словарь из JSON без функций переводит всю таблицу: подписи, объявления скринридеру, формы «1 строка / 2 строки / 5 строк», числа «12 340»', async () => {
    expect(
      Object.values(RU_LABELS).filter(value => typeof value !== 'string'),
    ).toEqual([])
    expect(unknownLabelKeys(RU_LABELS)).toEqual([])
    await render(<Host localization={RU_LABELS} locale="ru-RU" selection />)
    await expect.poll(range).toBe(`1–25 из 12${NBSP}340`)
    expect(
      document.querySelector('[role="table"]')?.getAttribute('aria-label'),
    ).toBe('Таблица данных')
    for (const [count, text] of [
      [1, 'Выбрано: 1 строка'],
      [2, 'Выбрано: 2 строки'],
      [5, 'Выбрано: 5 строк'],
    ] as const) {
      for (const box of rowBoxes().slice(0, count)) {
        if (box.getAttribute('aria-checked') !== 'true')
          await userEvent.click(box)
      }
      await expect.poll(selectedText).toBe(text)
      await expect.poll(announcements).toContain(text)
    }
  })

  test('LC5: опция locale таблицы задаёт язык форм числа, чисел и списков; по умолчанию en-US', async () => {
    const localization = { pageRange: '{from}–{to} из {total}' }
    const view = await render(<Host localization={localization} />)
    await expect.poll(range).toBe('1–25 из 12,340')

    await view.rerender(<Host localization={localization} locale="ru" />)
    await expect.poll(range).toBe(`1–25 из 12${NBSP}340`)
  })

  test('LC8: тип словаря — плоские ключи подписей и ключи форм числа у подписей с count; неизвестный ключ переданного словаря — предупреждение в dev', async () => {
    // Лишнее свойство литерала TypeScript отмечает одно на литерал: по литералу на случай.
    const formWithoutCount: LabelDictionary = {
      // @ts-expect-error — у подписи без `count` форм слова нет
      pageRange_one: 'одна',
    }
    const typo: LabelDictionary = {
      // @ts-expect-error — такой подписи у таблицы нет
      pageRang: 'опечатка',
    }
    const typed: LabelDictionary = {
      pageRange: '{from}–{to}',
      selectedRows_few: 'Выбрано {count} строки',
      ...formWithoutCount,
      ...typo,
    }
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await render(<Host localization={typed} />)
    await expect.poll(range).toBe('1–25')
    const warned = warn.mock.calls.map(([message]) => String(message))
    expect(warned).toContain(
      '[tessera] localization: unknown label key "pageRange_one"',
    )
    expect(warned).toContain(
      '[tessera] localization: unknown label key "pageRang"',
    )
    expect(warned.join('\n')).not.toContain('"selectedRows_few"')
    expect(warned.join('\n')).not.toContain('"pageRange"')
  })
})
