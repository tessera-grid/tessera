import axe from 'axe-core'
import { commands, server, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { getTreeLines } from '../../../grid/treeBranches'
import { composed } from '../stories'
import { settleRowMotion } from '../helpers'
import { AXE_OPTIONS, inBothThemes, toRgba } from './a11y-helpers'
import { tokenColor, tokenPx } from './tree-lines-helpers'
import {
  BODY_ROW,
  type Point,
  CLOUD_TITLE,
  HANDLE,
  INDENT,
  SKELETON,
  TITLE,
  USER_CONTENT,
  cloudText,
  container,
  depthOf,
  dragOver,
  levelZeroOf,
  nextFrame,
  pointer,
  release,
  rowById,
  rowsInOrder,
  settleSlotAfter,
  sleep,
  slot,
} from './row-drop-helpers'

// Превью броска строки (ADR 0108): слот — скелет на уровне броска, линии дерева окна —
// как после броска. Перетаскивание — настоящей мышью Playwright (TQ3).

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

const renderTree = async () => {
  const screen = await render(<composed.RowDraggingTreeLines />)
  await expect.poll(() => rowById('node-0-0')).not.toBeNull()
  return screen
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

// Бросок в свёрнутые группы и подсветка родителя (ADR 0109).

const EXPAND_BUTTON = '[data-column-id$="__rowExpanding"] button'
const PARENT = `${BODY_ROW}[data-row-drop-parent]`

const renderCollapsed = async (props: Record<string, unknown> = {}) => {
  // Грид во весь вьюпорт тестов: цели выше зоны автопрокрутки.
  const screen = await render(
    <composed.RowDraggingCollapsedGroups
      containerHeight={760}
      height={700}
      maxHeight={700}
      {...props}
    />,
  )
  await expect.poll(() => rowById('node-3')).not.toBeNull()
  return screen
}

/**
 * Указатель с `at` к строке `overId`, не меняя сдвига по горизонтали. Строки сначала
 * доезжают: раскрытая группа сдвигает их движением (ADR 0107).
 */
const moveOver = async (at: Point, overId: string) => {
  await settleRowMotion()
  const over = rowById(overId)!.getBoundingClientRect()
  const to = {
    x: at.x,
    y: over.top + over.height / 2 + (over.top > at.y ? 6 : -6),
  }
  await pointer.realMouseMove(at, to, 6)
  for (let i = 0; i < 3; i++) await nextFrame()
  return to
}

/** Порядок строк окна, слот — `slot`. */
const orderWithSlot = () =>
  rowsInOrder().map(row => (row === slot() ? 'slot' : row.dataset.rowId))

/** id подсвеченных родителей. */
const parents = () =>
  [...document.querySelectorAll<HTMLElement>(PARENT)].map(
    row => row.dataset.rowId,
  )

/** Свёрнутое дерево без паузы, группа `node-1` раскрыта кликом. */
const renderWithOpenGroup = async (treeLines: boolean) => {
  const screen = await renderCollapsed({
    rowDraggingExpandDelay: 0,
    enableTreeLines: treeLines,
  })
  await userEvent.click(rowById('node-1')!.querySelector(EXPAND_BUTTON)!)
  await expect.poll(() => rowById('node-1-2')).not.toBeNull()
  await settleRowMotion()
  return screen
}

describe('Бросок в свёрнутые группы (ADR 0109)', () => {
  test('NX1: слот под свёрнутой группой на уровне её детей через паузу 500 мс раскрывает её, слот — первый ребёнок; смена уровня до конца паузы сбрасывает таймер; на уровне группы она не раскрывается', async () => {
    const screen = await renderCollapsed()
    try {
      // Сестрой после группы — группа не раскрывается.
      const dragged = await dragOver('row-0', 'node-1', 0)
      let at = await settleSlotAfter('node-1', dragged.at)
      expect(depthOf(slot()!)).toBe(0)
      await sleep(800)
      expect(rowById('node-1-0'), 'уровень группы').toBeNull()
      const shift = async (levels: number) => {
        const next = { x: at.x + levels * dragged.step, y: at.y }
        await pointer.realMouseMove(at, next, 1)
        at = next
      }
      // На уровень ребёнка: пауза ещё идёт — группа свёрнута.
      await shift(1)
      await expect.poll(() => depthOf(slot()!)).toBe(1)
      await sleep(300)
      expect(rowById('node-1-0'), 'до конца паузы').toBeNull()
      // Назад и снова вперёд — таймер с нуля: 300 + 300 мс больше паузы, а группа свёрнута.
      await shift(-1)
      await expect.poll(() => depthOf(slot()!)).toBe(0)
      await shift(1)
      await expect.poll(() => depthOf(slot()!)).toBe(1)
      await sleep(300)
      expect(rowById('node-1-0'), 'таймер сброшен').toBeNull()
      await expect
        .poll(() => rowById('node-1-0'), { timeout: 2000 })
        .not.toBeNull()
      await expect
        .poll(() => {
          const order = orderWithSlot()
          const group = order.indexOf('node-1')
          return order.slice(group, group + 3)
        })
        .toEqual(['node-1', 'slot', 'node-1-0'])
      expect(depthOf(slot()!)).toBe(1)
    } finally {
      await release()
      await screen.unmount()
    }
  })

  test('NX10: раскрытие паузой не сдвигает слот и строки над ним ни в одном кадре; строки ниже группы едут вниз без возврата', async () => {
    const screen = await renderCollapsed()
    try {
      const dragged = await dragOver('row-0', 'node-1', 1)
      await settleSlotAfter('node-1', dragged.at)
      await settleRowMotion()
      const topOf = (element: HTMLElement | null) =>
        Math.round(element?.getBoundingClientRect().top ?? NaN)
      const still = { slot: topOf(slot()), group: topOf(rowById('node-1')) }
      const jumps: string[] = []
      const below: number[] = []
      let sampling = true
      const sample = () => {
        if (!sampling) return
        const now = { slot: topOf(slot()), group: topOf(rowById('node-1')) }
        if (now.slot !== still.slot || now.group !== still.group)
          jumps.push(`слот ${now.slot}, группа ${now.group}`)
        below.push(topOf(rowById('node-2')))
        requestAnimationFrame(sample)
      }
      requestAnimationFrame(sample)
      await expect
        .poll(() => rowById('node-1-0'), { timeout: 2000 })
        .not.toBeNull()
      await settleRowMotion()
      sampling = false
      expect(jumps).toEqual([])
      // Ниже группы — только вниз: ни шага назад.
      const steps = below.slice(1).map((top, i) => top - below[i])
      expect(Math.min(...steps)).toBeGreaterThanOrEqual(0)
      expect(below.at(-1)! - below[0]).toBeGreaterThan(0)
    } finally {
      await release()
      await screen.unmount()
    }
  })

  test('NX2: бросок в свёрнутую группу раскрывает её — строка видна первым ребёнком, на месте и уровне превью', async () => {
    // Без паузы: группа свёрнута до самого броска.
    const screen = await renderCollapsed({ rowDraggingExpandDelay: 0 })
    try {
      const dragged = await dragOver('row-0', 'node-1', 1)
      await settleSlotAfter('node-1', dragged.at)
      expect(depthOf(slot()!)).toBe(1)
      await sleep(700)
      expect(rowById('node-1-0'), 'во время сессии').toBeNull()
      await release()
      await expect.poll(() => rowById('node-1-0')).not.toBeNull()
      const order = rowsInOrder().map(row => row.dataset.rowId)
      const group = order.indexOf('node-1')
      expect(order.slice(group, group + 3)).toEqual([
        'node-1',
        'row-0',
        'node-1-0',
      ])
      expect(depthOf(rowById('row-0')!)).toBe(1)
    } finally {
      await screen.unmount()
    }
  })

  test('NX3: после броска раскрытые паузой группы сворачиваются, кроме группы броска; во время сессии не сворачиваются; раскрытые до сессии не трогаются; при отмене сворачиваются все', async () => {
    let screen = await renderCollapsed({ rowDraggingExpandDelay: 200 })
    try {
      // Раскрыта до сессии.
      await userEvent.click(rowById('node-3')!.querySelector(EXPAND_BUTTON)!)
      await expect.poll(() => rowById('node-3-0')).not.toBeNull()
      await settleRowMotion()
      const dragged = await dragOver('row-0', 'node-1', 1)
      let at = await settleSlotAfter('node-1', dragged.at)
      await expect.poll(() => rowById('node-1-0')).not.toBeNull()
      at = await moveOver(at, 'node-2')
      at = await settleSlotAfter('node-2', at)
      expect(depthOf(slot()!)).toBe(1)
      await expect.poll(() => rowById('node-2-0')).not.toBeNull()
      expect(rowById('node-1-0'), 'во время сессии').not.toBeNull()
      await release()
      await expect.poll(() => rowById('node-1-0')).toBeNull()
      expect(rowById('node-2-0'), 'группа броска').not.toBeNull()
      expect(rowById('node-3-0'), 'раскрыта до сессии').not.toBeNull()
      expect(depthOf(rowById('row-0')!)).toBe(1)
      await screen.unmount()

      // Отмена — Escape: свёрнуты все раскрытые паузой.
      screen = await renderCollapsed({ rowDraggingExpandDelay: 200 })
      const again = await dragOver('row-0', 'node-1', 1)
      at = await settleSlotAfter('node-1', again.at)
      await expect.poll(() => rowById('node-1-0')).not.toBeNull()
      at = await moveOver(at, 'node-2')
      await settleSlotAfter('node-2', at)
      await expect.poll(() => rowById('node-2-0')).not.toBeNull()
      await userEvent.keyboard('{Escape}')
      await expect.poll(() => slot()).toBeNull()
      await expect.poll(() => rowById('node-1-0')).toBeNull()
      expect(rowById('node-2-0')).toBeNull()
    } finally {
      await pointer.realMouseUp()
      await screen.unmount()
    }
  })

  test('NX5: при уровне слота больше 0 строка будущего родителя залита токеном — с линиями дерева и без; на уровне 0 и на недопустимом месте подсветки нет; подсвечена только строка родителя', async () => {
    for (const treeLines of [true, false]) {
      const screen = await renderWithOpenGroup(treeLines)
      try {
        // В другую группу, последним ребёнком: оттуда можно и в корень.
        const dragged = await dragOver('row-0', 'node-1-2', 1)
        const at = await settleSlotAfter('node-1-2', dragged.at)
        await expect.poll(parents).toEqual(['node-1'])
        const parent = rowById('node-1')!
        expect(
          getComputedStyle(parent).backgroundImage,
          `treeLines ${treeLines}`,
        ).toContain(tokenColor('--tsr-comp-row-drop-parent-bg', parent))
        // Ветка родителя не подсвечена.
        for (const id of ['node-1-0', 'node-1-1'])
          expect(getComputedStyle(rowById(id)!).backgroundImage, id).toBe(
            'none',
          )
        // Уровень 0 — родителя нет.
        const back = { x: at.x - dragged.step, y: at.y }
        await pointer.realMouseMove(at, back, 1)
        await expect.poll(() => depthOf(slot()!)).toBe(0)
        await expect.poll(parents).toEqual([])
        await release()
        // Перестановка в своей группе — родитель тот же и подсвечен.
        const own = await dragOver('node-1-0', 'node-1-1', 1)
        await settleSlotAfter('node-1-1', own.at)
        await expect.poll(parents).toEqual(['node-1'])
        await release()
        // Недопустимое место: группа в группу — без подсветки.
        await dragOver('node-0', 'node-1-0', 1)
        await expect
          .poll(() => container().hasAttribute('data-row-drop-invalid'))
          .toBe(true)
        expect(parents()).toEqual([])
      } finally {
        await release()
        await screen.unmount()
      }
    }
  })

  test('NX6: высокая контрастность — родитель обведён контуром Highlight; axe с контрастом в обеих темах во время перетаскивания с подсветкой', async () => {
    const screen = await renderWithOpenGroup(true)
    try {
      const dragged = await dragOver('row-0', 'node-1-1', 1)
      await settleSlotAfter('node-1-1', dragged.at)
      await expect.poll(parents).toEqual(['node-1'])
      await inBothThemes(async () => {
        const result = await axe.run(
          document.querySelector<HTMLElement>(
            '[role="treegrid"], [role="table"]',
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
      if (server.browser !== 'webkit') {
        await pointer.forcedColors(true)
        const probe = document.createElement('span')
        probe.style.color = 'Highlight'
        document.body.append(probe)
        const highlight = getComputedStyle(probe).color
        probe.remove()
        const style = getComputedStyle(rowById('node-1')!)
        expect(style.outlineStyle).toBe('solid')
        expect(style.outlineColor).toBe(highlight)
      }
    } finally {
      await pointer.forcedColors(false)
      await release()
      await screen.unmount()
    }
  })
})
