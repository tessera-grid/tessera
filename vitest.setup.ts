// Хук коммитов React — до любого импорта `react-dom` (ADR 0099, PF2).
import './src/lib/stories/__tests__/reactCommits'

import { setProjectAnnotations } from '@storybook/react-vite'
import { commands } from 'vitest/browser'
import { pinTestPlatform } from './src/lib/stories/__mocks__/platformKeys'
import {
  setRealTapDriver,
  setRealTouchDragDriver,
} from './src/lib/stories/__mocks__/touchGuides'
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest'
import { cleanup, configure } from 'vitest-browser-react/pure'

import { parkPointer } from './src/lib/stories/__tests__/pointer'

import { collectGarbage } from './.storybook/collectGarbage'
import { watchUnknownActions } from './.storybook/consoleErrors'
import preview from './.storybook/preview'

setRealTapDriver(at =>
  (
    commands as unknown as {
      realTap: (at: { x: number; y: number }) => Promise<void>
    }
  ).realTap(at),
)

setRealTouchDragDriver(async (from, to, hold) => {
  const touch = commands as unknown as {
    realTouchDown: (points: { x: number; y: number }[]) => Promise<void>
    realTouchMove: (
      from: { x: number; y: number },
      to: { x: number; y: number },
      steps?: number,
    ) => Promise<void>
    realTouchUp: () => Promise<void>
  }
  await touch.realTouchDown([from])
  try {
    if (hold) await new Promise(resolve => setTimeout(resolve, 300))
    await touch.realTouchMove(from, to, hold ? 12 : 1)
    if (hold) await new Promise(resolve => setTimeout(resolve, 50))
  } finally {
    await touch.realTouchUp()
  }
})

// Wire the Storybook preview annotations into portable stories so
// composeStories() renders them exactly as Storybook does.
setProjectAnnotations([preview])

// Указатель переживает тест и файл: где его оставил прошлый, там и hover. Паркуем в
// угол окна, чтобы проверки «скрыто до наведения» не зависели от порядка тестов.
beforeEach(parkPointer)

beforeAll(collectGarbage)

// `cleanup` идёт только перед тестом: последний рендер файла остался бы смонтированным, и
// обработчики его поповера на окне оркестратора удержали бы iframe файла.
afterAll(cleanup)

const unknownActions = watchUnknownActions()
beforeEach(unknownActions.start)
afterEach(unknownActions.stop)

// StrictMode по умолчанию (ADR 0091, EV3): эффекты и рендер запускаются дважды, как в
// разработке у потребителя. В перф-прогоне React продовый — там StrictMode ничего не делает.
configure({ reactStrictMode: true })

// Платформа клавиатуры одна на любой машине (ADR 0232, KX11).
pinTestPlatform()
