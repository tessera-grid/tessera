/**
 * Канал объявлений для скринридеров (ADR 0032, W9): грид регистрирует свою
 * live-область, плагины и потребитель объявляют через `table.announce`. Ключ —
 * общий store: React-адаптер отдаёт гриду другой объект таблицы, чем
 * `cell.getContext().table`, а store у них один.
 */
import type { TableLabels } from './localization'

interface Announcer {
  say: (message: string) => void
  labels: TableLabels
  /** Значение CSS-токена темы в контексте смонтированного грида. */
  token?: (name: string) => string
  /** Токен длины, вычисленный браузером (с `calc()`), px. */
  length?: (name: string) => number
}

const announcers = new WeakMap<object, Announcer>()

const storeOf = (table: unknown) => (table as { store: object }).store

/** Зарегистрировать live-область грида; возвращает отписку. */
export const registerAnnouncer = (table: unknown, announcer: Announcer) => {
  const store = storeOf(table)
  announcers.set(store, announcer)
  return () => {
    if (announcers.get(store) === announcer) {
      announcers.delete(store)
    }
  }
}

/** Подписи смонтированного грида — для текстов, собираемых вне React. */
export const announcerLabels = (table: unknown): TableLabels | undefined =>
  announcers.get(storeOf(table))?.labels

/** Токен темы грида — для таймингов, отсчитываемых вне React; без грида — `''`. */
export const readGridToken = (table: unknown, name: string): string =>
  announcers.get(storeOf(table))?.token?.(name).trim() ?? ''

/**
 * Токен длины темы грида в px: браузер вычисляет `calc()`, которого не разберёт
 * `parseFloat` строки токена; без грида — `NaN`.
 */
export const readGridLength = (table: unknown, name: string): number =>
  announcers.get(storeOf(table))?.length?.(name) ?? NaN

/** Объявить текст; без смонтированного грида — ничего. */
export const announce = (table: unknown, message: string): void =>
  announcers.get(storeOf(table))?.say(message)

/** Объявить локализуемую подпись (если объявления ядра не отключены). */
export const announceLabel = (
  table: unknown,
  pick: (labels: TableLabels) => string,
): void => {
  const announcer = announcers.get(storeOf(table))
  const options = (table as { options: { enableAnnouncements?: boolean } })
    .options
  if (announcer && options.enableAnnouncements !== false) {
    announcer.say(pick(announcer.labels))
  }
}
