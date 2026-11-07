import { userEvent } from 'vitest/browser'
import { afterEach, describe, expect, test } from 'vitest'

import type { Failure } from '../../../core/failures/failuresFeature'
import { failureShownOn, humanClick } from '../helpers'
import {
  MODULE,
  columnHandle,
  failModule,
  gripWrapper,
  handleCell,
  handleMenu,
  recordAnnouncements,
  releaseModule,
  renderHandleGrid,
  sleep,
} from './lazy-helpers'
import { tableLabels } from '../labels'
import { columnDraggingLabels } from '../../../plugins/columnDragging/labels'
import { columnSizingLabels } from '../../../plugins/columnSizing/labels'

// Ошибка загрузки меню ручек (ADR 0061, LZ14). Отдельный файл: модуль грузится один
// раз на документ.

afterEach(() => releaseModule(MODULE.handleMenu))

const failed = () => failureShownOn(columnHandle())

describe('Меню ручек — ошибка загрузки', () => {
  test('LZ14: ошибка загрузки меню — ни на ручке, ни у грипа отметки нет; объявление с подписью ручки или грипа; следующая попытка снова отвечает', async () => {
    await failModule(MODULE.handleMenu)
    await renderHandleGrid()
    const announcements = recordAnnouncements()

    await userEvent.hover(handleCell())
    await humanClick(columnHandle())
    await expect
      .poll(() => announcements.messages)
      .toContain(
        tableLabels.loadFailed(columnDraggingLabels(tableLabels).moveColumn),
      )
    expect(failed()).toBe(false)
    await sleep(100)
    expect(handleMenu()).toBeNull()

    await userEvent.hover(handleCell())
    await humanClick(gripWrapper())
    await expect
      .poll(() => announcements.messages)
      .toContain(
        tableLabels.loadFailed(columnSizingLabels(tableLabels).columnWidth),
      )
    expect(gripWrapper().querySelector('[data-failure-indicator]')).toBeNull()

    const before = announcements.messages.length
    await userEvent.hover(handleCell())
    await humanClick(columnHandle())
    await expect
      .poll(() => announcements.messages.length)
      .toBeGreaterThan(before)
    expect(failed()).toBe(false)
    announcements.stop()
    expect(handleMenu()).toBeNull()
  })

  test('OB19: отказ загрузки меню ручки и грипа — запись реестра отказов с действием владельца, причиной и повтором, который запускает новую загрузку', async () => {
    await failModule(MODULE.handleMenu)
    let failures: () => Failure[] = () => []
    await renderHandleGrid({
      extraPlugins: [
        {
          id: 'failuresProbe',
          setup: (table: { getFailures: () => Failure[] }) => {
            failures = () => table.getFailures()
          },
        },
      ],
    })

    await userEvent.hover(handleCell())
    await humanClick(gripWrapper())
    await expect.poll(() => failures().length).toBe(1)
    const label = columnSizingLabels(tableLabels).columnWidth
    const [failure] = failures()
    expect(failure!.action).toEqual({
      plugin: 'columnSizing',
      action: 'handleMenu',
    })
    expect(failure!.reason).toBe(tableLabels.loadFailed(label))
    expect(failure!.retry).toBeTypeOf('function')

    failure!.retry!()
    await expect
      .poll(() => failures().length === 1 && failures()[0] !== failure)
      .toBe(true)
  })
})
