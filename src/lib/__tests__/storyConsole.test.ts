/**
 * Журнал консоли историй (ADR 0124): колбэки, группы действий и склейка в них, действия
 * истории, предел журнала и значений. Запуск: npx vitest run --config vitest.node.config.ts storyConsole
 */
import { describe, expect, it, vi } from 'vitest'

import {
  CONSOLE_LIMIT,
  DETAIL_LIMIT,
  consoleTextOf,
  createConsoleLog,
  loggedCallbacks,
  preview,
} from '../stories/demos/consoleLog'
import { shellText } from '../stories/demos/storyShell'

/**
 * Журнал с часами и кадрами теста: время записи — счётчик вызовов, конец кадра —
 * `endFrame()`.
 */
const clockLog = () => {
  let time = 0
  const frames: (() => void)[] = []
  const log = createConsoleLog(
    () => (time += 10),
    callback => frames.push(callback),
  )
  return Object.assign(log, {
    endFrame: () => frames.splice(0).forEach(callback => callback()),
  })
}

/** Записи журнала коротко: вид, имя, счётчик и признак записи группы. */
const rows = (log: ReturnType<typeof clockLog>) =>
  log
    .entries()
    .map(
      entry =>
        `${entry.child ? '  ' : ''}${entry.kind}:${consoleTextOf(entry.name, 'en')}${entry.count > 1 ? ` ×${entry.count}` : ''}`,
    )

describe('консоль историй (ADR 0124)', () => {
  it('CL2: колбэк, переданный гриду, пишет запись «Колбэк» с аргументами и вызывается с ними, его результат возвращается гриду, длительность вызова — в записи (у промиса — до завершения); непереданный колбэк не подставляется', async () => {
    const log = clockLog()
    const answer = Promise.resolve('saved')
    const onCellEdit = vi.fn((_commit: unknown) => answer)
    const enabled = () => true
    const record = { onCellEdit, enabled, onRetry: undefined, label: 'x' }
    const logged = loggedCallbacks(log, record)

    const result = logged.onCellEdit({ rowId: 'row-1', value: 5 } as never)
    expect(onCellEdit).toHaveBeenCalledWith({ rowId: 'row-1', value: 5 })
    expect(result).toBe(answer)
    await expect(result).resolves.toBe('saved')
    expect(log.entries()).toMatchObject([
      {
        kind: 'callback',
        name: 'onCellEdit',
        detail: '{rowId:"row-1",value:5}',
      },
    ])
    // Длительность — у промиса после его завершения, у обычного колбэка — сразу.
    expect(log.entries()[0]!.duration).toEqual(expect.any(Number))
    const slow = vi.fn(
      (_value: unknown) => new Promise(resolve => setTimeout(resolve, 30)),
    )
    const pending = loggedCallbacks(log, { onSave: slow }).onSave(1)
    expect(log.entries().at(-1)!.duration).toBeUndefined()
    await pending
    await Promise.resolve()
    expect(log.entries().at(-1)!.duration).toBeGreaterThanOrEqual(25)
    const sync = loggedCallbacks(log, { onToggle: (_value: unknown) => 1 })
    expect(sync.onToggle(true)).toBe(1)
    expect(log.entries().at(-1)!.duration).toEqual(expect.any(Number))
    // Не колбэки и непереданные колбэки — как есть: консоль не меняет поведение грида.
    expect(Object.keys(logged)).toEqual(Object.keys(record))
    expect(logged.enabled).toBe(enabled)
    expect(logged.onRetry).toBeUndefined()
    expect(logged.label).toBe('x')
    // Обёртка на исходный колбэк одна: ссылка стабильна между рендерами.
    expect(loggedCallbacks(log, record).onCellEdit).toBe(logged.onCellEdit)
    // Без журнала — тот же объект.
    expect(loggedCallbacks(undefined, record)).toBe(record)
  })

  it('CL4: записи после действия — в его группе; одинаковые (вид и имя) склеиваются «×N» только внутри одной группы, детали и время — последней; между группами и вне групп записи не склеиваются', () => {
    const log = clockLog()
    log.action({ plugin: 'columnSorting', action: 'toggleSort' })
    log.write('state', 'sorting', 'asc')
    log.write('callback', 'onSortingChange', 'ƒ')
    log.write('state', 'sorting', 'desc')
    const merged = log
      .entries()
      .find(entry => consoleTextOf(entry.name, 'en') === 'sorting')!
    expect(merged).toMatchObject({ detail: 'desc', count: 2, time: 40 })
    log.endFrame()
    // Вне групп — не склеиваются.
    log.write('state', 'sorting', 'none')
    log.write('state', 'sorting', 'asc')
    // Новое действие — своя группа: со строками прошлой не склеивается.
    log.action({ plugin: 'columnSorting', action: 'toggleSort' })
    log.write('state', 'sorting', 'desc')
    expect(rows(log)).toEqual([
      'action:columnSorting · toggleSort',
      '  state:sorting ×2',
      '  callback:onSortingChange',
      'state:sorting',
      'state:sorting',
      'action:columnSorting · toggleSort',
      '  state:sorting',
    ])
  })

  it('CL6: log(name, detail) истории пишет действие истории — строку вида «Действие»', () => {
    const log = clockLog()
    log.log('server', 'saved age of row-0')
    expect(log.entries()).toMatchObject([
      {
        kind: 'action',
        name: 'server',
        detail: 'saved age of row-0',
        source: 'story',
        child: false,
        count: 1,
      },
    ])
  })

  it('CL17: группа действия без фазы закрывается после кадра, группа жеста — от start до end; записи вне действий — без группы и без отступа', () => {
    const log = clockLog()
    log.write('lifecycle', 'Грид смонтирован')
    log.action({ plugin: 'rowSelection', action: 'toggleRow' })
    log.write('state', 'rowSelection')
    log.endFrame()
    log.write('state', 'columnSizing')
    // Жест: группа держится через кадры до конца жеста.
    log.action({ plugin: 'columnSizing', action: 'resize', phase: 'start' })
    log.endFrame()
    log.write('state', 'columnSizing')
    log.action({ plugin: 'rowDragging', action: 'dragOver' })
    log.write('state', 'columnSizing')
    log.action({ plugin: 'rowDragging', action: 'dragOver' })
    log.action({ plugin: 'columnSizing', action: 'resize', phase: 'end' })
    log.write('state', 'columnSizing')
    expect(rows(log)).toEqual([
      'lifecycle:Грид смонтирован',
      'action:rowSelection · toggleRow',
      '  state:rowSelection',
      'state:columnSizing',
      'action:columnSizing · resize',
      '  state:columnSizing ×2',
      '  action:rowDragging · dragOver ×2',
      '  action:columnSizing · resize',
      'state:columnSizing',
    ])
  })

  it('CL13: в журнале не больше 500 записей — старые уходят', () => {
    const log = clockLog()
    for (let index = 0; index < CONSOLE_LIMIT + 100; index++) {
      log.log(`entry-${index}`)
    }
    const entries = log.entries()
    expect(entries).toHaveLength(CONSOLE_LIMIT)
    expect(entries[0]!.name).toBe('entry-100')
    expect(entries.at(-1)!.name).toBe(`entry-${CONSOLE_LIMIT + 99}`)
  })

  it('CL14: значение длиннее 120 символов обрезается «…»; большие значения не сериализуются целиком', () => {
    const long = preview(Array.from({ length: 200 }, (_, index) => index))
    expect(long).toHaveLength(DETAIL_LIMIT + 1)
    expect(long.endsWith('…')).toBe(true)
    expect(preview({ a: 1, b: 'x' })).toBe('{a:1,b:"x"}')

    // Обход прерывается у предела: остаток большого объекта не читается.
    let reads = 0
    const huge: Record<string, number> = {}
    for (let index = 0; index < 10_000; index++) {
      Object.defineProperty(huge, `key${index}`, {
        enumerable: true,
        get: () => (reads += 1),
      })
    }
    expect(preview(huge)).toHaveLength(DETAIL_LIMIT + 1)
    expect(reads).toBeLessThan(50)
    expect(preview('x'.repeat(100_000))).toHaveLength(DETAIL_LIMIT + 1)
  })

  it('GT3: записи обвязки и истории рисуются на текущем языке и переходят на новый при его смене; имена колбэков, срезов и подписи справочника таблицы — как записаны', () => {
    const log = clockLog()
    log.log(
      { ru: 'Сервер ответил', en: 'The server responded' },
      {
        ru: 'строка 1',
        en: 'row 1',
      },
    )
    log.write(
      'lifecycle',
      locale => shellText(locale, 'lifecycleData'),
      locale => shellText(locale, 'lifecycleRows', { count: 5 }),
    )
    log.action({
      plugin: 'story',
      action: locale =>
        shellText(locale, 'consoleControl', { key: 'a', from: '1', to: '2' }),
      source: 'story',
    })
    log.action({
      plugin: 'columnSorting',
      action: 'toggleSort',
      label: 'Sort column',
    })
    log.write('callback', 'onSortingChange', 'ƒ')
    log.write('state', 'sorting', '[]')
    const text = (locale: 'en' | 'ru') =>
      log
        .entries()
        .map(
          entry =>
            `${consoleTextOf(entry.name, locale)} ${consoleTextOf(entry.detail, locale)}${entry.label ? ` «${entry.label}»` : ''}`,
        )
    expect(text('en')).toEqual([
      'The server responded row 1',
      'Data 5 rows',
      'Control a: 1 → 2 ',
      'columnSorting · toggleSort  «Sort column»',
      'onSortingChange ƒ',
      'sorting []',
    ])
    expect(text('ru')).toEqual([
      'Сервер ответил строка 1',
      'Данные 5 строк',
      'Контрол a: 1 → 2 ',
      'columnSorting · toggleSort  «Sort column»',
      'onSortingChange ƒ',
      'sorting []',
    ])
    // Переводимая запись склеивается с той же записью, как и строка.
    log.endFrame()
    log.action({ plugin: 'story', action: 'step' })
    log.write('lifecycle', locale => shellText(locale, 'lifecycleData'), '1')
    log.write('lifecycle', locale => shellText(locale, 'lifecycleData'), '2')
    expect(log.entries().at(-1)!.count).toBe(2)
  })
})
