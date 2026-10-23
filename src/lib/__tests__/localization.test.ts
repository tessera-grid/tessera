/**
 * Разрешитель подписей (ADR 0132, LC1–LC4, LC6–LC7): строки-шаблоны и функции,
 * подстановки, формы слова по числу, числа и списки по языку; составные подписи —
 * отдельными ключами, английский словарь — шаблонами.
 * Запуск: npx vitest run --config vitest.node.config.ts localization
 */
import { describe, expect, it } from 'vitest'

import {
  DEFAULT_LABELS,
  LABEL_PARAMS,
  resolveLabels,
  unknownLabelKeys,
} from '../core/localization'
import { serverActionReason } from '../core/serverActions/reason'
import { rowLabel } from '../plugins/dataExport/rowLabel'
import { RU_LABELS } from '../stories/__mocks__/localization.ru'

/** Неразрывный пробел — разделитель тысяч в русском `Intl.NumberFormat`. */
const NBSP = ' '

describe('Разрешитель подписей', () => {
  it('LC1: значение подписи — строка или функция: строка без подстановок выводится как есть, функция вызывается с позиционными параметрами, как раньше', () => {
    const labels = resolveLabels(
      {
        expandRow: 'Развернуть строку',
        selectedRowsShort: 'выбрано',
        pageRange: (from, to, total) => `${from}..${to}/${total}`,
      },
      'ru',
    )
    expect(labels.expandRow).toBe('Развернуть строку')
    expect(labels.selectedRowsShort(3)).toBe('выбрано')
    expect(labels.pageRange(1, 10, 25)).toBe('1..10/25')
    // Чего нет в словаре — английское умолчание.
    expect(labels.collapseRow).toBe(DEFAULT_LABELS.collapseRow)
    expect(labels.pageAnnouncement(2, 5)).toBe('Page 2 of 5')
  })

  it('LC2: {имя} в строке заменяется значением параметра подписи с тем же именем; подстановка без такого параметра остаётся текстом', () => {
    const labels = resolveLabels(
      {
        pageRange: 'Строки {from}–{to} из {total}',
        removeFilter: 'Снять фильтр {column} {unknown}',
      },
      'ru',
    )
    expect(labels.pageRange(1, 10, 25)).toBe('Строки 1–10 из 25')
    expect(labels.removeFilter('Город')).toBe('Снять фильтр Город {unknown}')
  })

  it('LC3: у подписи с count ключ ищется с суффиксом формы Intl.PluralRules, затем без суффикса; при count = 0 сначала _zero в любом языке', () => {
    const ru = resolveLabels(
      {
        selectedRows_zero: 'Ничего не выбрано',
        selectedRows_one: 'Выбрана {count} строка',
        selectedRows_few: 'Выбрано {count} строки',
        selectedRows_many: 'Выбрано {count} строк',
        announceCopy: 'Скопировано ячеек: {count}',
        announceCopy_one: 'Скопирована {count} ячейка',
      },
      'ru',
    )
    expect(
      [0, 1, 2, 5, 21, 22, 25].map(count => ru.selectedRows(count)),
    ).toEqual([
      'Ничего не выбрано',
      'Выбрана 1 строка',
      'Выбрано 2 строки',
      'Выбрано 5 строк',
      'Выбрана 21 строка',
      'Выбрано 22 строки',
      'Выбрано 25 строк',
    ])
    // Формы нет — ключ без суффикса.
    expect(ru.announceCopy(1)).toBe('Скопирована 1 ячейка')
    expect(ru.announceCopy(7)).toBe('Скопировано ячеек: 7')

    // `_zero` — при нуле и в языке без такой формы.
    const en = resolveLabels(
      {
        announceMoreLoaded_zero: 'Nothing more',
        announceMoreLoaded_one: 'One more row',
        announceMoreLoaded_other: '{count} more rows',
      },
      'en-US',
    )
    expect([0, 1, 3].map(count => en.announceMoreLoaded(count))).toEqual([
      'Nothing more',
      'One more row',
      '3 more rows',
    ])
  })

  it('LC4: числа в подстановках — Intl.NumberFormat(locale), списки — Intl.ListFormat(locale)', () => {
    const dictionary = {
      pageRange: '{from}–{to} / {total}',
      searchColumnsHint: 'Поиск: {columns}',
    }
    const ru = resolveLabels(dictionary, 'ru')
    const en = resolveLabels(dictionary, 'en-US')
    expect(ru.pageRange(1, 10, 12_340)).toBe(`1–10 / 12${NBSP}340`)
    expect(en.pageRange(1, 10, 12_340)).toBe('1–10 / 12,340')
    expect(ru.searchColumnsHint(['Имя', 'Город', 'Возраст'])).toBe(
      'Поиск: Имя, Город и Возраст',
    )
    expect(en.searchColumnsHint(['Name', 'City', 'Age'])).toBe(
      'Поиск: Name, City, and Age',
    )
  })

  it('LC6: составные подписи — отдельными ключами, каждый выражается шаблоном без условий; названия возможностей exportView переводятся', () => {
    // Словарь только из строк: каждую ветку бывшей составной подписи задаёт свой ключ.
    const labels = resolveLabels(
      {
        filters: 'Фильтры',
        filtersActive: 'Фильтры: {count}',
        filtersActiveHidden: 'Фильтры: {count}, на скрытых: {hidden}',
        announceSortAscending: '«{column}» по возрастанию',
        announceSortDescending: '«{column}» по убыванию',
        announceSortCleared: 'Сортировка снята',
        loadedRows: 'Загружено {count}',
        loadedRowsOf: 'Загружено {count} из {total}',
        loadedRowsShort: '{count}',
        loadedRowsOfShort: '{count} / {total}',
        announceLoadError: 'Не обновлено',
        announceLoadErrorReason: 'Не обновлено: {reason}',
        announceLoadFailed: 'Не загружено',
        announceLoadFailedReason: 'Не загружено: {reason}',
        exportView: 'С {features}',
        exportViewSorting: 'сортировкой',
        exportViewFiltering: 'фильтрами',
        serverActionFailedSorting: 'Сортировка не применена',
        serverActionFailedFiltering: 'Фильтры не применены',
        serverActionFailedSearch: 'Поиск не применён',
        serverActionFailedPagination: 'Страница не сменилась',
        announceChildrenLoaded_zero: 'Строк нет',
        announceChildrenLoaded: 'Загружено строк: {count}',
      },
      'ru',
    )
    expect([
      labels.filters,
      labels.filtersActive(2),
      labels.filtersActiveHidden(2, 1),
      labels.announceSortAscending('Город'),
      labels.announceSortDescending('Город'),
      labels.announceSortCleared,
      labels.loadedRows(50),
      labels.loadedRowsOf(50, 1000),
      labels.loadedRowsShort(50),
      labels.loadedRowsOfShort(50, 1000),
      labels.announceLoadError,
      labels.announceLoadErrorReason('таймаут'),
      labels.announceLoadFailed,
      labels.announceLoadFailedReason('таймаут'),
      labels.announceChildrenLoaded(0),
      labels.announceChildrenLoaded(3),
    ]).toEqual([
      'Фильтры',
      'Фильтры: 2',
      'Фильтры: 2, на скрытых: 1',
      '«Город» по возрастанию',
      '«Город» по убыванию',
      'Сортировка снята',
      'Загружено 50',
      `Загружено 50 из 1${NBSP}000`,
      '50',
      `50 / 1${NBSP}000`,
      'Не обновлено',
      'Не обновлено: таймаут',
      'Не загружено',
      'Не загружено: таймаут',
      'Строк нет',
      'Загружено строк: 3',
    ])
    // Названия возможностей и отказ по виду действия — из словаря, а не из кода.
    expect(rowLabel(labels, 'view', ['sorting', 'filtering'])).toBe(
      'С сортировкой и фильтрами',
    )
    expect(
      (['sorting', 'filtering', 'search', 'pagination'] as const).map(kind =>
        serverActionReason({ kind, error: undefined }, labels),
      ),
    ).toEqual([
      'Сортировка не применена',
      'Фильтры не применены',
      'Поиск не применён',
      'Страница не сменилась',
    ])
  })

  it('LC7: английские DEFAULT_LABELS — строки-шаблоны, без функций', () => {
    const values = Object.entries(DEFAULT_LABELS)
    expect(values.filter(([, value]) => typeof value !== 'string')).toEqual([])
    // Словарь переживает JSON и не несёт лишних ключей.
    expect(unknownLabelKeys(DEFAULT_LABELS)).toEqual([])
    const fromJson = resolveLabels(
      JSON.parse(JSON.stringify(DEFAULT_LABELS)),
      'en-US',
    )
    const english = resolveLabels(undefined, 'en-US')
    expect(fromJson.pageRange(1, 25, 1000)).toBe(english.pageRange(1, 25, 1000))
    // Каждая подстановка шаблона — параметр своей подписи.
    const params: Record<string, readonly string[]> = LABEL_PARAMS
    const dangling = values.flatMap(([key, template]) =>
      [...String(template).matchAll(/\{(\w+)\}/g)]
        .map(([, name]) => name)
        .filter(name => !(params[key.split('_')[0]!] ?? []).includes(name!))
        .map(name => `${key}: {${name}}`),
    )
    expect(dangling).toEqual([])
    // Английский текст прежний: форма числа, ноль, ветки бывших составных подписей.
    expect([
      english.selectedRows(1),
      english.selectedRows(3),
      english.announceChildrenLoaded(0),
      english.filtersActiveHidden(2, 1),
      english.announceSortDescending('City'),
      english.loadedRowsOf(12_340, 100_000),
    ]).toEqual([
      '1 row selected',
      '3 rows selected',
      'No rows',
      'Filters, 2 active, 1 on hidden columns',
      'Sorted by City, descending',
      'Loaded 12,340 of 100,000',
    ])
  })

  it('HA8: подписи allColumns и selectedColumns — шаблонами в словаре, selectedColumns — с формами числа', () => {
    expect(DEFAULT_LABELS.allColumns).toBe('All columns')
    expect(typeof DEFAULT_LABELS.selectedColumns).toBe('string')
    expect(LABEL_PARAMS.selectedColumns).toEqual(['count'])
    const en = resolveLabels(undefined, 'en-US')
    expect(en.allColumns).toBe('All columns')
    expect(en.selectedColumns(1)).toBe('1 column selected')
    expect(en.selectedColumns(3)).toBe('3 columns selected')
    const ru = resolveLabels(RU_LABELS, 'ru-RU')
    expect(ru.allColumns).toBe('Все колонки')
    expect([1, 3, 5, 21].map(ru.selectedColumns)).toEqual([
      'Выбрано: 1 колонка',
      'Выбрано: 3 колонки',
      'Выбрано: 5 колонок',
      'Выбрано: 21 колонка',
    ])
  })
})
