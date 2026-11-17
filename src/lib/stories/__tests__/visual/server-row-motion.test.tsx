import { render } from 'vitest-browser-react'
import { commands, userEvent } from 'vitest/browser'
import { describe, expect, test } from 'vitest'

import '../../../ui/theme/theme.css'
import type { TesseraFeatureEntry } from '../../../core/features'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  columnSorting,
  pagination,
  quickSearch,
  serverRowModel,
  type ServerRowsRequest,
  type ServerRowsResponse,
} from '../../../plugins'
import { settleRowMotion } from '../helpers'

// Движение строк серверной модели при смене выборки (ADR 0228, EM1–EM8): строки, уцелевшие в
// окне, едут; ушедшие уезжают призраком к краю или гаснут; вошедшие проявляются. Позиции и
// прозрачность снимаются каждый кадр, пока приходит окно новой выборки.

interface Item {
  id: string
  name: string
}

const COLUMNS = [{ id: 'name', accessorKey: 'name', header: 'Name' }]
const NO_DATA: Item[] = []
const TOTAL = 1000
/** Движение по умолчанию (250 мс) с запасом на кадры, мс. */
const SETTLE_MS = 600

const itemOf = (k: number): Item => ({ id: `r${k}`, name: `N${k}` })
const ALL = Array.from({ length: TOTAL }, (_, k) => itemOf(k))
/**
 * Поиск `narrow`: чётные строки прежнего списка; r301 — новая в окне на месте 3; r1 уходит за
 * окно на место 60, в загруженный блок; r3 и прочие нечётные уходят из выборки.
 */
const NARROW = (() => {
  const list = ALL.filter((_, k) => k % 2 === 0)
  list.splice(3, 0, itemOf(301))
  list.splice(60, 0, itemOf(1))
  return list
})()
const DESC = [...ALL].reverse()
/** Прокрутка, после которой первый блок из пяти строк вне окна и вытеснен (EM6). */
const SKELETON_SCROLL = 10

const listOf = ({ globalFilter, sorting }: ServerRowsRequest) =>
  globalFilter === 'narrow' ? NARROW : sorting[0]?.desc ? DESC : ALL

interface Held {
  request: ServerRowsRequest
  answer: () => void
}

/** «Сервер»: отвечает сразу или держит ответы, пока тест их не отпустит; `refuse` — отказ. */
const server = () => {
  const held: Held[] = []
  const state = { hold: false, refuse: false }
  const getRows = (request: ServerRowsRequest) =>
    new Promise<ServerRowsResponse<Item>>((resolve, reject) => {
      const answer = () => {
        if (state.refuse) {
          reject(new Error('down'))
          return
        }
        const list = listOf(request)
        resolve({
          rows: list.slice(request.start, request.end),
          rowCount: list.length,
        })
      }
      if (state.hold) held.push({ request, answer })
      else answer()
    })
  const release = () => {
    state.hold = false
    for (const call of held.splice(0)) {
      if (!call.request.signal.aborted) call.answer()
    }
  }
  return { held, state, getRows, release }
}

const Grid = ({
  getRows,
  plugins = [],
  blockSize = 100,
  maxBlocks,
  rowAnimation,
}: {
  getRows: ReturnType<typeof server>['getRows']
  plugins?: readonly TesseraFeatureEntry[]
  blockSize?: number
  maxBlocks?: number
  rowAnimation?: boolean
}) => {
  const table = useCreateTable({
    rowCount: TOTAL,
    columns: COLUMNS as never,
    data: NO_DATA,
    getRowId: (row: Item) => row.id,
    enableRowAnimation: rowAnimation,
    // Свечение обновления сразу, без задержки показа (ADR 0094).
    refreshOptions: { delayMs: 0, minDurationMs: 0 },
    plugins: [
      serverRowModel({ getRows, blockSize, maxBlocks }),
      quickSearch({ debounceMs: 0 }),
      ...plugins,
    ] as never,
  })
  return (
    <div style={{ width: 600, height: 420 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const q = <T extends Element = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)
const body = () => q('.data-grid__body')!
const scroller = () => q('.data-grid__container')!
const searchInput = () => q<HTMLInputElement>('[data-testid="quick-search"]')!
const glowing = () => !!q('[data-refreshing]')
const rowById = (id: string) => q(`.data-grid__body-row[data-row-id="${id}"]`)
const ghosts = () => [
  ...document.querySelectorAll<HTMLElement>('[data-row-ghost]'),
]
/** Призрак строки — по тексту её ячейки: id у копии снят. */
const ghostOf = (name: string) =>
  ghosts().find(ghost => ghost.textContent?.trim() === name)
const skeletonRows = () => [
  ...document.querySelectorAll<HTMLElement>('[data-pending-row]'),
]
const rowHeight = () => rowById('r0')!.getBoundingClientRect().height
/** Верх элемента относительно тела, px. */
const topOf = (element: Element) =>
  element.getBoundingClientRect().top - body().getBoundingClientRect().top
/**
 * Прозрачность движения: своя и предков внутри тела — призраки гаснут группой (RM31); тело,
 * приглушённое на время обновления (ADR 0094), не в счёт.
 */
const opacityOf = (element: Element) => {
  let opacity = 1
  const stop = body()
  for (
    let el: Element | null = element;
    el && el !== stop;
    el = el.parentElement
  ) {
    opacity *= Number(getComputedStyle(el).opacity)
  }
  return opacity
}
const translated = (element: Element) => {
  const { translate } = getComputedStyle(element)
  return translate !== 'none' && translate !== '0px'
}
/** В кадре всё стоит: строки без сдвига и полупрозрачности, призраков нет. */
const still = () =>
  ghosts().length === 0 &&
  [...document.querySelectorAll<HTMLElement>('.data-grid__body-row')].every(
    row => !translated(row) && getComputedStyle(row).opacity === '1',
  )
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const pointer = commands as unknown as {
  reducedMotion: (reduce: boolean) => Promise<void>
}

/** Значения `read` в каждом кадре, пока идёт `act` и `ms` после него. */
const sampleFrames = async <T,>(
  read: () => T,
  act: () => Promise<unknown> | unknown,
  ms = SETTLE_MS,
) => {
  // Первый кадр — до действия.
  const frames: T[] = [read()]
  let sampling = true
  const sample = () => {
    if (!sampling) return
    frames.push(read())
    requestAnimationFrame(sample)
  }
  requestAnimationFrame(sample)
  await act()
  await sleep(ms)
  sampling = false
  return frames
}

/** Позиция пройдена плавно: есть кадры строго между стартом и концом. */
const passesBetween = (tops: number[], from: number, to: number) =>
  tops.filter(
    top => top > Math.min(from, to) + 1 && top < Math.max(from, to) - 1,
  ).length > 2

const mount = async (props: Omit<Parameters<typeof Grid>[0], 'getRows'>) => {
  const srv = server()
  const screen = await render(<Grid getRows={srv.getRows} {...props} />)
  await expect.poll(() => rowById('r0')).not.toBeNull()
  await expect.poll(() => q('[data-testid="quick-search"]')).not.toBeNull()
  return { srv, screen }
}

/**
 * Сменить выборку действием `change`, пока «сервер» держит ответы, и снимать `read` каждый
 * кадр, пока приходит окно новой выборки.
 */
const changeSelection = async <T,>(
  srv: ReturnType<typeof server>,
  change: () => Promise<unknown>,
  read: () => T,
) => {
  srv.state.hold = true
  await change()
  await expect.poll(glowing).toBe(true)
  await expect.poll(() => srv.held.length).toBeGreaterThan(0)
  const frames = await sampleFrames(read, () => srv.release())
  await expect.poll(glowing).toBe(false)
  return frames
}

const typeSearch = (text: string) => () => userEvent.fill(searchInput(), text)

describe('Движение строк серверной модели при смене выборки (ADR 0228)', () => {
  test('EM1: поиск, оставивший в новом окне часть строк прежнего, двигает эти строки на новые места', async () => {
    const { srv, screen } = await mount({})
    try {
      const size = rowHeight()
      const frames = await changeSelection(srv, typeSearch('narrow'), () => ({
        r2: rowById('r2') && topOf(rowById('r2')!),
        r6: rowById('r6') && topOf(rowById('r6')!),
      }))
      await settleRowMotion()
      // r2 — с места 2 на 1, r6 — с места 6 на 4: строки проходят путь, а не встают сразу.
      expect(topOf(rowById('r2')!)).toBeCloseTo(size, 0)
      expect(topOf(rowById('r6')!)).toBeCloseTo(4 * size, 0)
      expect(
        passesBetween(
          frames.map(frame => frame.r2 ?? 2 * size),
          2 * size,
          size,
        ),
      ).toBe(true)
      expect(
        passesBetween(
          frames.map(frame => frame.r6 ?? 6 * size),
          6 * size,
          4 * size,
        ),
      ).toBe(true)
    } finally {
      await screen.unmount()
    }
  })

  test('EM2: строка, ушедшая из окна, есть в загруженном блоке новой выборки — уезжает призраком к краю окна; нет — гаснет на месте', async () => {
    const { srv, screen } = await mount({})
    try {
      const size = rowHeight()
      const frames = await changeSelection(srv, typeSearch('narrow'), () => {
        const away = ghostOf('N1')
        const gone = ghostOf('N3')
        return {
          away: away && { top: topOf(away), opacity: opacityOf(away) },
          gone: gone && { top: topOf(gone), opacity: opacityOf(gone) },
        }
      })
      await settleRowMotion()
      // r1 ушла на место 60 загруженного блока: призрак едет вниз от своего места.
      const away = frames.flatMap(frame => (frame.away ? [frame.away] : []))
      expect(away.length).toBeGreaterThan(2)
      expect(away[0]!.top).toBeCloseTo(size, 0)
      expect(Math.max(...away.map(frame => frame.top))).toBeGreaterThan(
        3 * size,
      )
      // r3 ушла из выборки: призрак гаснет, не сходя с места.
      const gone = frames.flatMap(frame => (frame.gone ? [frame.gone] : []))
      expect(gone.length).toBeGreaterThan(2)
      expect(gone.every(frame => Math.abs(frame.top - 3 * size) < 1)).toBe(true)
      expect(
        gone.some(frame => frame.opacity > 0.1 && frame.opacity < 0.9),
      ).toBe(true)
      expect(ghosts()).toHaveLength(0)
    } finally {
      await screen.unmount()
    }
  })

  test('EM3: строка, вошедшая в окно с новой выборкой, проявляется на своём месте без сдвига', async () => {
    const { srv, screen } = await mount({})
    try {
      const size = rowHeight()
      const frames = await changeSelection(srv, typeSearch('narrow'), () => {
        const row = rowById('r301')
        return row && { top: topOf(row), opacity: opacityOf(row) }
      })
      await settleRowMotion()
      const shown = frames.flatMap(frame => (frame ? [frame] : []))
      expect(shown.length).toBeGreaterThan(2)
      expect(shown.every(frame => Math.abs(frame.top - 3 * size) < 1)).toBe(
        true,
      )
      expect(shown.some(frame => frame.opacity < 0.9)).toBe(true)
      expect(opacityOf(rowById('r301')!)).toBe(1)
    } finally {
      await screen.unmount()
    }
  })

  test('EM4: смена выборки, после которой в окне нет ни одной прежней строки (сортировка по убыванию), движения не запускает', async () => {
    const { srv, screen } = await mount({
      plugins: [columnSorting({ multiSort: false })],
    })
    const sortButton = () =>
      q('.data-grid__head-cell[data-column-id="name"] .column-sort__button')!
    try {
      // Первое нажатие сортирует по убыванию: ни одной прежней строки в окне.
      const frames = await changeSelection(
        srv,
        () => userEvent.click(sortButton()),
        still,
      )
      await expect.poll(() => rowById('r999')).not.toBeNull()
      expect(frames.length).toBeGreaterThan(5)
      expect(frames.every(Boolean)).toBe(true)
    } finally {
      await screen.unmount()
    }
  })

  test('EM5: отказ серверного действия смены выборки движения не запускает, строки остаются на местах', async () => {
    const { srv, screen } = await mount({})
    try {
      const tops = () =>
        [...document.querySelectorAll<HTMLElement>('.data-grid__body-row')]
          .filter(row => row.dataset.rowId)
          .map(row => `${row.dataset.rowId}@${Math.round(topOf(row))}`)
          .join(',')
      const before = tops()
      srv.state.refuse = true
      const frames = await changeSelection(srv, typeSearch('narrow'), still)
      await settleRowMotion()
      expect(frames.length).toBeGreaterThan(5)
      expect(frames.every(Boolean)).toBe(true)
      expect(tops()).toBe(before)
    } finally {
      await screen.unmount()
    }
  })

  test('EM6: скелеты незагруженных строк нового окна не едут и не становятся призраками', async () => {
    // Первый блок вытеснен прокруткой: после прокрутки к началу верх окна — скелеты, ниже —
    // прежние строки, пока не придёт окно новой выборки.
    const { srv, screen } = await mount({ blockSize: 5, maxBlocks: 2 })
    try {
      const size = rowHeight()
      scroller().scrollTop = SKELETON_SCROLL * size
      await expect.poll(() => rowById(`r${SKELETON_SCROLL}`)).not.toBeNull()
      await expect
        .poll(() => scroller().hasAttribute('data-fast-scrolling'))
        .toBe(false)
      const frames = await changeSelection(srv, typeSearch('narrow'), () => ({
        skeletons: skeletonRows().length,
        loaded: body().querySelectorAll(':scope > [data-row-id]').length,
        skeletonMoving: skeletonRows().some(
          row => translated(row) || getComputedStyle(row).opacity !== '1',
        ),
        skeletonGhosts: ghosts().filter(
          ghost =>
            ghost.hasAttribute('data-pending-row') ||
            !!ghost.querySelector('[data-skeleton]'),
        ).length,
        r8: rowById('r8') && topOf(rowById('r8')!),
      }))
      await settleRowMotion()
      // До прихода окна — и скелеты, и прежние строки; прежние едут.
      expect(frames[0]!.skeletons).toBeGreaterThan(0)
      expect(frames[0]!.loaded).toBeGreaterThan(0)
      expect(
        passesBetween(
          frames.map(frame => frame.r8 ?? 8 * size),
          8 * size,
          5 * size,
        ),
      ).toBe(true)
      expect(frames.every(frame => !frame.skeletonMoving)).toBe(true)
      expect(frames.every(frame => frame.skeletonGhosts === 0)).toBe(true)
    } finally {
      await screen.unmount()
    }
  })

  test('EM7: с уменьшенным движением и с enableRowAnimation: false смена выборки движения не запускает', async () => {
    await pointer.reducedMotion(true)
    try {
      const { srv, screen } = await mount({})
      try {
        const frames = await changeSelection(srv, typeSearch('narrow'), still)
        expect(rowById('r301')).not.toBeNull()
        expect(frames.every(Boolean)).toBe(true)
      } finally {
        await screen.unmount()
      }
    } finally {
      await pointer.reducedMotion(false)
    }

    const { srv, screen } = await mount({ rowAnimation: false })
    try {
      const frames = await changeSelection(srv, typeSearch('narrow'), still)
      expect(rowById('r301')).not.toBeNull()
      expect(frames.every(Boolean)).toBe(true)
    } finally {
      await screen.unmount()
    }
  })

  test('EM8: с пагинацией серверной модели смена выборки двигает уцелевшие строки первой страницы по тому же правилу', async () => {
    const { srv, screen } = await mount({
      plugins: [pagination({ initialPageSize: 25 })],
    })
    try {
      const size = rowHeight()
      const frames = await changeSelection(srv, typeSearch('narrow'), () => {
        const kept = rowById('r6')
        const entered = rowById('r301')
        return {
          kept: kept && topOf(kept),
          entered: entered && opacityOf(entered),
          gone: ghostOf('N3') ? opacityOf(ghostOf('N3')!) : undefined,
        }
      })
      await settleRowMotion()
      expect(topOf(rowById('r6')!)).toBeCloseTo(4 * size, 0)
      expect(
        passesBetween(
          frames.map(frame => frame.kept ?? 6 * size),
          6 * size,
          4 * size,
        ),
      ).toBe(true)
      expect(
        frames.some(frame => frame.entered !== null && frame.entered < 0.9),
      ).toBe(true)
      expect(
        frames.some(
          frame =>
            frame.gone !== undefined && frame.gone > 0.1 && frame.gone < 0.9,
        ),
      ).toBe(true)
    } finally {
      await screen.unmount()
    }
  })
})
