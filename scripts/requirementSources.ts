// Источники сверки «требование ↔ тест» (ADR 0043, TQ10–TQ11): файлы рабочего дерева.
// Ввод-вывод вынесен сюда из check-requirements.mjs, чтобы его можно было проверить.

import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Файлы рабочего дерева по шаблонам git: отслеживаемые и новые неигнорируемые. Индекс
 * помнит и удалённые, но ещё не проиндексированные файлы — их на диске нет, и сверка их
 * не читает (TQ11).
 */
export const listSources = (root: string, patterns: string[]): string[] =>
  execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', ...patterns],
    { cwd: root, encoding: 'utf8' },
  )
    .split('\n')
    .filter(Boolean)
    .filter(file => existsSync(resolve(root, file)))
