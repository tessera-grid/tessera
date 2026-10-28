// @vitest-environment happy-dom
/**
 * Ошибка в ячейке (ADR 0150): подпись одиночной точки из словаря (ER8); плагин работает
 * без `cellEditing` и не тянет его в сборку (ER10).
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'

import {
  ENGLISH_LABELS,
  LocalizationContext,
  resolveLabels,
} from '../core/localization'
import { cellErrors } from '../plugins'
import { CellErrorMark } from '../plugins/cellErrors/CellErrorMark'

;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

let root: Root | undefined
afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  document.body.innerHTML = ''
})

/** Точка ячейки с ошибкой; `hooks` — хуки плагинов таблицы по id. */
const mountMark = (labels = ENGLISH_LABELS, hooks: object = {}) => {
  const host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  const props = {
    table: { getHooks: () => hooks },
    row: { id: 'r1' },
    column: { id: 'age' },
    hooks: { getCellError: () => 'Too young' },
  }
  act(() =>
    root!.render(
      createElement(
        LocalizationContext.Provider,
        { value: labels },
        createElement(CellErrorMark, props as never),
      ),
    ),
  )
  return host
}

describe('Ошибка в ячейке (ADR 0150)', () => {
  it('ER8: подпись одиночной точки — ключ cellError словаря localization', () => {
    expect(ENGLISH_LABELS.cellError).toBe('Cell error')
    const host = mountMark(
      resolveLabels({ cellError: 'Ошибка в ячейке' }, 'ru-RU'),
    )
    expect(host.querySelector('button')!.getAttribute('aria-label')).toBe(
      'Ошибка в ячейке',
    )
  })

  it('ER10: cellErrors работает без cellEditing и его импорт не тянет cellEditing', () => {
    // Без cellEditing точка стоит одна; с правимой ячейкой её несёт кнопка правки.
    expect(mountMark().querySelector('button')).not.toBeNull()
    act(() => root!.unmount())
    root = undefined
    const editable = mountMark(ENGLISH_LABELS, {
      cellEditing: { canEditCell: () => true },
    })
    expect(editable.querySelector('button')).toBeNull()

    expect(cellErrors({ getCellError: () => undefined }).id).toBe('cellErrors')
    // Модули плагина ссылаются на cellEditing только типами: сборка его не берёт.
    const dir = join(__dirname, '..', 'plugins', 'cellErrors')
    const runtime = readdirSync(dir).flatMap(name =>
      readFileSync(join(dir, name), 'utf8')
        .split('\n')
        .filter(
          line =>
            /from '\.\.\/cellEditing/.test(line) && !/^import type /.test(line),
        ),
    )
    expect(runtime).toEqual([])
  })
})
