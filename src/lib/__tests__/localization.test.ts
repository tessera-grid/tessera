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
import { rowExpandingLabels } from '../plugins/rowExpanding/labels'
import { rowSelectionLabels } from '../plugins/rowSelection/labels'
import { paginationLabels } from '../plugins/pagination/labels'
import { columnFilteringLabels } from '../plugins/columnFiltering/labels'
import { cellSelectionLabels } from '../plugins/cellSelection/labels'
import { infiniteScrollLabels } from '../plugins/infiniteScroll/labels'
import { quickSearchLabels } from '../plugins/quickSearch/labels'
import { columnVisibilityLabels } from '../plugins/columnVisibility/labels'

/** Неразрывный пробел — разделитель тысяч в русском `Intl.NumberFormat`. */
const NBSP = ' '

describe('Разрешитель подписей', () => {
  it('LC1: значение подписи — строка или функция: строка без подстановок выводится как есть, функция вызывается с позиционными параметрами, как раньше', () => {
    const labels = resolveLabels(
      {
        'rowExpanding.expandRow': 'Развернуть строку',
        'rowSelection.selectedRowsShort': 'выбрано',
        'pagination.pageRange': (from, to, total) => `${from}..${to}/${total}`,
      },
      'ru',
    )
    expect(rowExpandingLabels(labels).expandRow).toBe('Развернуть строку')
    expect(rowSelectionLabels(labels).selectedRowsShort(3)).toBe('выбрано')
    expect(paginationLabels(labels).pageRange(1, 10, 25)).toBe('1..10/25')
    // Чего нет в словаре — английское умолчание.
    expect(rowExpandingLabels(labels).collapseRow).toBe(
      rowExpandingLabels.defaults.collapseRow,
    )
    expect(paginationLabels(labels).pageAnnouncement(2, 5)).toBe('Page 2 of 5')
  })

  it('LC2: {имя} в строке заменяется значением параметра подписи с тем же именем; подстановка без такого параметра остаётся текстом', () => {
    const labels = resolveLabels(
      {
        'pagination.pageRange': 'Строки {from}–{to} из {total}',
        'columnFiltering.removeFilter': 'Снять фильтр {column} {unknown}',
      },
      'ru',
    )
    expect(paginationLabels(labels).pageRange(1, 10, 25)).toBe(
      'Строки 1–10 из 25',
    )
    expect(columnFilteringLabels(labels).removeFilter('Город')).toBe(
      'Снять фильтр Город {unknown}',
    )
  })

  it('LC3: у подписи с count ключ ищется с суффиксом формы Intl.PluralRules, затем без суффикса; при count = 0 сначала _zero в любом языке', () => {
    const ru = resolveLabels(
      {
        'rowSelection.selectedRows_zero': 'Ничего не выбрано',
        'rowSelection.selectedRows_one': 'Выбрана {count} строка',
        'rowSelection.selectedRows_few': 'Выбрано {count} строки',
        'rowSelection.selectedRows_many': 'Выбрано {count} строк',
        'cellSelection.announceCopy': 'Скопировано ячеек: {count}',
        'cellSelection.announceCopy_one': 'Скопирована {count} ячейка',
      },
      'ru',
    )
    expect(
      [0, 1, 2, 5, 21, 22, 25].map(count =>
        rowSelectionLabels(ru).selectedRows(count),
      ),
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
    expect(cellSelectionLabels(ru).announceCopy(1)).toBe('Скопирована 1 ячейка')
    expect(cellSelectionLabels(ru).announceCopy(7)).toBe('Скопировано ячеек: 7')

    // `_zero` — при нуле и в языке без такой формы.
    const en = resolveLabels(
      {
        'infiniteScroll.announceMoreLoaded_zero': 'Nothing more',
        'infiniteScroll.announceMoreLoaded_one': 'One more row',
        'infiniteScroll.announceMoreLoaded_other': '{count} more rows',
      },
      'en-US',
    )
    expect(
      [0, 1, 3].map(count =>
        infiniteScrollLabels(en).announceMoreLoaded(count),
      ),
    ).toEqual(['Nothing more', 'One more row', '3 more rows'])
  })

  it('LC4: числа в подстановках — Intl.NumberFormat(locale), списки — Intl.ListFormat(locale)', () => {
    const dictionary = {
      'pagination.pageRange': '{from}–{to} / {total}',
      'quickSearch.searchColumnsHint': 'Поиск: {columns}',
    }
    const ru = resolveLabels(dictionary, 'ru')
    const en = resolveLabels(dictionary, 'en-US')
    expect(paginationLabels(ru).pageRange(1, 10, 12_340)).toBe(
      `1–10 / 12${NBSP}340`,
    )
    expect(paginationLabels(en).pageRange(1, 10, 12_340)).toBe('1–10 / 12,340')
    expect(
      quickSearchLabels(ru).searchColumnsHint(['Имя', 'Город', 'Возраст']),
    ).toBe('Поиск: Имя, Город и Возраст')
    expect(
      quickSearchLabels(en).searchColumnsHint(['Name', 'City', 'Age']),
    ).toBe('Поиск: Name, City, and Age')
  })

  it('LC6: составные подписи — отдельными ключами, каждый выражается шаблоном без условий; названия возможностей exportView переводятся', () => {
    // Словарь только из строк: каждую ветку бывшей составной подписи задаёт свой ключ.
    const labels = resolveLabels(
      {
        'columnFiltering.filters': 'Фильтры',
        'columnFiltering.filtersActive': 'Фильтры: {count}',
        'columnFiltering.filtersActiveHidden':
          'Фильтры: {count}, на скрытых: {hidden}',
        announceSortAscending: '«{column}» по возрастанию',
        announceSortDescending: '«{column}» по убыванию',
        announceSortCleared: 'Сортировка снята',
        'infiniteScroll.loadedRows': 'Загружено {count}',
        'infiniteScroll.loadedRowsOf': 'Загружено {count} из {total}',
        'infiniteScroll.loadedRowsShort': '{count}',
        'infiniteScroll.loadedRowsOfShort': '{count} / {total}',
        announceLoadError: 'Не обновлено',
        announceLoadErrorReason: 'Не обновлено: {reason}',
        announceLoadFailed: 'Не загружено',
        announceLoadFailedReason: 'Не загружено: {reason}',
        'dataExport.exportView': 'С {features}',
        'dataExport.exportViewSorting': 'сортировкой',
        'dataExport.exportViewFiltering': 'фильтрами',
        serverActionFailedSorting: 'Сортировка не применена',
        serverActionFailedFiltering: 'Фильтры не применены',
        serverActionFailedSearch: 'Поиск не применён',
        serverActionFailedPagination: 'Страница не сменилась',
        'rowExpanding.announceChildrenLoaded_zero': 'Строк нет',
        'rowExpanding.announceChildrenLoaded': 'Загружено строк: {count}',
      },
      'ru',
    )
    expect([
      columnFilteringLabels(labels).filters,
      columnFilteringLabels(labels).filtersActive(2),
      columnFilteringLabels(labels).filtersActiveHidden(2, 1),
      labels.announceSortAscending('Город'),
      labels.announceSortDescending('Город'),
      labels.announceSortCleared,
      infiniteScrollLabels(labels).loadedRows(50),
      infiniteScrollLabels(labels).loadedRowsOf(50, 1000),
      infiniteScrollLabels(labels).loadedRowsShort(50),
      infiniteScrollLabels(labels).loadedRowsOfShort(50, 1000),
      labels.announceLoadError,
      labels.announceLoadErrorReason('таймаут'),
      labels.announceLoadFailed,
      labels.announceLoadFailedReason('таймаут'),
      rowExpandingLabels(labels).announceChildrenLoaded(0),
      rowExpandingLabels(labels).announceChildrenLoaded(3),
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
    expect(paginationLabels(fromJson).pageRange(1, 25, 1000)).toBe(
      paginationLabels(english).pageRange(1, 25, 1000),
    )
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
      rowSelectionLabels(english).selectedRows(1),
      rowSelectionLabels(english).selectedRows(3),
      rowExpandingLabels(english).announceChildrenLoaded(0),
      columnFilteringLabels(english).filtersActiveHidden(2, 1),
      english.announceSortDescending('City'),
      infiniteScrollLabels(english).loadedRowsOf(12_340, 100_000),
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
    expect(columnVisibilityLabels.defaults.allColumns).toBe('All columns')
    expect(typeof columnVisibilityLabels.defaults.selectedColumns).toBe(
      'string',
    )
    expect(columnVisibilityLabels.params.selectedColumns).toEqual(['count'])
    const en = resolveLabels(undefined, 'en-US')
    expect(columnVisibilityLabels(en).allColumns).toBe('All columns')
    expect(columnVisibilityLabels(en).selectedColumns(1)).toBe(
      '1 column selected',
    )
    expect(columnVisibilityLabels(en).selectedColumns(3)).toBe(
      '3 columns selected',
    )
    const ru = resolveLabels(RU_LABELS, 'ru-RU')
    expect(columnVisibilityLabels(ru).allColumns).toBe('Все колонки')
    expect(
      [1, 3, 5, 21].map(columnVisibilityLabels(ru).selectedColumns),
    ).toEqual([
      'Выбрано: 1 колонка',
      'Выбрано: 3 колонки',
      'Выбрано: 5 колонок',
      'Выбрано: 21 колонка',
    ])
  })
})
