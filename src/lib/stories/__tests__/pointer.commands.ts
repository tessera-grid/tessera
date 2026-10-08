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
