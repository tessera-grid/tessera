// Русский словарь подписей таблицы для историй — JSON из строк-шаблонов (ADR 0132, LC9):
// перевод каждой подписи, новая подпись библиотеки без перевода роняет typecheck.
import type {
  LabelDictionary,
  PluginLabelKey,
  TableLabels,
} from '../../core/localization'
import ru from './localization.ru.json'

/** Перевод каждой подписи таблицы и владельцев (ADR 0182, §8) строкой-шаблоном. */
type FullTemplates = Record<keyof TableLabels | PluginLabelKey, string> &
  LabelDictionary

export const RU_LABELS: FullTemplates = ru
