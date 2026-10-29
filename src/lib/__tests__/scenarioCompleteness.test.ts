/**
 * Реестр исходов (ADR 0151): у асинхронного действия истории показывают ответ и отказ
 * шагами гайда или строка называет причину (OC1, OC3, OC7); каждый колбэк публичного
 * API, который может вернуть промис, есть в реестре (OC2).
 * Запуск: npx vitest run --config vitest.node.config.ts scenarioCompleteness
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { A11Y_EXCLUSIONS } from '../stories/__tests__/catalog'

import { pluginFactoryNames } from './builtinPlugins'
import {
  ENTRY,
  exportedTypeNames,
  firstParamProps,
  typeProps,
} from './publicTypes'
import { STORIES, storyById, storyFiles } from './storyFiles'

const TYPES_TIMEOUT = 120_000
const ROOT = join(__dirname, '..', '..', '..')
const ADR = join(ROOT, 'docs', 'decisions', '0151-scenario-completeness.md')

/** Типы с асинхронными колбэками, которых нет в реестре, — с причиной. */
const NOT_APP_CALLBACKS: Record<string, string> = {
  PromiseLike: 'сам промис, а не колбэк',
  ButtonHTMLAttributes: '`formAction` атрибута React DOM у кнопок кита',
  RowSource: 'источник строк реализует таблица, а не приложение',
}
/** `<Фабрика>Hooks` — те же колбэки опций, прочитанные через `table.getHooks()`. */
const isHooksCopy = (owner: string) => /Hooks$/.test(owner)

type Cell = { story: string; step: string } | { reason: string }

interface Row {
  action: string
  callbacks: string[]
  answer: Cell
  refusal: Cell
}

const parseCell = (text: string): Cell | undefined => {
  const step = /^`(\w+)` › (.+)$/.exec(text)
  if (step) return { story: step[1]!, step: step[2]! }
  const reason = /^—\s*(.*)$/.exec(text)
  return reason ? { reason: reason[1]!.trim() } : undefined
}

/** Строки таблицы раздела «Реестр исходов». */
const registry = (): Row[] => {
  const text = readFileSync(ADR, 'utf8')
  const section = text.split('## Реестр исходов')[1]?.split('\n## ')[0] ?? ''
  return section
    .split('\n')
    .filter(
      line => line.startsWith('|') && !/^\|\s*(-+|Действие)\s*\|/.test(line),
    )
    .map(line => {
      const [action, callbacks, , answer, refusal] = line
        .split('|')
        .slice(1, -1)
        .map(cell => cell.trim())
      const parsed = (cell: string | undefined) => {
        const value = parseCell(cell ?? '')
        if (!value)
          throw new Error(`${action}: ячейка не шаг и не причина: ${cell}`)
        return value
      }
      return {
        action: action!,
        callbacks: [...callbacks!.matchAll(/`([\w.]+)`/g)].map(m => m[1]!),
        answer: parsed(answer),
        refusal: parsed(refusal),
      }
    })
}

/** Названия шагов гайда истории `story` или причина, почему их не найти. */
const guideSteps = (story: string): string[] | string => {
  const found = storyById(story)
  if (!found) return `нет истории ${story}`
  return found.story.steps ?? `у истории ${story} нет гайда`
}

/** Шаги и причины реестра, которых не хватает. */
const missing = (rows: Row[]) =>
  rows.flatMap(row =>
    (
      [
        ['ответ', row.answer],
        ['отказ', row.refusal],
      ] as const
    ).flatMap(([kind, cell]) => {
      if ('reason' in cell) return []
      const steps = guideSteps(cell.story)
      if (typeof steps === 'string') return [`${row.action}, ${kind}: ${steps}`]
      return steps.includes(cell.step)
        ? []
        : [`${row.action}, ${kind}: у ${cell.story} нет шага «${cell.step}»`]
    }),
  )

/** Колбэки публичного API, которые могут вернуть промис: `<Тип>.<свойство>`. */
const asyncCallbacks = () => {
  const props = [
    ...pluginFactoryNames().flatMap(name =>
      firstParamProps(ENTRY.plugins, name),
    ),
    ...typeProps(ENTRY.useCreateTable, 'UseCreateTableParams'),
    ...[ENTRY.index, ENTRY.plugins, ENTRY.ui].flatMap(file =>
      exportedTypeNames(file).flatMap(name => {
        try {
          return typeProps(file, name)
        } catch {
          return []
        }
      }),
    ),
  ]
  return [
    ...new Set(
      props
        .filter(
          prop =>
            prop.returnsThenable &&
            prop.owner &&
            !isHooksCopy(prop.owner) &&
            !(prop.owner in NOT_APP_CALLBACKS),
        )
        .map(prop => `${prop.owner}.${prop.name}`),
    ),
  ].sort()
}

describe('реестр исходов (ADR 0151)', () => {
  it('OC1: у каждой строки реестра истории и шаги ответа и отказа существуют: экспорт истории и шаг её гайда с таким названием', () => {
    const rows = registry()
    expect(rows.length).toBeGreaterThan(20)
    expect(missing(rows)).toEqual([])
  })

  it(
    'OC2: каждый колбэк публичного API, который может вернуть промис, есть в реестре; новый колбэк без строки роняет проверку',
    () => {
      const listed = new Set(registry().flatMap(row => row.callbacks))
      const found = asyncCallbacks()
      expect(found).toContain('CellEditingOptions.onCellEdit')
      expect(found).toContain('MenuAction.onSelect')
      expect(found.filter(name => !listed.has(name))).toEqual([])
    },
    TYPES_TIMEOUT,
  )

  it('OC3: ответ или отказ без шага несёт причину; пустая ячейка роняет проверку', () => {
    const rows = registry()
    const empty = rows.flatMap(row =>
      [row.answer, row.refusal].flatMap(cell =>
        'reason' in cell && cell.reason.length < 10 ? [row.action] : [],
      ),
    )
    expect(empty).toEqual([])
    expect(parseCell('—')).toEqual({ reason: '' })
    expect(parseCell('')).toBeUndefined()
  })

  it('OC7: пробелы, найденные при заполнении реестра, закрыты шагами историй или строкой с причиной', () => {
    const byAction = new Map(registry().map(row => [row.action, row]))
    const refusalStep = (action: string) => {
      const cell = byAction.get(action)?.refusal
      return cell && 'story' in cell ? `${cell.story} › ${cell.step}` : cell
    }
    expect(refusalStep('Асинхронный формат выгрузки')).toBe(
      'ExportExcel › Файл не собран',
    )
    expect(refusalStep('Действие меню строки')).toBe(
      'RowActionsAsync › Сервер отказал',
    )
    expect(byAction.get('Пункт контекстного меню')?.answer).toHaveProperty(
      'reason',
    )
  })
})

/** Подразделы серверной модели строк и их истории — таблица §5 ADR 0151. */
const subsections = () => {
  const text = readFileSync(ADR, 'utf8')
  const section = text.split('### 5.')[1]?.split('\n## ')[0] ?? ''
  return section
    .split('\n')
    .filter(line => line.startsWith('| Data loading/'))
    .map(line => {
      const [title, stories] = line
        .split('|')
        .slice(1, -1)
        .map(cell => cell.trim())
      return { title: title!, stories: stories!.split(', ') }
    })
}

describe('подразделы серверной модели строк (ADR 0151)', () => {
  it('OC5: каждый подраздел «Data loading/Server row model/*» начинается своим Playground; истории сценариев остаются связаны со строками своих ADR', () => {
    const rows = subsections()
    expect(rows).toHaveLength(5)
    const files = storyFiles()
    const base = files.find(
      file => file.section === 'Data loading/Server row model',
    )!
    const problems = rows.flatMap(({ title, stories }) => {
      const file = files.find(item => item.section === title)
      if (!file) return [`нет файла раздела ${title}`]
      const [first, ...rest] = file.stories
      const names = file.stories.map(story => story.name)
      return [
        ...(first?.name === 'Playground' && first.id.endsWith('Playground')
          ? []
          : [`${title}: первая история — не Playground`]),
        ...stories
          .filter(name => !names.includes(name))
          .map(name => `${title}: нет истории «${name}»`),
        ...stories
          .filter(name => base.stories.some(story => story.name === name))
          .map(name => `${title}: «${name}» осталась в основном разделе`),
        ...rest
          .filter(story => !story.scenario)
          .map(story => `${title}: у ${story.id} нет сценария ADR`),
      ]
    })
    expect(problems).toEqual([])
  })

  it('OC6: истории подразделов проходят каталог и матрицу контраста — их нет в исключениях axe, у каждого шага гайда есть близнец высокой контрастности', () => {
    const twins = readFileSync(
      join(STORIES, 'HighContrast.vr.stories.tsx'),
      'utf8',
    )
    const titles = subsections().map(row => row.title)
    const files = storyFiles().filter(file => titles.includes(file.section))
    expect(files).toHaveLength(5)
    const problems = files.flatMap(file => [
      ...A11Y_EXCLUSIONS.filter(item => item.file === file.file).map(
        item => `${file.file}: ${item.story} вне axe`,
      ),
      ...file.stories.flatMap(story =>
        (story.steps ?? [])
          .map((_, index) => `HighContrast${story.id}Step${index + 1}`)
          .filter(twin => !twins.includes(`export const ${twin} = `)),
      ),
    ])
    expect(files.flatMap(file => file.stories).some(s => s.steps)).toBe(true)
    expect(problems).toEqual([])
  })
})
