import axe from 'axe-core'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { composed } from '../stories'
import { waitForGrid } from './core-helpers'
import { AXE_OPTIONS, inBothThemes } from './a11y-helpers'
import { RU_LABELS } from '../../__mocks__/localization.ru'

const dialog = () =>
  document.querySelector<HTMLElement>('[data-testid="keyboard-shortcuts"]')
const cell = () =>
  document.querySelector<HTMLElement>(
    '.data-grid__body-row[data-index="1"] [data-column-id="age"]',
  )!
const keyboard = (keys: string) => userEvent.keyboard(keys)
const pause = (ms = 250) => new Promise(resolve => setTimeout(resolve, ms))

const mount = async (
  platform: 'apple' | 'other' = 'other',
  extra: Record<string, unknown> = {},
) => {
  const screen = await render(
    <composed.DataGridPlayground
      keyboardPlatform={platform}
      enableKeyboardNavigation
      enableCellEditing
      enableCellSelection
      enableContextMenu
      enableRowSelection
      enableRowDragging
      enableColumnVisibility
      enableEditHistory
      columnCount={6}
      dataCount={20}
      containerHeight="560"
      height="500"
      {...extra}
    />,
  )
  await waitForGrid()
  if (extra.enableEditHistory !== false) {
    await expect
      .poll(() => document.querySelector('[data-testid="undo-button"]'))
      .not.toBeNull()
  }
  await keyboard('{Tab}')
  return screen
}

const openSheet = async () => {
  cell().focus()
  await keyboard('{Control>}/{/Control}')
  await expect.poll(dialog).not.toBeNull()
}

const closeSheet = async () => {
  await keyboard('{Escape}')
  await expect.poll(dialog).toBeNull()
}

describe('Сочетание у действия и сводка (ADR 0232)', () => {
  test('KX14: у действия с сочетанием сочетание показано в подсказке кнопки и в пункте меню в виде платформы и записано в `aria-keyshortcuts`', async () => {
    const screen = await mount('other')
    const undo = document.querySelector<HTMLElement>(
      '[data-testid="undo-button"]',
    )!
    expect(undo.getAttribute('aria-keyshortcuts')).toBe('Control+Z')
    undo.focus()
    await expect
      .poll(() =>
        [...document.querySelectorAll('[data-tooltip-popup]')].some(tip =>
          tip.textContent?.includes('Undo · Ctrl+Z'),
        ),
      )
      .toBe(true)
    const selectAll = document.querySelector<HTMLElement>(
      '.data-grid__head .row-select-checkbox',
    )!
    expect(selectAll.getAttribute('aria-keyshortcuts')).toBe('Control+A')
    cell().focus()
    await keyboard('{Shift>}{F10}{/Shift}')
    await expect
      .poll(() => document.querySelector('[role="menu"]'))
      .not.toBeNull()
    for (const [id, text, aria] of [
      ['cellSelection:copy', 'Ctrl+C', 'Control+C'],
      ['cellSelection:cut', 'Ctrl+X', 'Control+X'],
      ['cellSelection:paste', 'Ctrl+V', 'Control+V'],
      ['cellSelection:fillDown', 'Ctrl+D', 'Control+D'],
      ['cellSelection:fillRight', 'Ctrl+R', 'Control+R'],
      ['undo', 'Ctrl+Z', 'Control+Z'],
      ['redo', 'Ctrl+Shift+Z', 'Control+Shift+Z'],
    ]) {
      const item = document.querySelector<HTMLElement>(
        `[data-action-id="${id}"]`,
      )!
      expect(item, id).not.toBeNull()
      expect(item.textContent, id).toContain(text)
      expect(item.getAttribute('aria-keyshortcuts'), id).toBe(aria)
    }
    await keyboard('{Escape}')
    await screen.unmount()

    await mount('apple')
    const macUndo = document.querySelector<HTMLElement>(
      '[data-testid="undo-button"]',
    )!
    expect(macUndo.getAttribute('aria-keyshortcuts')).toBe('Meta+Z')
    macUndo.focus()
    await expect
      .poll(() =>
        [...document.querySelectorAll('[data-tooltip-popup]')].some(tip =>
          tip.textContent?.includes('Undo · ⌘Z'),
        ),
      )
      .toBe(true)
    cell().focus()
    await keyboard('{Meta>}{Shift>}{Enter}{/Shift}{/Meta}')
    await expect
      .poll(() => document.querySelector('[role="menu"]'))
      .not.toBeNull()
    const redo = document.querySelector<HTMLElement>('[data-action-id="redo"]')!
    expect(redo.textContent).toContain('⌘⇧Z')
    expect(redo.getAttribute('aria-keyshortcuts')).toBe('Meta+Shift+Z')
  })

  test('KX17: `Cmd+/` или `Ctrl+/` в таблице и пункт «Настроек вида» открывают сводку сочетаний; `Escape` закрывает её и возвращает фокус', async () => {
    const screen = await mount('other')
    await openSheet()
    expect(document.activeElement?.getAttribute('aria-label')).toBe(
      'Search actions',
    )
    await closeSheet()
    expect(document.activeElement).toBe(cell())

    const settings = document.querySelector<HTMLElement>(
      '[data-testid="view-settings-button"]',
    )!
    settings.focus()
    await keyboard('{Enter}')
    await expect
      .poll(() =>
        document.querySelector('[data-view-settings-section="shortcuts"]'),
      )
      .not.toBeNull()
    const item = document.querySelector<HTMLElement>(
      '[data-view-settings-section="shortcuts"]',
    )!
    item.focus()
    await keyboard('{Enter}')
    await expect.poll(dialog).not.toBeNull()
    expect(
      document.querySelector('[data-testid="view-settings-popover"]'),
    ).toBeNull()
    await closeSheet()
    expect(document.activeElement).not.toBe(document.body)
    await screen.unmount()

    await mount('apple')
    cell().focus()
    await keyboard('{Meta>}/{/Meta}')
    await expect.poll(dialog).not.toBeNull()
  })

  test('KX18: в сводке — только сочетания включённых плагинов и ядра, в виде своей платформы, по разделам; поиск по названию действия сужает список', async () => {
    const screen = await mount('other')
    await openSheet()
    const list = () => document.querySelector('[data-shortcuts-list]')!
    expect(list().textContent).toContain('Navigation')
    expect(list().textContent).toContain('Selection')
    expect(list().textContent).toContain('Editing')
    expect(list().textContent).toContain('Reordering')
    expect(list().textContent).toContain('Copy')
    expect(list().textContent).toContain('Undo')
    const search = document.querySelector<HTMLInputElement>(
      '[data-testid="keyboard-shortcuts"] input',
    )!
    await userEvent.fill(search, 'Undo')
    await expect.poll(() => list().textContent).not.toContain('Copy')
    expect(list().textContent).toContain('Undo')
    await userEvent.fill(search, 'nothing matches this')
    await expect.poll(() => list().textContent).toContain('No shortcuts found')
    await closeSheet()
    await screen.unmount()

    await mount('apple', {
      enableCellSelection: false,
      enableContextMenu: false,
      enableRowSelection: false,
      enableEditHistory: false,
      enableRowDragging: false,
    })
    cell().focus()
    await keyboard('{Meta>}/{/Meta}')
    await expect.poll(dialog).not.toBeNull()
    expect(dialog()!.textContent).not.toContain('Copy')
    expect(dialog()!.textContent).not.toContain('Undo')
    expect(dialog()!.textContent).toContain('⌘')
  })

  test('KX19: подписи сводки и клавиш — из словаря таблицы; axe сводки без нарушений в обеих темах', async () => {
    const screen = await mount('other', {
      localization: RU_LABELS,
      locale: 'ru-RU',
    })
    await openSheet()
    expect(dialog()!.getAttribute('aria-label')).toBe(RU_LABELS.shortcuts)
    expect(dialog()!.textContent).toContain(RU_LABELS.shortcutNavigation)
    expect(dialog()!.textContent).toContain(RU_LABELS.shortcutSelection)
    expect(
      document
        .querySelector('[data-testid="keyboard-shortcuts"] input')!
        .getAttribute('placeholder'),
    ).toBe(RU_LABELS.shortcutsSearch)
    const options = {
      ...AXE_OPTIONS,
      exclude: [['[data-base-ui-focus-guard]']],
      rules: { ...AXE_OPTIONS.rules, 'color-contrast': { enabled: true } },
    }
    await inBothThemes(async () => {
      expect((await axe.run(dialog()!, options)).violations).toEqual([])
    })
    await closeSheet()
    await screen.unmount()
  })
})
