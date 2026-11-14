/**
 * Словарь оболочки историй (ADR 0225, §2): панель гайда, консоль, демо-панель и записи
 * обвязки. Отдельно от словаря таблицы: приложение эти тексты не переводит, в `dist` их нет.
 */
import { formatTemplate } from '../../core/localization/resolveLabels'
import {
  type StoryLocale,
  type StoryText,
  storyLocaleOf,
} from '../__mocks__/storyText'

/** Формы слова по числу (`Intl.PluralRules`); `other` — всегда. */
type Forms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string }

interface CountText {
  readonly ru: Forms
  readonly en: Forms
}

export const STORY_SHELL = {
  guideRegion: { ru: 'Сценарий: {title}', en: 'Scenario: {title}' },
  guideTitle: { ru: 'Гайд · {title}', en: 'Guide · {title}' },
  guideStepOf: {
    ru: '· шаг {step} из {count}',
    en: '· step {step} of {count}',
  },
  guideFinished: { ru: '· пройден', en: '· completed' },
  guideToggleLocked: {
    ru: 'Шаг выполняется: панель можно свернуть после него',
    en: 'A step is running: you can collapse the panel once it finishes',
  },
  guideChanged: { ru: 'Таблица изменена', en: 'Table changed' },
  guideRestoreTooltip: {
    ru: 'Таблица изменена: открыть шаг заново',
    en: 'The table was changed: open the step again',
  },
  guideRestore: { ru: 'Вернуть шаг', en: 'Restore step' },
  guidePlay: { ru: 'Воспроизвести', en: 'Play' },
  guidePause: { ru: 'Пауза', en: 'Pause' },
  guideBack: { ru: 'Назад', en: 'Back' },
  guideRestart: { ru: 'Сначала', en: 'Restart' },
  guideNext: { ru: 'Далее', en: 'Next' },
  guideFinish: { ru: 'Закончить', en: 'Finish' },
  guideDone: { ru: 'Пройдено', en: 'Done' },
  guideStepAction: { ru: 'Шаг {step} · {title}', en: 'Step {step} · {title}' },
  consoleTitle: { ru: 'Консоль', en: 'Console' },
  consoleEvents: {
    ru: {
      one: '{count} событие',
      few: '{count} события',
      many: '{count} событий',
      other: '{count} события',
    },
    en: { one: '{count} event', other: '{count} events' },
  },
  consoleKindAction: { ru: 'Действие', en: 'Action' },
  consoleKindCallback: { ru: 'Колбэк', en: 'Callback' },
  consoleKindState: { ru: 'Состояние', en: 'State' },
  consoleKindLifecycle: { ru: 'Цикл', en: 'Lifecycle' },
  consoleFilterAction: { ru: 'Действия', en: 'Actions' },
  consoleFilterCallback: { ru: 'Колбэки', en: 'Callbacks' },
  consoleFilterState: { ru: 'Состояние', en: 'State' },
  consoleFilterLifecycle: { ru: 'Жизненный цикл', en: 'Lifecycle' },
  consoleSourcePointer: { ru: 'мышь', en: 'pointer' },
  consoleSourceKeyboard: { ru: 'клавиатура', en: 'keyboard' },
  consoleSourceApi: { ru: 'API', en: 'API' },
  consoleSourceAuto: { ru: 'грид', en: 'grid' },
  consoleSourceStory: { ru: 'история', en: 'story' },
  consoleFilters: { ru: 'Фильтры', en: 'Filters' },
  consoleFiltersMenu: { ru: 'Фильтры консоли', en: 'Console filters' },
  consoleShowAll: { ru: 'Показать все', en: 'Show all' },
  consoleClear: { ru: 'Очистить', en: 'Clear' },
  consoleLog: { ru: 'События таблицы', en: 'Table events' },
  consoleEmpty: { ru: 'Событий пока нет', en: 'No events yet' },
  consoleColumnKind: { ru: 'Тип', en: 'Type' },
  consoleColumnEvent: { ru: 'Событие', en: 'Event' },
  consoleColumnTime: { ru: 'Время', en: 'Time' },
  consoleColumnDuration: { ru: 'Длительность', en: 'Duration' },
  consoleMilliseconds: { ru: '{value} мс', en: '{value} ms' },
  consoleSeconds: { ru: '{value} с', en: '{value} s' },
  consoleControl: {
    ru: 'Контрол {key}: {from} → {to}',
    en: 'Control {key}: {from} → {to}',
  },
  lifecycleMounted: { ru: 'Грид смонтирован', en: 'Grid mounted' },
  lifecycleRecreated: { ru: 'Грид пересоздан', en: 'Grid recreated' },
  lifecycleMountDetail: {
    ru: 'загрузка {loading}, {rows}, {columns}, плагины: {plugins}',
    en: 'loading {loading}, {rows}, {columns}, plugins: {plugins}',
  },
  lifecycleNoPlugins: { ru: 'нет', en: 'none' },
  lifecyclePlugins: { ru: 'Плагины', en: 'Plugins' },
  lifecycleLoading: { ru: 'Загрузка', en: 'Loading' },
  lifecycleData: { ru: 'Данные', en: 'Data' },
  lifecycleColumns: { ru: 'Колонки', en: 'Columns' },
  lifecycleRows: {
    ru: {
      one: '{count} строка',
      few: '{count} строки',
      many: '{count} строк',
      other: '{count} строки',
    },
    en: { one: '{count} row', other: '{count} rows' },
  },
  lifecycleColumnCount: {
    ru: {
      one: '{count} колонка',
      few: '{count} колонки',
      many: '{count} колонок',
      other: '{count} колонки',
    },
    en: { one: '{count} column', other: '{count} columns' },
  },
} as const satisfies Record<string, StoryText | CountText>

export type StoryShellKey = keyof typeof STORY_SHELL

const NUMBER_LOCALE: Record<StoryLocale, string> = {
  en: 'en-US',
  ru: 'ru-RU',
}

const pluralRules = new Map<StoryLocale, Intl.PluralRules>()

const formsOf = (forms: Forms, count: unknown, locale: StoryLocale) => {
  if (typeof count !== 'number') return forms.other
  let rules = pluralRules.get(locale)
  if (!rules) {
    rules = new Intl.PluralRules(NUMBER_LOCALE[locale])
    pluralRules.set(locale, rules)
  }
  return forms[rules.select(count)] ?? forms.other
}

/** Текст оболочки на языке истории; у текстов с числом форма — по `count`. */
export const shellText = (
  locale: string | undefined,
  key: StoryShellKey,
  params: Record<string, unknown> = {},
): string => {
  const language = storyLocaleOf(locale)
  const entry: StoryText | CountText = STORY_SHELL[key]
  const value = entry[language]
  const template =
    typeof value === 'string' ? value : formsOf(value, params.count, language)
  return formatTemplate(template, params, NUMBER_LOCALE[language])
}
