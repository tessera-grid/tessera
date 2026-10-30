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
 * около пяти полных сборок; обычная правка с TurboSnap снимает лишь затронутые
 * истории.
 */
export const SNAPSHOT_BUDGET = 950

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

/**
 * Шаги гайдов (ADR 0130, DG3): история сценария (`scenario`) → число вызовов `step(` в её
 * экспорте — столько шагов проходит её `play`. Песочницы `*.dev` не снимаются.
 */
export const guideStepCounts = (files: StoryFile[]) =>
  new Map(
    files
      .filter(({ file }) => !file.includes('.dev.'))
      .flatMap(storyExports)
      .filter(story => /\bscenario:\s*'/.test(story.body))
      .map((story): [string, number] => [
        `${story.file}:${story.name}`,
        (story.body.match(/\bstep\(/g) ?? []).length,
      ])
      .filter(([, steps]) => steps > 0),
  )

const skipsSnapshot = (body: string) => /disableSnapshot:\s*true/.test(body)
const hasVrModes = (body: string) => /\bvrModes\(/.test(body)
const hasVrTag = (body: string) => /['"]vr-modes['"]/.test(body)

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

/**
 * Режимы не вместе с тегом (VR9): тег `vr-modes` без `vrModes(...)`, `vrModes(...)` без
 * тега или режимы, заданные вручную.
 */
export const handMadeModes = (files: StoryFile[]) =>
  files
    .flatMap(storyExports)
    .filter(
      story =>
        hasVrTag(story.body) !== hasVrModes(story.body) ||
        /\bmodes:/.test(story.body),
    )
    .map(story => `${story.file}:${story.name}`)

/** Файл дымовых тестов историй — их место в `play` самих историй (VR13). */
export const isStoryTestFile = (file: string) =>
  /-stories\.test\.tsx?$/.test(file)

/** Тест о демо-истории: имя называет историю — «история …», `the "…" story`. */
const STORY_TEST =
  /\btest\(\s*(['"`])([A-Z]+\d+): (?:(?!\1)[^\n])*?(?:истори[яи]\s+[«"A-Z]|stor(?:y|ies)\s+["«]|["»]\s+stor(?:y|ies)\b)/g

/** ID тестов о демо-историях в файлах тестов (VR13). */
export const storyTests = (files: StoryFile[]) =>
  files.flatMap(({ text }) =>
    [...text.matchAll(STORY_TEST)].map(match => match[2]!),
  )
