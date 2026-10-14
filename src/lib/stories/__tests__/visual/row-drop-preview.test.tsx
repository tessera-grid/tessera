import axe from 'axe-core'
import { commands, server, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { getTreeLines } from '../../../grid/treeBranches'
import { composed } from '../stories'
import { settleRowMotion } from '../helpers'
import { AXE_OPTIONS, inBothThemes, toRgba } from './a11y-helpers'
import { tokenColor, tokenPx } from './tree-lines-helpers'

// Превью броска строки (ADR 0108): слот — скелет на уровне броска, линии дерева окна —
// как после броска. Перетаскивание — настоящей мышью Playwright (TQ3).

type Point = { x: number; y: number }
type Pointer = {
  realDragHold: (from: Point, to: Point, steps?: number) => Promise<void>
  realMouseMove: (from: Point, to: Point, steps?: number) => Promise<void>
  realMouseUp: () => Promise<void>
  forcedColors: (active: boolean) => Promise<void>
}
const pointer = commands as unknown as Pointer

const BODY_ROW = '.data-grid__body-row'
const HANDLE = '.drag__handler--column'
const INDENT = '[data-column-id="country"]'
const SKELETON = '[class*="skeleton"]'

const rowById = (id: string) =>
  document.querySelector<HTMLElement>(`${BODY_ROW}[data-row-id="${id}"]`)
const slot = () =>
  document.querySelector<HTMLElement>(`${BODY_ROW}[data-row-draggable="true"]`)
const container = () =>
  document.querySelector<HTMLElement>('.data-grid__container')!
const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve))
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/** Строки в видимом порядке: по месту, куда их ставит dnd-kit, без анимации. */
const rowsInOrder = () =>
  [...document.querySelectorAll<HTMLElement>(BODY_ROW)]
    .map(row => {
      const shift = /,\s*(-?[\d.]+)px,\s*0px\)$/.exec(row.style.transform)
      return { row, top: row.offsetTop + Number(shift?.[1] ?? 0) }
    })
    .sort((a, b) => a.top - b.top)
    .map(({ row }) => row)

/** Линии ячейки отступа: вид части и уровень, например `elbow2 rail1`. */
const linesOf = (row: HTMLElement) =>
  [
    ...row.querySelectorAll<HTMLElement>(
      `${INDENT} [aria-hidden] > span:not([data-leaving])`,
    ),
  ]
    .map(span => {
      const kind = /joinedElbow/.test(span.className)
        ? 'joined'
        : /elbow/.test(span.className)
          ? 'elbow'
          : /rail/.test(span.className)
            ? 'rail'
            : 'stub'
      return kind + span.style.getPropertyValue('--tsr-tree-level')
    })
    .sort()
    .join(' ')

/** Глубина строки по отступу первой колонки. */
const depthOf = (row: HTMLElement) =>
  Math.round(
    parseFloat(getComputedStyle(row.querySelector(INDENT)!).paddingLeft) /
      tokenPx('--tsr-comp-row-nesting-indent'),
  ) || 0

const renderTree = async () => {
  const screen = await render(<composed.RowDraggingTreeLines />)
  await expect.poll(() => rowById('node-0-0')).not.toBeNull()
  return screen
}

const TITLE = '.data-grid__cell-wrapper-title'
const USER_CONTENT =
  '.data-grid__body-cell:not([data-actions-column-cell="true"]) > .data-grid__cell-wrapper-content'
const CLOUD_TITLE = `.data-grid-body__row ${TITLE}`

/** Начало содержимого строки глубины 0 — от него считаются уровни броска. */
const levelZeroOf = (row: HTMLElement) => {
  const content = row.querySelector<HTMLElement>(USER_CONTENT)!
  return (
    content.getBoundingClientRect().left +
    parseFloat(getComputedStyle(content).paddingLeft) -
    depthOf(row) * tokenPx('--tsr-comp-row-nesting-indent')
  )
}

/** Начало текста облака под указателем. */
const cloudText = () =>
  document.querySelector<HTMLElement>(CLOUD_TITLE)!.getBoundingClientRect().left

/**
 * Взять строку за ручку и держать над строкой `overId`, выровняв текст облака по
 * отступу уровня `depth` (ADR 0108, §2). Возвращает точку указателя и начало уровней.
 */
const dragOver = async (id: string, overId: string, depth: number) => {
  const row = rowById(id)!
  await userEvent.hover(row)
  const levelZero = levelZeroOf(row)
  const handle = row.querySelector<HTMLElement>(HANDLE)!.getBoundingClientRect()
  const from = {
    x: handle.left + handle.width / 2,
    y: handle.top + handle.height / 2,
  }
  const over = rowById(overId)!.getBoundingClientRect()
  const to = {
    x: from.x,
    y: over.top + over.height / 2 + (over.top > from.y ? 6 : -6),
  }
  await pointer.realDragHold(from, to)
  await expect.poll(() => document.querySelector(CLOUD_TITLE)).not.toBeNull()
  const step = tokenPx('--tsr-comp-row-nesting-indent')
  const aligned = { x: to.x + levelZero + depth * step - cloudText(), y: to.y }
  await pointer.realMouseMove(to, aligned, 4)
  for (let i = 0; i < 4; i++) await nextFrame()
  return { at: aligned, levelZero, step }
}

/** Подвести указатель по вертикали, пока слот не встанет сразу после строки `prevId`. */
const settleSlotAfter = async (prevId: string, at: Point) => {
  for (let i = 0; i < 40; i++) {
    const order = rowsInOrder()
    const index = order.findIndex(row => row.dataset.rowId === prevId)
    const slotIndex = order.findIndex(row => row === slot())
    if (slotIndex === index + 1) return at
    const next = { x: at.x, y: at.y + (slotIndex <= index ? 3 : -3) }
    await pointer.realMouseMove(at, next, 1)
    at = next
    for (let f = 0; f < 2; f++) await nextFrame()
  }
  throw new Error(`slot did not settle after ${prevId}`)
}

/** Линии строки по ветке и отростку — как их рисует ячейка отступа (ADR 0102). */
const expectedLines = (depth: number, branch: string, open: boolean) => {
  const parts: string[] = []
  for (let level = 1; level < depth; level++)
    if (branch[level - 1] === '1') parts.push('rail' + level)
  if (depth > 0) {
    if (branch[depth - 1] === '1') parts.push('joined' + depth, 'rail' + depth)
    else parts.push('elbow' + depth)
  }
  if (open) parts.push('stub' + (depth + 1))
  return depth > 0 || open ? parts.sort().join(' ') : ''
}

/**
 * Линии строк окна сверены с порядком, в который их ставит dnd-kit в этом же кадре.
 * Строки ниже последнего корня окна не сверяются: их ветки зависят от строк за окном.
 */
const linesMatchOrder = () => {
  const rows = rowsInOrder()
  const depths = rows.map(row => ({ depth: depthOf(row) }))
  let lastRoot = depths.length - 1
  while (lastRoot >= 0 && depths[lastRoot].depth !== 0) lastRoot--
  const lines = getTreeLines(depths)
  const mismatches: string[] = []
  for (let i = 0; i < lastRoot; i++) {
    const want = expectedLines(depths[i].depth, lines.branch(i), lines.open(i))
    const got = linesOf(rows[i])
    if (want !== got)
      mismatches.push(`${rows[i].dataset.rowId}: ${got} ≠ ${want}`)
  }
  return mismatches
}

const release = async () => {
  await pointer.realMouseUp()
  await expect.poll(() => slot()).toBeNull()
  await settleRowMotion()
}

describe('Превью броска строки (ADR 0108)', () => {
  test('PV4: с линиями дерева линии всех строк окна перед отпусканием — те же, что после броска: перенос через ветки, смена уровня на месте, с последнего места ветки', async () => {
    const cases: [id: string, overId: string, depth: number][] = [
      ['node-0-0', 'node-1-1', 1],
      ['node-1-2', 'node-1-2', 0],
      ['node-0-2', 'node-0-0', 1],
      ['row-0', 'node-1-0', 1],
    ]
    for (const [id, overId, depth] of cases) {
      const screen = await renderTree()
      const before = new Map(
        rowsInOrder().map(row => [row.dataset.rowId!, linesOf(row)]),
      )
      await dragOver(id, overId, depth)
      expect(slot(), `${id}: drag started`).not.toBeNull()
      // Превью снимается, когда порядок и линии перестали меняться.
      let last = ''
      await expect
        .poll(() => {
          const now = rowsInOrder()
            .map(row => row.dataset.rowId + linesOf(row))
            .join()
          const stable = now === last
          last = now
          return stable
        })
        .toBe(true)
      expect(container().hasAttribute('data-row-drop-invalid'), id).toBe(false)
      const preview = new Map(
        rowsInOrder().map(row => [row.dataset.rowId!, linesOf(row)]),
      )
      const previewDepth = depthOf(slot()!)
      // Превью — не прежние линии: строка ушла с места или уровня.
      expect(
        [...preview].some(([rowId, lines]) => before.get(rowId) !== lines),
        id,
      ).toBe(true)
      await release()
      const after = new Map(
        rowsInOrder().map(row => [row.dataset.rowId!, linesOf(row)]),
      )
      expect(depthOf(rowById(id)!), `${id} depth`).toBe(previewDepth)
      for (const [rowId, lines] of after) {
        if (preview.has(rowId))
          expect(preview.get(rowId), `${id} → ${overId}: ${rowId}`).toBe(lines)
      }
      await screen.unmount()
    }
  })

  test('PV1: слот — скелет строки: полоски в пользовательских колонках, служебные пустые, без волны; фон — как у обычной строки, заливки нет', async () => {
    const screen = await renderTree()
    await dragOver('node-0-1', 'node-1-0', 1)
    try {
      const row = slot()!
      expect(row).not.toBeNull()
      const cells = [
        ...row.querySelectorAll<HTMLElement>('.data-grid__body-cell'),
      ]
      const service = cells.filter(
        cell => cell.dataset.actionsColumnCell === 'true',
      )
      const user = cells.filter(cell => !service.includes(cell))
      expect(user.length).toBeGreaterThan(2)
      for (const cell of user) {
        expect(
          cell.querySelector(SKELETON),
          cell.dataset.columnId,
        ).not.toBeNull()
        expect(cell.textContent?.trim(), cell.dataset.columnId).toBe('')
      }
      for (const cell of service)
        expect(cell.querySelector(SKELETON), cell.dataset.columnId).toBeNull()
      const stripe = row.querySelector<HTMLElement>(SKELETON)!
      expect(getComputedStyle(stripe).animationName).toBe('none')
      // Фон — как у строки той же чётности, а не цвет приёма.
      const twin = [...document.querySelectorAll<HTMLElement>(BODY_ROW)].find(
        other => other !== row && other.dataset.rowOdd === row.dataset.rowOdd,
      )!
      expect(getComputedStyle(row).backgroundColor).toBe(
        getComputedStyle(twin).backgroundColor,
      )
    } finally {
      await release()
      await screen.unmount()
    }
  })

  test('PV2: уровень броска — отступ первой колонки слота, как у строки этой глубины; строка целиком не сдвигается', async () => {
    const screen = await renderTree()
    // Под последней строкой группы можно и в группу, и в корень.
    const dragged = await dragOver('row-0', 'node-0-2', 1)
    const to = await settleSlotAfter('node-0-2', dragged.at)
    try {
      const step = tokenPx('--tsr-comp-row-nesting-indent')
      const left = () => slot()!.getBoundingClientRect().left
      const rowLeft = rowById('row-1')!.getBoundingClientRect().left
      expect(depthOf(slot()!)).toBe(1)
      expect(
        parseFloat(
          getComputedStyle(slot()!.querySelector(INDENT)!).paddingLeft,
        ),
      ).toBe(step)
      expect(left()).toBe(rowLeft)
      // Указатель влево на шаг отступа — корень: отступа нет, строка на месте.
      const back = { x: to.x - step, y: to.y }
      await pointer.realMouseMove(to, back)
      await expect.poll(() => depthOf(slot()!)).toBe(0)
      expect(left()).toBe(rowLeft)
    } finally {
      await release()
      await screen.unmount()
    }
  })

  test('PV3: недопустимое место — полоски в тоне ошибки, линий дерева у слота нет', async () => {
    const screen = await renderTree()
    // Группа с детьми вглубь не вкладывается (ADR 0006).
    await dragOver('node-1', 'node-2-0', 1)
    try {
      await expect
        .poll(() => container().hasAttribute('data-row-drop-invalid'))
        .toBe(true)
      const row = slot()!
      const stripe = row.querySelector<HTMLElement>(SKELETON)!
      expect(getComputedStyle(stripe).backgroundColor).toBe(
        tokenColor('--tsr-comp-row-drop-invalid-skeleton-bg', row),
      )
      expect(getComputedStyle(stripe).backgroundColor).not.toBe(
        tokenColor('--tsr-comp-skeleton-bg', container()),
      )
      expect(linesOf(row)).toBe('')
    } finally {
      await release()
      await screen.unmount()
    }
  })

  test('PV5: смена места и уровня меняет превью в том же кадре — линии окна в каждом кадре сходятся с порядком строк', async () => {
    const screen = await renderTree()
    const row = rowById('node-0-0')!
    await userEvent.hover(row)
    const handle = row
      .querySelector<HTMLElement>(HANDLE)!
      .getBoundingClientRect()
    const from = {
      x: handle.left + handle.width / 2,
      y: handle.top + handle.height / 2,
    }
    const far = rowById('node-2-1')!.getBoundingClientRect()
    const mismatches: string[] = []
    let frames = 0
    let sampling = true
    const sample = () => {
      if (!sampling) return
      if (slot()) {
        frames++
        mismatches.push(...linesMatchOrder())
      }
      requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
    try {
      const mid = { x: from.x, y: far.top + far.height / 2 }
      const right = { x: from.x + 120, y: mid.y }
      await pointer.realDragHold(from, mid, 24)
      await pointer.realMouseMove(mid, right, 8)
      await pointer.realMouseMove(right, from, 24)
      await sleep(100)
    } finally {
      sampling = false
      await release()
    }
    expect(frames).toBeGreaterThan(20)
    expect(mismatches).toEqual([])
    await screen.unmount()
  })

  test('PV8: высокая контрастность — полоски слота GrayText, недопустимое место — Mark; axe с контрастом в обеих темах во время перетаскивания', async () => {
    const sys = (name: string) => {
      const probe = document.createElement('span')
      probe.style.color = name
      document.body.append(probe)
      const value = getComputedStyle(probe).color
      probe.remove()
      return value
    }
    const axeDuring = () =>
      inBothThemes(async () => {
        const result = await axe.run(
          document.querySelector<HTMLElement>(
            '[role="table"], [role="treegrid"]',
          )!,
          {
            ...AXE_OPTIONS,
            rules: {
              ...AXE_OPTIONS.rules,
              'color-contrast': { enabled: true },
            },
          },
        )
        expect(result.violations).toEqual([])
      })
    let screen: Awaited<ReturnType<typeof renderTree>> | undefined
    /** Каждое перетаскивание — на свежем гриде: бросок меняет данные истории. */
    const dragFresh = async (id: string, overId: string, depth: number) => {
      await screen?.unmount()
      screen = await renderTree()
      await dragOver(id, overId, depth)
    }
    const stripe = () =>
      getComputedStyle(slot()!.querySelector(SKELETON)!).backgroundColor
    try {
      await dragFresh('node-0-1', 'node-1-0', 1)
      await axeDuring()
      await release()
      await dragFresh('node-1', 'node-2-0', 1)
      await axeDuring()
      await release()
      if (server.browser !== 'webkit') {
        await pointer.forcedColors(true)
        await dragFresh('node-0-1', 'node-1-0', 1)
        expect(stripe()).toBe(sys('GrayText'))
        await release()
        await dragFresh('node-1', 'node-2-0', 1)
        expect(stripe()).toBe(sys('Mark'))
        await release()
      }
    } finally {
      await pointer.forcedColors(false)
      await pointer.realMouseUp()
      await screen?.unmount()
    }
  })

  test('PV10: уровень — по тексту облака: служебные колонки сдвигают начало уровней, шаг — шаг отступа; уровень k — когда текст облака дошёл до отступа уровня k', async () => {
    const screen = await renderTree()
    try {
      // Перед первой пользовательской колонкой — две служебные: ручка и раскрытие.
      const cells = [
        ...rowById('node-0-1')!.querySelectorAll<HTMLElement>(
          '.data-grid__body-cell',
        ),
      ]
      const firstUser = cells.findIndex(
        cell => cell.dataset.actionsColumnCell !== 'true',
      )
      expect(firstUser).toBe(2)
      const dragged = await dragOver('row-0', 'node-0-2', 0)
      const { levelZero, step } = dragged
      const at = await settleSlotAfter('node-0-2', dragged.at)
      expect(depthOf(slot()!)).toBe(0)
      const textAt = async (x: number) => {
        const target = { x: at.x + x - (cloudText() - levelZero), y: at.y }
        await pointer.realMouseMove(at, target, 2)
        at.x = target.x
        for (let i = 0; i < 3; i++) await nextFrame()
        return depthOf(slot()!)
      }
      // Под текстом группы и до отступа ребёнка — ещё не вложена.
      expect(await textAt(step / 2 + 4)).toBe(0)
      expect(await textAt(step - 3)).toBe(0)
      expect(await textAt(step + 3)).toBe(1)
      expect(await textAt(step - 3)).toBe(0)
    } finally {
      await release()
      await screen.unmount()
    }
  })

  test('PV11: части линий во время перетаскивания проявляются и гаснут за время переезда строк, вместе; погасшие убираются; линии на старте сессии не проявляются заново; без движения строк — сразу', async () => {
    const reveals = () =>
      [
        ...document.querySelectorAll<HTMLElement>(
          `${INDENT} [aria-hidden] > span`,
        ),
      ].flatMap(span => span.getAnimations())
    /** Длительность движения строк, мс: токен — `calc()`, его вычисляет переход. */
    const duration = () => {
      const probe = document.createElement('span')
      probe.style.transition = 'opacity var(--tsr-comp-row-motion-duration)'
      container().append(probe)
      const value =
        parseFloat(getComputedStyle(probe).transitionDuration) * 1000
      probe.remove()
      return value
    }
    // Медленное движение: проверка успевает застать проявление в любом движке.
    const slow = document.createElement('style')
    slow.textContent =
      '.data-grid-theme { --tsr-comp-row-motion-duration: 2000ms; }'
    document.head.append(slow)
    for (const motion of [true, false]) {
      const screen = await render(
        <composed.RowDraggingTreeLines enableRowAnimation={motion} />,
      )
      await expect.poll(() => rowById('node-0-0')).not.toBeNull()
      try {
        // Старт сессии над своим местом: прежние линии не проявляются заново.
        await dragOver('node-0-1', 'node-0-1', 1)
        expect(reveals(), 'старт').toEqual([])
        await release()
        // Строка-корень под последней строкой группы, на уровне 0.
        const dragged = await dragOver('row-0', 'node-0-2', 0)
        const at = await settleSlotAfter('node-0-2', dragged.at)
        expect(depthOf(slot()!)).toBe(0)
        await sleep(duration() + 100)
        // Новыми считаются части, которых не было до смены уровня.
        const before = new Set(
          document.querySelectorAll(`${INDENT} [aria-hidden] > span`),
        )
        // Одним шагом вправо — в группу: у группы продлевается ветка, у слота — поворот.
        await pointer.realMouseMove(
          at,
          { x: at.x + dragged.step + 2, y: at.y },
          1,
        )
        await expect.poll(() => depthOf(slot()!)).toBe(1)
        for (let i = 0; i < 2; i++) await nextFrame()
        const running = reveals()
        if (!motion) {
          expect(running, 'без движения').toEqual([])
          continue
        }
        const fresh = [
          ...document.querySelectorAll<HTMLElement>(
            `${INDENT} [aria-hidden] > span`,
          ),
        ].filter(span => !before.has(span))
        expect(fresh.length).toBeGreaterThan(1)
        for (const span of fresh)
          expect(span.getAnimations().length, span.className).toBe(1)
        const starts = running.map(animation => Number(animation.startTime))
        expect(Math.max(...starts) - Math.min(...starts)).toBeLessThan(40)
        for (const animation of running)
          expect(Number(animation.effect!.getTiming().duration)).toBeCloseTo(
            duration(),
            0,
          )
        // Ушедшие части гаснут, а не пропадают: повороту «последней» сестры на смену —
        // продолжение ветки.
        const leaving = [
          ...document.querySelectorAll<HTMLElement>(
            `${INDENT} [aria-hidden] > span[data-leaving]`,
          ),
        ]
        expect(leaving.length).toBeGreaterThan(0)
        for (const span of leaving) {
          const [fade] = span.getAnimations()
          expect(fade, span.className).toBeDefined()
          expect(
            (fade.effect as KeyframeEffect).getKeyframes().at(-1)?.opacity,
          ).toBe('0')
          expect(Number(fade.startTime) - Math.min(...starts)).toBeLessThan(40)
        }
        // Погасшие убираются.
        await expect
          .poll(
            () =>
              document.querySelectorAll(
                `${INDENT} [aria-hidden] > span[data-leaving]`,
              ).length,
            { timeout: duration() + 1500 },
          )
          .toBe(0)
      } finally {
        await release()
        await screen.unmount()
      }
    }
    slow.remove()
  })
})
