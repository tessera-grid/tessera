/**
 * Кит поповеров (ADR 0183): поверхность только компонентом (PK1), календарь без ядра и только в
 * ленивых модулях (PK7). Разбор статический.
 * Запуск: npx vitest run --config vitest.node.config.ts popupKit
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

import { describe, expect, it } from 'vitest'

const LIB = join(__dirname, '..')

const filesUnder = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      return entry.name === 'stories' || entry.name === '__tests__'
        ? []
        : filesUnder(path)
    }
    return [path]
  })

const sources = filesUnder(LIB).map(path => ({
  path: relative(LIB, path).split('\\').join('/'),
  text: readFileSync(path, 'utf8'),
}))

describe('кит поповеров', () => {
  it('PK1: поверхность поповера — компонент PopupSurface: классы поверхности вне ui/Popup не подключают, позиционер Base UI без него не рисуют', () => {
    const outside = sources.filter(file => !file.path.startsWith('ui/Popup/'))
    expect(outside.length).toBeGreaterThan(100)
    expect(
      outside
        .filter(file => file.path.endsWith('.css'))
        .filter(file =>
          /composes:\s*(popup|positioner)\b[^;]*Popup\.module\.css/.test(
            file.text,
          ),
        )
        .map(file => file.path),
    ).toEqual([])
    expect(
      outside
        .filter(file => file.path.endsWith('.tsx'))
        .filter(file =>
          /<(Popover|Menu|Select|Combobox)\.Positioner/.test(file.text),
        )
        .filter(file => !/<PopupSurface\b/.test(file.text))
        .map(file => file.path),
    ).toEqual([])
  })

  it('PK7: календарь кита не импортирует ядро, shared и плагины; грузят его только ленивые модули фильтра и редактора даты', () => {
    const calendar = sources.filter(file =>
      file.path.startsWith('ui/Calendar/'),
    )
    expect(calendar.length).toBeGreaterThan(0)
    expect(
      calendar
        .filter(file => /\.tsx?$/.test(file.path))
        .filter(file =>
          /from '[^']*\/(core|shared|plugins|grid)\//.test(file.text),
        )
        .map(file => file.path),
    ).toEqual([])
    const importers = sources
      .filter(file => !file.path.startsWith('ui/Calendar/'))
      .filter(file => /from '[^']*ui\/Calendar/.test(file.text))
      .map(file => file.path)
      .sort()
    expect(importers).toEqual([
      'plugins/cellEditing/DateEditor.tsx',
      'plugins/columnFiltering/DateFilterPanel.tsx',
    ])
    for (const module of ['DateEditor', 'DateFilterPanel']) {
      const eager = sources.filter(
        file =>
          !file.path.includes(module) &&
          new RegExp(`^import [^\\n]*/${module}'`, 'm').test(file.text),
      )
      expect(
        eager.map(file => file.path),
        module,
      ).toEqual([])
    }
  })
})
