// Стражи каталога визуальных состояний (ADR 0093, VR9–VR11): чистая логика по текстам
// файлов историй, без сборки Storybook.

export interface StoryFile {
  file: string
  text: string
}

export interface StoryExport {
  file: string
  name: string
  /** Текст экспорта до следующего экспорта или конца файла. */
  body: string
}

/**
 * Снимков полной сборки не больше: бесплатный тариф Chromatic — 5000 в месяц, это
 * около восьми полных сборок; обычная правка с TurboSnap снимает лишь затронутые
 * истории.
 */
export const SNAPSHOT_BUDGET = 600

/** Длина причины пропуска снимка, ниже которой это не причина. */
const MIN_REASON = 10

const EXPORT = /^export const (\w+)\b/gm

/** Истории файла — его `export const`. */
export const storyExports = ({ file, text }: StoryFile): StoryExport[] => {
  const starts = [...text.matchAll(EXPORT)]
  return starts.map((match, i) => ({
    file,
    name: match[1]!,
    body: text.slice(match.index, starts[i + 1]?.index ?? text.length),
  }))
}

const skipsSnapshot = (body: string) => /disableSnapshot:\s*true/.test(body)
const hasVrModes = (body: string) => /\bwithVrModes\(/.test(body)

/** Снимков у истории: пропущенная — 0, узловая — по режиму на каждый, прочие — 1. */
export const snapshotsOf = (story: StoryExport, fullModes: number) =>
  skipsSnapshot(story.body) ? 0 : hasVrModes(story.body) ? fullModes : 1

export const countSnapshots = (files: StoryFile[], fullModes: number) =>
  files
    .flatMap(storyExports)
    .reduce((sum, story) => sum + snapshotsOf(story, fullModes), 0)

/** Истории вне снимков без причины `vrSkipReason` (VR10). */
export const unexplainedSkips = (files: StoryFile[]) =>
  files
    .flatMap(storyExports)
    .filter(story => skipsSnapshot(story.body))
    .filter(story => {
      const reason = /vrSkipReason:\s*['"`]([^'"`]*)['"`]/.exec(story.body)?.[1]
      return (reason?.trim().length ?? 0) < MIN_REASON
    })
    .map(story => `${story.file}:${story.name}`)

/** Режимы или тег `vr-modes`, заданные вручную, а не `withVrModes` (VR9). */
export const handMadeModes = (files: StoryFile[]) =>
  files
    .flatMap(storyExports)
    .filter(
      story =>
        !hasVrModes(story.body) &&
        (/['"]vr-modes['"]/.test(story.body) || /\bmodes:/.test(story.body)),
    )
    .map(story => `${story.file}:${story.name}`)
