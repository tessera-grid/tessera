/**
 * Язык гайдов, консоли и историй (ADR 0225): пары `{ ru, en }` у шагов и названий гайдов
 * (GT4), словарь оболочки вне словаря таблицы (GT5), имена шагов `play` (GT6), единый
 * перевод названий (GT7), кириллица только в поле `ru` (GT8).
 * Запуск: npx vitest run --config vitest.node.config.ts storyLanguage
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

import { describe, expect, it } from 'vitest'

import { DEFAULT_LABELS } from '../core/localization/labels'
import { PLURAL_FORMS } from '../core/localization/resolveLabels'
import { RU_LABELS } from '../stories/__mocks__/localization.ru'
import { storyLabels } from '../stories/__mocks__/storyLabels'
import { STORY_SHELL } from '../stories/demos/storyShell'
import {
  cyrillicOutsideRu,
  guideTexts,
  playStepsNotByTitle,
  storySources,
} from './storyLanguage'

const LIB = join(__dirname, '..')

/**
 * Файлы с кириллицей вне поля `ru` (GT8): список только сокращается — переведённый файл
 * уходит из него, иначе страж падает.
 */
const BASELINE: Record<string, string> = {}

/** Образцы данных, где кириллица — предмет истории: постоянно, с причиной. */
const CYRILLIC_DATA: Record<string, string> = {
  '__mocks__/dataTypesData.ts':
    'названия на латинице и кириллице — вид и порядок по языку таблицы (S7 типов данных)',
}

/**
 * Названия шагов с разным переводом (GT7): `ru → en` или `en ← ru`; список только
 * сокращается.
 */
const TITLE_BASELINE: readonly string[] = []

/** Одно русское название с разным смыслом в разных гайдах: постоянно, с причиной. */
const HOMONYMS: Record<string, string> = {
  'Вставка отменена':
    'в «Undo & redo» — отмена вставки по Ctrl+Z (undo), в «Paste & fill» — отказ от вставки крестиком (cancel)',
}

describe('язык историй (ADR 0225)', () => {
  it('GT4: у каждого шага каждого гайда и у названия каждого гайда — оба языка непустыми строками', () => {
    const texts = storySources().flatMap(guideTexts)
    const broken = texts
      .filter(
        ({ pair }) => !pair.dynamic && (!pair.ru?.trim() || !pair.en?.trim()),
      )
      .map(({ file, line, what }) => `${file}:${line} ${what}`)
    expect(broken).toEqual([])
    // Разбор видит гайды: в историях — сотни шагов.
    expect(
      texts.filter(text => text.what === 'step title').length,
    ).toBeGreaterThan(500)
  })

  it('GT5: ключи словаря оболочки не входят в словарь таблицы, а код вне историй его не импортирует', () => {
    const tableKeys = new Set([
      ...Object.keys(DEFAULT_LABELS),
      ...Object.keys(RU_LABELS),
      ...Object.keys(storyLabels('ru')),
      ...Object.keys(storyLabels('en')),
    ])
    const shellKeys = Object.keys(STORY_SHELL).flatMap(key => [
      key,
      ...PLURAL_FORMS.map(form => `${key}_${form}`),
    ])
    expect(shellKeys.filter(key => tableKeys.has(key))).toEqual([])
    const importers: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name)
        if (statSync(path).isDirectory()) {
          if (name !== 'stories' && name !== '__tests__') walk(path)
        } else if (
          /\.tsx?$/.test(name) &&
          /from '[^']*(stories\/|storyShell|storyText)/.test(
            readFileSync(path, 'utf8'),
          )
        ) {
          importers.push(relative(LIB, path).split(sep).join('/'))
        }
      }
    }
    walk(LIB)
    expect(importers).toEqual([])
  })

  it('GT6: имя каждого шага `play` истории сценария — русское название шага её гайда', () => {
    expect(storySources().flatMap(playStepsNotByTitle)).toEqual([])
  })

  it('GT7: одинаковое название шага переводится одинаково во всех гайдах', () => {
    const byRu = new Map<string, Set<string>>()
    const byEn = new Map<string, Set<string>>()
    for (const { what, pair } of storySources().flatMap(guideTexts)) {
      if (what !== 'step title' || !pair.ru || !pair.en) continue
      if (pair.ru in HOMONYMS) continue
      if (!byRu.has(pair.ru)) byRu.set(pair.ru, new Set())
      byRu.get(pair.ru)!.add(pair.en)
      if (!byEn.has(pair.en)) byEn.set(pair.en, new Set())
      byEn.get(pair.en)!.add(pair.ru)
    }
    const conflicts = [
      ...[...byRu]
        .filter(([, en]) => en.size > 1)
        .map(([ru, en]) => `${ru} → ${[...en].sort().join(' | ')}`),
      ...[...byEn]
        .filter(([, ru]) => ru.size > 1)
        .map(([en, ru]) => `${en} ← ${[...ru].sort().join(' | ')}`),
    ].sort()
    expect(conflicts).toEqual([...TITLE_BASELINE].sort())
  })

  it('GT8: в коде историй нет кириллицы вне поля `ru`', () => {
    const found = Object.fromEntries(
      storySources()
        .map(file => [file, cyrillicOutsideRu(file)] as const)
        .filter(
          ([file, lines]) => lines.length > 0 && !(file in CYRILLIC_DATA),
        ),
    )
    const unexpected = Object.fromEntries(
      Object.entries(found).filter(([file]) => !(file in BASELINE)),
    )
    expect(unexpected).toEqual({})
    // Переведённый файл уходит из базы.
    const stale = Object.keys(BASELINE).filter(file => !(file in found))
    expect(stale).toEqual([])
  })
})
