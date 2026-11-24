/**
 * Десятичное число строкой без перевода во float (ADR 0174, TY10–TY13): разбор, сравнение и
 * запись. Экспонента, разделители разрядов и пробелы — не десятичная строка.
 */

const DECIMAL = /^([+-]?)(\d+)(?:\.(\d+))?$/
const LEADING_ZEROES = /^0+/
const TRAILING_ZEROES = /0+$/

/** Знак и цифры: целая часть без ведущих нулей, дробная — без хвостовых; ноль без знака. */
export interface Decimal {
  negative: boolean
  int: string
  frac: string
}

/** Десятичная строка или конечное число без экспоненты; иначе `undefined`. */
export const parseDecimal = (value: unknown): Decimal | undefined => {
  let text: string
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return undefined
    text = String(value)
  } else if (typeof value === 'string') {
    text = value.trim()
  } else {
    return undefined
  }
  const match = DECIMAL.exec(text)
  if (!match) return undefined
  const integer = match[2]!
  const fraction = match[3] ?? ''
  const int = integer.startsWith('0')
    ? integer.replace(LEADING_ZEROES, '')
    : integer
  const frac = fraction.endsWith('0')
    ? fraction.replace(TRAILING_ZEROES, '')
    : fraction
  return {
    negative: match[1] === '-' && (int !== '' || frac !== ''),
    int,
    frac,
  }
}

const compareMagnitude = (a: Decimal, b: Decimal) => {
  if (a.int.length !== b.int.length) return a.int.length - b.int.length
  if (a.int !== b.int) return a.int < b.int ? -1 : 1
  // Хвостовые нули уже сняты, поэтому короткий префикс всегда меньше длинного.
  return a.frac === b.frac ? 0 : a.frac < b.frac ? -1 : 1
}

/** Порядок двух десятичных: отрицательное, равное или положительное число. */
export const compareDecimal = (a: Decimal, b: Decimal): number => {
  if (a.negative !== b.negative) return a.negative ? -1 : 1
  const magnitude = compareMagnitude(a, b)
  return a.negative ? -magnitude : magnitude
}

/** Значащие цифры: без ведущих нулей числа (Excel хранит 15). */
export const significantDigits = (decimal: Decimal): number =>
  (decimal.int + decimal.frac).replace(/^0+/, '').length

/** Каноническая запись: без ведущих и хвостовых нулей, `"0"` для нуля. */
export const decimalText = (decimal: Decimal): string =>
  `${decimal.negative ? '-' : ''}${decimal.int || '0'}${decimal.frac ? `.${decimal.frac}` : ''}`
