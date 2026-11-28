// Справочные списки из кода (ADR 0113 §5, DC8): CSS-переменные темы, ключи словаря
// `localization` и ключи `icons`. Читает исходники библиотеки при сборке сайта; страж DC8
// сверяет с ними имена, упомянутые на страницах.

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { DEFAULT_LABELS } from '../../../src/lib/core/localization/labels'
import { allLabelSets } from '../../../src/labelSets'

/** Корень репозитория: сборка сайта идёт из `website/`, тесты — из корня. */
const repoRoot = () => {
  let dir = process.cwd()
  while (!existsSync(join(dir, 'src/lib/ui/theme/theme.css'))) {
    const up = dirname(dir)
    if (up === dir) throw new Error('repository root not found')
    dir = up
  }
  return dir
}

const source = (path: string) =>
  readFileSync(join(repoRoot(), 'src', path), 'utf8')

/** Переменные `--tsr-comp-*`, объявленные темой. */
export const cssVariables = (): string[] =>
  [
    ...new Set(
      [
        ...source('lib/ui/theme/theme.css').matchAll(
          /(--tsr-comp-[a-z0-9-]+)\s*:/g,
        ),
      ].map(match => match[1]),
    ),
  ].sort()

export interface LabelEntry {
  key: string
  /** Английское значение; у подписи-функции — `null`. */
  value: string | null
}

/** Ключи словаря `localization`: ядро и наборы всех встроенных владельцев. */
export const labelKeys = (): LabelEntry[] => {
  const core = Object.entries(DEFAULT_LABELS).map(([key, value]) => ({
    key,
    value: typeof value === 'string' ? value : null,
  }))
  const owned = allLabelSets.flatMap(set =>
    set.keys.map(key => ({
      key: `${set.id}.${key}`,
      value: set.defaults[key] ?? null,
    })),
  )
  return [...core, ...owned].sort((a, b) => a.key.localeCompare(b.key))
}

export interface IconEntry {
  key: string
  description: string
}

/** Ключи `icons` с описанием из JSDoc интерфейса `TableIcons`. */
export const iconKeys = (): IconEntry[] => {
  const text = source('lib/ui/icons/IconsContext.tsx')
  const body = text.slice(text.indexOf('export interface TableIcons {'))
  const block = body.slice(0, body.indexOf('\n}\n'))
  return [
    ...block.matchAll(
      /\/\*\*\s*([^*]+?)\s*\*\/\s*\n((?:\s+\w+\??:[^\n]*\n)+)/g,
    ),
  ].flatMap(([, description, keys]) =>
    [...keys.matchAll(/^\s+(\w+)\??:/gm)].map(([, key]) => ({
      key,
      description,
    })),
  )
}
