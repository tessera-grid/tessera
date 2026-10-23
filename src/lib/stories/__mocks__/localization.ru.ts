// Русский словарь подписей таблицы для историй — JSON из строк-шаблонов (ADR 0132, LC9):
// перевод каждой подписи, новая подпись библиотеки без перевода роняет typecheck.
import type { LabelDictionary, TableLabels } from '../../core/localization'
import ru from './localization.ru.json'

/** Перевод каждой подписи таблицы строкой-шаблоном. */
type FullTemplates = Record<keyof TableLabels, string> & LabelDictionary

export const RU_LABELS: FullTemplates = ru
