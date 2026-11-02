/**
 * Страж UI-кита (ADR 0097, BN8): каждый `<button>` в гриде, плагинах и общем коде — в списке
 * исключений с причиной. Кнопка, собранная по месту, роняет тест: новый контрол
 * берётся из `src/lib/ui` или добавляется туда (AGENTS.md §6 «UI-кит»).
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const LIB = fileURLToPath(new URL('..', import.meta.url))

/** Нативные `<button>` вне кита: файл → число кнопок и причина. */
const BUTTON_EXCEPTIONS: Record<string, { count: number; why: string }> = {
  'plugins/columnFiltering/FilterSummaryPopover.tsx': {
    count: 1,
    why: 'крестик снятия фильтра в строке сводки — кнопка-иконка 14px внутри строки, не кнопка с подписью',
  },
  'plugins/dataExport/ExportPanel.tsx': {
    count: 1,
    why: 'быстрые наборы — пункты меню панели (вид пункта поповера, ADR 0074), не кнопки',
  },
  'plugins/pagination/SizeTrigger.tsx': {
    count: 1,
    why: 'триггер списка размера страницы — заглушка и рендер-проп Base UI Select, вид контрола выбора',
  },
  'shared/options/OptionSearch.tsx': {
    count: 1,
    why: 'крестик очистки поиска внутри поля ввода — часть поля, не отдельный контрол',
  },
}

const sources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sources(path)
    return entry.name.endsWith('.tsx') ? [path] : []
  })

/** Нативные `<button>` по файлам `grid`, `plugins` и `shared`. */
const nativeButtons = (lib = LIB) =>
  Object.fromEntries(
    ['grid', 'plugins', 'shared']
      .flatMap(dir => sources(join(lib, dir)))
      .map(
        file =>
          [
            relative(lib, file).replaceAll('\\', '/'),
            readFileSync(file, 'utf8').match(/<button\b/g)?.length ?? 0,
          ] as const,
      )
      .filter(([, count]) => count > 0),
  )

describe('страж UI-кита', () => {
  it('BN8: каждый <button> в grid, plugins и shared — в списке исключений с причиной; кнопка по месту роняет тест', () => {
    const found = nativeButtons()
    const unexpected = Object.entries(found)
      .filter(([file, count]) => count > (BUTTON_EXCEPTIONS[file]?.count ?? 0))
      .map(([file, count]) => `${file}: ${count}`)
    expect(
      unexpected,
      'кнопки по месту — возьмите примитив из src/lib/ui',
    ).toEqual([])
    // Список только сокращается: ушедшая кнопка снимает исключение.
    const stale = Object.entries(BUTTON_EXCEPTIONS)
      .filter(([file, { count }]) => (found[file] ?? 0) < count)
      .map(([file]) => file)
    expect(stale, 'устаревшие исключения').toEqual([])
    for (const { why } of Object.values(BUTTON_EXCEPTIONS)) {
      expect(why.length).toBeGreaterThan(10)
    }
  })

  it('UB6: кнопки в ui, grid и plugins собираются из IconButton или Button; Base UI Button, Toolbar.Button и Tooltip вокруг кнопки по месту — только в исключениях с причиной', () => {
    const files = ['ui', 'grid', 'plugins'].flatMap(dir =>
      sources(join(LIB, dir)),
    )
    const uses = (pattern: RegExp) =>
      files
        .filter(file => pattern.test(readFileSync(file, 'utf8')))
        .map(file => relative(LIB, file).replaceAll('\\', '/'))
        .sort()
    // Base UI Button — только у двух баз.
    expect(uses(/from '@base-ui\/react\/button'/)).toEqual([
      'ui/Button/Button.tsx',
      'ui/IconButton/IconButton.tsx',
    ])
    // Toolbar.Button — у кнопки тулбара (рисует IconButton) и в исключениях.
    const toolbar = uses(/<Toolbar\.Button\b/)
    expect(toolbar.filter(file => !(file in TOOLBAR_EXCEPTIONS))).toEqual([
      'ui/ToolbarButton/ToolbarButton.tsx',
    ])
    const toolbarButton = readFileSync(
      join(LIB, 'ui/ToolbarButton/ToolbarButton.tsx'),
      'utf8',
    )
    expect(toolbarButton).toMatch(/render=\{\s*<IconButton\b/)
    // Компоненты кнопок рендерят базу кита или её производную (CellButton, ToolbarButton…).
    const derived = files.filter(file =>
      /export const \w*Button\b/.test(readFileSync(file, 'utf8')),
    )
    for (const file of derived) {
      const name = relative(LIB, file).replaceAll('\\', '/')
      if (name.startsWith('ui/Button/') || name.startsWith('ui/IconButton/')) {
        continue
      }
      if (name in COMPONENT_EXCEPTIONS) continue
      expect(readFileSync(file, 'utf8'), `${name} рендерит базу кита`).toMatch(
        /<(?!Base)[A-Z]\w*Button\b/,
      )
    }
    // Тултип кнопки — у базы (`label`, `tooltip`): Tooltip вокруг кнопки или её обёртки
    // видимости по месту — только в исключениях.
    const wrapped = files
      .filter(file =>
        /<Tooltip\b[^>]*>\s*(<[A-Z]\w*Button\b|<Toolbar\.Button\b|<div\s+className=[^>]*(cell|row)__button)/.test(
          readFileSync(file, 'utf8'),
        ),
      )
      .map(file => relative(LIB, file).replaceAll('\\', '/'))
    expect(wrapped.filter(file => !(file in TOOLBAR_EXCEPTIONS))).toEqual([])
    for (const why of [
      ...Object.values(TOOLBAR_EXCEPTIONS),
      ...Object.values(COMPONENT_EXCEPTIONS),
    ]) {
      expect(why.length).toBeGreaterThan(10)
    }
  })
})

/** `Toolbar.Button` вне кнопки тулбара: файл → причина. */
const TOOLBAR_EXCEPTIONS: Record<string, string> = {
  'plugins/quickSearch/SearchField.tsx':
    'значок «i» и крестик очистки внутри поля поиска — часть поля, не кнопки кита',
}

/** Компоненты `*Button`, которые не рендерят базу: файл → причина. */
const COMPONENT_EXCEPTIONS: Record<string, string> = {
  'grid/dnd/DragHandler.tsx':
    'ручка перетаскивания — элемент dnd-kit, не нажимаемая кнопка (ADR 0006)',
}
