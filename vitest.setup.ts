// Хук коммитов React — до любого импорта `react-dom` (ADR 0099, PF2).
import './src/lib/stories/__tests__/reactCommits'

import { setProjectAnnotations } from '@storybook/react-vite'
import { commands, server } from 'vitest/browser'
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

// Гайды используют CDP для жестов в Chromium. Во всех остальных проектах
// работает встроенный ввод гайда, в том числе в контрасте на обычном экране.
if (server.browser === 'chromium') {
  const touch = commands as unknown as {
    realTap: (at: { x: number; y: number }) => Promise<void>
    realTouchDown: (points: { x: number; y: number }[]) => Promise<void>
    realTouchMove: (
      from: { x: number; y: number },
      to: { x: number; y: number },
      steps?: number,
    ) => Promise<void>
    realTouchUp: () => Promise<void>
  }
  setRealTapDriver(at => touch.realTap(at))
  setRealTouchDragDriver(async (from, to, hold) => {
    await touch.realTouchDown([from])
    try {
      if (hold) await new Promise(resolve => setTimeout(resolve, 300))
      await touch.realTouchMove(from, to, hold ? 12 : 1)
      if (hold) await new Promise(resolve => setTimeout(resolve, 50))
    } finally {
      await touch.realTouchUp()
    }
  })
}

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
