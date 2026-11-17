/**
 * Однобуквенные сочетания (ADR 0232, KX10; WCAG 2.1.4): печатные клавиши таблица слушает только
 * при фокусе внутри себя. Слушатель клавиш на документе или окне — только по перечню с причиной;
 * перечень только сокращается.
 * Запуск: npx vitest run --config vitest.node.config.ts globalKeys
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, test } from 'vitest'

/** Файл — клавиши, которые его слушатель на документе или окне обрабатывает, и зачем. */
const GLOBAL_KEY_LISTENERS: Record<string, string> = {
  'core/inputModality.ts':
    'признак последнего ввода: клавиша только помечает ввод, действий нет',
  'ui/Tooltip/Tooltip.tsx':
    'признак ввода подсказок: клавиша без модификатора только помечает ввод',
  'core/lazyOpening.ts':
    'Escape и Tab отменяют ожидание загрузки поповера — Safari не фокусирует кнопку по клику',
  'plugins/contextMenu/ContextMenu.tsx':
    'Escape отменяет ожидание загрузки меню',
  'plugins/cellSelection/rangeHandle.tsx':
    'во время протяжки маркера: Alt — ось, Escape — отмена',
  'plugins/columnSizing/ResizeHandler.tsx':
    'во время протяжки ширины: Escape — отмена',
}

const GLOBAL =
  /(?:document|window)\.addEventListener\(\s*['"]key(?:down|up|press)['"]/

const sources = (dir: string): string[] =>
  readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    if (statSync(path).isDirectory())
      return name === '__tests__' || name === 'stories' ? [] : sources(path)
    return /\.tsx?$/.test(name) ? [path] : []
  })

describe('Однобуквенные сочетания (ADR 0232)', () => {
  test('KX10: печатные клавиши таблица слушает только при фокусе внутри неё: глобальных обработчиков печатных клавиш нет', () => {
    const root = join(__dirname, '..')
    const found = sources(root)
      .filter(file => GLOBAL.test(readFileSync(file, 'utf8')))
      .map(file => relative(root, file).replace(/\\/g, '/'))
      .sort()
    const unlisted = found.filter(file => !(file in GLOBAL_KEY_LISTENERS))
    const stale = Object.keys(GLOBAL_KEY_LISTENERS).filter(
      file => !found.includes(file),
    )
    expect({ unlisted, stale }).toEqual({ unlisted: [], stale: [] })
    // Перечисленные слушатели печатные клавиши не разбирают: ни буквы, ни кода буквы.
    const printable = Object.keys(GLOBAL_KEY_LISTENERS).filter(file =>
      /event\.code === 'Key[A-Z]'|key\.length === 1|\.key === '[a-zA-Z0-9]'/.test(
        readFileSync(join(root, file), 'utf8'),
      ),
    )
    expect(printable).toEqual([])
  })
})
