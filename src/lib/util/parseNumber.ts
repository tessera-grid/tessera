/**
 * Число из ввода по языку (ADR 0172, DT14): десятичный знак и разряды языка — «1,5» и
 * «1 234,5» в `ru`, «1,234.5» в `en`. Разряды снимаются, только если стоят по три цифры;
 * одиночная запятая в языке с десятичной точкой — десятичный знак. `null` — пусто, `NaN` —
 * не число.
 */
const separators = new Map<string, { group: string; decimal: string }>()

const separatorsOf = (locale: string) => {
  let found = separators.get(locale)
  if (!found) {
    const parts = new Intl.NumberFormat(locale).formatToParts(12345.6)
    found = {
      group: parts.find(part => part.type === 'group')?.value ?? ',',
      decimal: parts.find(part => part.type === 'decimal')?.value ?? '.',
    }
    separators.set(locale, found)
  }
  return found
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Ввод с разрядами и десятичным знаком языка → запись с точкой; `null` — пусто. */
const normalizeLocaleNumber = (input: string, locale: string) => {
  let text = input.trim()
  if (text === '') return null
  const { group, decimal } = separatorsOf(locale)
  // Пробелы, в том числе неразрывные, — разряды в любом языке, где они бывают (`ru`, `fr`).
  text = text.replace(/\s/g, '')
  if (!/\s/.test(group)) {
    const grouped = new RegExp(
      `^[-+]?\\d{1,3}(${escape(group)}\\d{3})+(${escape(decimal)}\\d+)?$`,
    )
    if (grouped.test(text)) text = text.split(group).join('')
  }
  text = text.replace(decimal, '.')
  if (decimal === '.' && /^[-+]?\d+,\d+$/.test(text)) {
    text = text.replace(',', '.')
  }
  return text
}

export const parseLocaleNumber = (
  input: string,
  locale = 'en-US',
): number | null => {
  const text = normalizeLocaleNumber(input, locale)
  if (text === null) return null
  const value = Number(text)
  return Number.isFinite(value) ? value : Number.NaN
}

/**
 * Ввод по языку → десятичная строка, как набрана, без перевода во float (ADR 0174, TY12):
 * «1 234,50» в `ru` — `"1234.50"`. `null` — пусто, `undefined` — не десятичное число.
 */
export const parseLocaleDecimal = (
  input: string,
  locale = 'en-US',
): string | null | undefined => {
  const text = normalizeLocaleNumber(input, locale)
  if (text === null) return null
  return /^[+-]?\d+(\.\d+)?$/.test(text) ? text.replace(/^\+/, '') : undefined
}
