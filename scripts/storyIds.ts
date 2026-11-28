// Id историй публичной сборки Storybook (ADR 0113, DC11; ADR 0117 §8): без `*.dev` и
// `*.vr`. Id считается как у индексатора CSF — заголовок меты и имя экспорта.

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { storyNameFromExport, toId } from 'storybook/internal/csf'

const STORIES = 'src/lib/stories'

export const publicStoryIds = (root: string): Set<string> => {
  const ids = new Set<string>()
  for (const file of readdirSync(join(root, STORIES))) {
    if (
      !file.endsWith('.stories.tsx') ||
      /\.(dev|vr)\.stories\.tsx$/.test(file)
    )
      continue
    const source = readFileSync(join(root, STORIES, file), 'utf8')
    const title = source.match(/^\s*title:\s*'([^']+)'/m)?.[1]
    if (!title) continue
    for (const match of source.matchAll(/^export const (\w+)/gm)) {
      ids.add(toId(title, storyNameFromExport(match[1])))
    }
  }
  return ids
}
