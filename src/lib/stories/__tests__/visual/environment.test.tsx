import { StrictMode, useEffect, useRef } from 'react'
import { hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { columnSorting, rowSelection } from '../../../plugins'
import { Tooltip } from '../../../ui/Tooltip'

// Совместимость окружений (ADR 0091): ref триггера подсказки (EV2 — и в
// `test:react18`), StrictMode по умолчанию (EV3), гидратация серверного HTML (EV5).

const frame = () => new Promise(resolve => requestAnimationFrame(resolve))

describe('Совместимость окружений (ADR 0091)', () => {
  test('EV2: Tooltip сохраняет ref триггера и открывается по наведению', async () => {
    const seen: (HTMLElement | null)[] = []
    const Trigger = () => {
      const ref = useRef<HTMLButtonElement>(null)
      useEffect(() => {
        seen.push(ref.current)
      })
      return (
        <Tooltip title="Подсказка" delayDuration={0}>
          <button ref={ref} type="button" data-testid="trigger">
            Кнопка
          </button>
        </Tooltip>
      )
    }
    await render(<Trigger />)
    const button = document.querySelector<HTMLElement>(
      '[data-testid="trigger"]',
    )!
    expect(seen.at(-1)).toBe(button)
    await userEvent.hover(button)
    await expect
      .poll(() =>
        [...document.querySelectorAll('[data-side]')].some(
          el => el.textContent === 'Подсказка',
        ),
      )
      .toBe(true)
  })

  test('EV3: браузерные тесты идут в StrictMode — эффект запускается дважды', async () => {
    let runs = 0
    const Probe = () => {
      useEffect(() => {
        runs++
      }, [])
      return null
    }
    await render(<Probe />)
    expect(runs).toBe(2)
  })

  describe('EV5: гидратация', () => {
    let root: Root | undefined
    let host: HTMLElement | undefined

    afterEach(() => {
      root?.unmount()
      host?.remove()
      root = undefined
      host = undefined
    })

    interface Item {
      id: string
      name: string
      n: number
    }

    const DATA: Item[] = Array.from({ length: 200 }, (_, i) => ({
      id: `r${i}`,
      name: `Name ${String(i).padStart(3, '0')}`,
      n: (i * 37 + 5) % 200,
    }))
    const COLUMNS = [
      { id: 'name', accessorKey: 'name', header: 'Name', size: 160 },
      { id: 'n', accessorKey: 'n', header: 'N', size: 100 },
    ]

    const App = () => {
      const table = useCreateTable({
        columns: COLUMNS as never,
        data: DATA,
        getRowId: (row: Item) => row.id,
        plugins: [rowSelection(), columnSorting()] as never,
      })
      return (
        <div style={{ width: 420, height: 360 }}>
          <DataGrid table={table as never} />
        </div>
      )
    }

    test('WS4: серверный рендер и гидратация — грид целиком, без рамки и нарезки', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      try {
        host = document.createElement('div')
        host.innerHTML = renderToString(<App />)
        document.body.append(host)
        // Сервер рисует грид со строками, а не пустую рамку первого рендера (ADR 0203).
        const container = host.querySelector('.data-grid__container')
        expect(container).not.toBeNull()
        const serverRows = host.querySelectorAll('.data-grid__body-row').length
        root = hydrateRoot(host, <App />)
        for (let i = 0; i < 10; i++) await frame()
        // Гидратация берёт серверную разметку: контейнер — тот же узел, строк не меньше.
        expect(host.querySelector('.data-grid__container')).toBe(container)
        expect(
          host.querySelectorAll('.data-grid__body-row').length,
        ).toBeGreaterThanOrEqual(serverRows)
      } finally {
        error.mockRestore()
      }
    })

    test('EV5: серверный HTML гидрируется без ошибок; после гидратации нажатие сортирует, а прокрутка рисует строки', async () => {
      const recoverable: unknown[] = []
      const errors: string[] = []
      const error = vi.spyOn(console, 'error').mockImplementation((...args) => {
        const message = String(args[0])
        // Сервер здесь — renderToString в браузере, где есть document: React 18
        // предупреждает о любом useLayoutEffect. Без DOM грид его не зовёт (EV4).
        if (!message.includes('useLayoutEffect does nothing on the server')) {
          errors.push(args.map(String).join(' '))
        }
      })
      try {
        host = document.createElement('div')
        host.innerHTML = renderToString(
          <StrictMode>
            <App />
          </StrictMode>,
        )
        document.body.append(host)
        expect(host.querySelector('.data-grid-theme')).not.toBeNull()

        root = hydrateRoot(
          host,
          <StrictMode>
            <App />
          </StrictMode>,
          { onRecoverableError: e => recoverable.push(e) },
        )
        await expect
          .poll(() => host!.querySelectorAll('.data-grid__body-row').length)
          .toBeGreaterThan(3)
        for (let i = 0; i < 5; i++) await frame()
        expect(recoverable, 'ошибки гидратации').toEqual([])
        expect(errors, 'console.error').toEqual([])
      } finally {
        error.mockRestore()
      }

      const firstN = () =>
        host!.querySelector(
          '.data-grid__body-row[data-index="0"] [data-column-id="n"]',
        )?.textContent
      expect(firstN()).toBe('5')
      const head = host.querySelector<HTMLElement>(
        '.data-grid__head-cell[data-column-id="n"]',
      )!
      await userEvent.hover(head)
      const sort = head.querySelector<HTMLElement>('.column-sort__button')!
      await expect.poll(() => getComputedStyle(sort).visibility).toBe('visible')
      await userEvent.click(sort)
      await expect.poll(() => head.getAttribute('aria-sort')).not.toBe('none')
      await expect.poll(firstN).not.toBe('5')

      const scroller = host.querySelector<HTMLElement>('.data-grid__container')!
      scroller.scrollTop = 4000
      await expect
        .poll(() =>
          [...host!.querySelectorAll<HTMLElement>('.data-grid__body-row')].some(
            row => Number(row.dataset.index) > 60,
          ),
        )
        .toBe(true)
    })
  })
})
