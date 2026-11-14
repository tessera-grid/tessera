// Проверка языка историй по файлам (ADR 0225): кириллица вне `ru`, пары шагов,
// имена шагов `play`. Запуск: node scripts/check-story-language.ts <файл от src/lib/stories>…
import {
  cyrillicOutsideRu,
  guideTexts,
  playStepsNotByTitle,
} from '../src/lib/__tests__/storyLanguage.ts'

let failed = false
for (const file of process.argv.slice(2)) {
  const problems = [
    ...cyrillicOutsideRu(file).map(line => `cyrillic outside ru — ${line}`),
    ...guideTexts(file)
      .filter(
        ({ pair }) => !pair.dynamic && (!pair.ru?.trim() || !pair.en?.trim()),
      )
      .map(({ line, what }) => `missing ru/en — ${line}: ${what}`),
    ...playStepsNotByTitle(file).map(
      line => `play step not by title.ru — ${line}`,
    ),
  ]
  if (problems.length > 0) failed = true
  console.log(
    `${file}: ${problems.length === 0 ? 'OK' : problems.length + ' problem(s)'}`,
  )
  for (const problem of problems) console.log(`  ${problem}`)
}
process.exitCode = failed ? 1 : 0
