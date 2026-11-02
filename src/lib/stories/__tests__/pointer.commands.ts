import type { BrowserCommand } from 'vitest/node'

interface Point {
  x: number
  y: number
}

type Page = Parameters<BrowserCommand<[]>>[0]['page']

/** Клиентские координаты тестового iframe → координаты страницы Playwright. */
const toPage = async (page: Page) => {
  // Тест рендерится в последнем дочернем iframe оркестратора Vitest.
  const frame = page.frames().at(-1)!
  const box = (await (await frame.frameElement()).boundingBox())!
  const width = await frame.evaluate(() => window.innerWidth)
  const scale = box.width / width
  return ({ x, y }: Point) => [box.x + x * scale, box.y + y * scale] as const
}

/** Пауза между последним движением и отпусканием кнопки — чуть больше кадра. */
const HUMAN_RELEASE_MS = 32
/** Шаг движения — раз в кадр, как у человека: цель броска считается по кадрам. */
const HUMAN_STEP_MS = 16

const moveInSteps = async (
  page: Page,
  at: (point: Point) => readonly [number, number],
  from: Point,
  to: Point,
  steps: number,
) => {
  for (let step = 1; step <= steps; step++) {
    await page.mouse.move(
      ...at({
        x: from.x + ((to.x - from.x) * step) / steps,
        y: from.y + ((to.y - from.y) * step) / steps,
      }),
    )
    await page.waitForTimeout(HUMAN_STEP_MS)
  }
}

// Настоящее перетаскивание мышью Playwright (ADR 0043, TQ3): нажатие, шаги движения и
// отпускание. Координаты — клиентские в тестовом iframe; переводим в координаты страницы.
export const realDrag: BrowserCommand<
  [from: Point, to: Point, steps?: number]
> = async ({ page }, from, to, steps = 12) => {
  const at = await toPage(page)
  await page.mouse.move(...at(from))
  await page.mouse.down()
  await moveInSteps(page, at, from, to, steps)
  // Человек отпускает кнопку не в том же кадре, что последнее движение; WebKit без
  // паузы не успевает обновить цель броска (ADR 0084).
  await page.waitForTimeout(HUMAN_RELEASE_MS)
  await page.mouse.up()
}

// То же перетаскивание, но кнопка остаётся нажатой — проверить состояние посреди
// протяжки; отпускание — `realMouseUp`.
export const realDragHold: BrowserCommand<
  [from: Point, to: Point, steps?: number]
> = async ({ page }, from, to, steps = 12) => {
  const at = await toPage(page)
  await page.mouse.move(...at(from))
  await page.mouse.down()
  await moveInSteps(page, at, from, to, steps)
}

export const realMouseUp: BrowserCommand<[]> = async ({ page }) => {
  await page.mouse.up()
}

// Движение с нажатой кнопкой посреди `realDragHold` — без нового нажатия.
export const realMouseMove: BrowserCommand<
  [from: Point, to: Point, steps?: number]
> = async ({ page }, from, to, steps = 12) => {
  await moveInSteps(page, await toPage(page), from, to, steps)
}

// Настоящая прокрутка колесом (ADR 0008, FS7): `ticks` щелчков по `deltaY` px через
// `intervalMs` по часам Node, не дожидаясь обработки каждого: пока главный поток
// страницы стоит, щелчки копятся и приходят пачкой, как у пользователя. `deltaX` —
// щелчки по горизонтали.
export const realWheel: BrowserCommand<
  [
    at: Point,
    deltaY: number,
    ticks: number,
    intervalMs: number,
    deltaX?: number,
  ]
> = async ({ page }, at, deltaY, ticks, intervalMs, deltaX = 0) => {
  await page.mouse.move(...(await toPage(page))(at))
  const sent: Promise<void>[] = []
  for (let tick = 0; tick < ticks; tick++) {
    sent.push(page.mouse.wheel(deltaX, deltaY))
    await new Promise(resolve => setTimeout(resolve, intervalMs))
  }
  await Promise.all(sent)
}

// Касание пальцем (ADR 0084, CB4): контекст с `hasTouch` — мобильная эмуляция.
export const realTap: BrowserCommand<[at: Point]> = async ({ page }, at) => {
  await page.touchscreen.tap(...(await toPage(page))(at))
}

// Жест прокрутки пальцем: Playwright двигает палец только через CDP Chromium. Шаги
// идут с паузой в кадр — без неё Chromium не превращает касания в прокрутку.
export const realSwipe: BrowserCommand<
  [from: Point, to: Point, steps?: number]
> = async ({ page }, from, to, steps = 12) => {
  const at = await toPage(page)
  const session = await page.context().newCDPSession(page)
  const finger = (point: Point) => {
    const [x, y] = at(point)
    return [{ x, y, id: 1 }]
  }
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: finger(from),
  })
  for (let step = 1; step <= steps; step++) {
    await page.waitForTimeout(16)
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: finger({
        x: from.x + ((to.x - from.x) * step) / steps,
        y: from.y + ((to.y - from.y) * step) / steps,
      }),
    })
  }
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  })
  await session.detach()
}

type TouchType = 'touchStart' | 'touchMove' | 'touchEnd'

type CDPSession = Awaited<
  ReturnType<ReturnType<Page['context']>['newCDPSession']>
>

/** Сессия CDP на страницу: жест пальцем живёт в сессии, начавшей его. */
const touchSessions = new WeakMap<Page, Promise<CDPSession>>()

const sendTouch = async (page: Page, type: TouchType, fingers: Point[]) => {
  const at = await toPage(page)
  let session = touchSessions.get(page)
  if (!session) {
    session = page.context().newCDPSession(page)
    touchSessions.set(page, session)
  }
  await (
    await session
  ).send('Input.dispatchTouchEvent', {
    type,
    touchPoints: fingers.map((point, id) => {
      const [x, y] = at(point)
      return { x, y, id }
    }),
  })
}

// Палец по шагам через CDP (только Chromium, ADR 0086): нажатие, движение и отпускание
// отдельно — проверить состояние посреди жеста. Несколько точек — несколько пальцев.
export const realTouchDown: BrowserCommand<[fingers: Point[]]> = async (
  { page },
  fingers,
) => sendTouch(page, 'touchStart', fingers)

export const realTouchMove: BrowserCommand<
  [from: Point, to: Point, steps?: number]
> = async ({ page }, from, to, steps = 12) => {
  for (let step = 1; step <= steps; step++) {
    await page.waitForTimeout(HUMAN_STEP_MS)
    await sendTouch(page, 'touchMove', [
      {
        x: from.x + ((to.x - from.x) * step) / steps,
        y: from.y + ((to.y - from.y) * step) / steps,
      },
    ])
  }
}

export const realTouchUp: BrowserCommand<[]> = async ({ page }) =>
  sendTouch(page, 'touchEnd', [])

// Нажатие кнопки мыши в точке без отпускания — проверить смену DOM посреди нажатия;
// отпускание — `realMouseUp`.
export const realMouseDown: BrowserCommand<[at: Point]> = async (
  { page },
  at,
) => {
  await page.mouse.move(...(await toPage(page))(at))
  await page.mouse.down()
}
