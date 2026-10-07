import { userEvent } from 'vitest/browser'
import { afterEach, describe, expect, test } from 'vitest'

import { humanClick } from '../helpers'
import {
  MODULE,
  exportButton,
  exportPanel,
  holdModule,
  releaseModule,
  renderToolbarGrid,
  sleep,
} from './lazy-helpers'

// Нажатие до загрузки модуля и короткое ожидание (ADR 0061, LZ2). Отдельный файл:
// модуль грузится один раз на документ.

afterEach(() => releaseModule(MODULE.export))

describe('Ленивые поповеры — нажатие до загрузки', () => {
  test('LZ2: клик по кнопке тулбара до загрузки не теряется — поповер открывается после загрузки, сразу с содержимым', async () => {
    await holdModule(MODULE.export)
    await renderToolbarGrid()
    await humanClick(exportButton())
    await sleep(100)
    expect(exportPanel()).toBeNull()

    await releaseModule(MODULE.export)
    await expect.poll(exportPanel).not.toBeNull()
    expect(exportPanel()!.closest('[role="dialog"]')).not.toBeNull()
    await userEvent.keyboard('{Escape}')
    await expect.poll(exportPanel).toBeNull()
  })
})
