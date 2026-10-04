import type { BrowserCommand } from 'vitest/node'

interface Point {
  x: number
  y: number
}

// Настоящее перетаскивание мышью Playwright (ADR 0043, TQ3): нажатие, шаги движения и
// отпускание. Координаты — клиентские в тестовом iframe; переводим в координаты страницы.
export const realDrag: BrowserCommand<
  [from: Point, to: Point, steps?: number]
> = async ({ page }, from, to, steps = 12) => {
  // Тест рендерится в последнем дочернем iframe оркестратора Vitest.
  const frame = page.frames().at(-1)!
  const box = (await (await frame.frameElement()).boundingBox())!
  const width = await frame.evaluate(() => window.innerWidth)
  const scale = box.width / width
  const at = ({ x, y }: Point) =>
    [box.x + x * scale, box.y + y * scale] as const

  await page.mouse.move(...at(from))
  await page.mouse.down()
  for (let step = 1; step <= steps; step++) {
    await page.mouse.move(
      ...at({
        x: from.x + ((to.x - from.x) * step) / steps,
        y: from.y + ((to.y - from.y) * step) / steps,
      }),
    )
  }
  await page.mouse.up()
}
