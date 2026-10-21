import { fn } from 'storybook/test'

// Общие аргументы и контролы историй производных кнопок кита (ADR 0128, DB4).

export const DERIVED_BUTTON_ARGS = {
  disabled: false,
  tooltipWhenDisabled: false,
  pending: false,
  failure: undefined as string | undefined,
  onClick: fn(),
}

export const DERIVED_BUTTON_ARG_TYPES = {
  failure: { control: 'text' as const },
  tooltipWhenDisabled: { if: { arg: 'disabled' } },
  // Ключ вспышки: каждое новое значение — вспышка; цикл показывает `UI/IconButton`.
  errorFlash: { table: { disable: true } },
  'data-testid': { table: { disable: true } },
}

/** Контролы `Default` производной кнопки: занятость, отказ и выключенная (ADR 0117, SN30). */
export const DERIVED_BUTTON_CONTROLS = [
  'pending',
  'failure',
  'disabled',
  'tooltipWhenDisabled',
]

/** Включённое состояние (ADR 0129): число и бабл — только у включённой кнопки. */
export const ACTIVE_ARGS = { active: false, count: 0, indicator: true }

export const ACTIVE_ARG_TYPES = {
  count: {
    control: { type: 'number' as const, min: 0 },
    if: { arg: 'active' },
  },
  indicator: { if: { arg: 'active' } },
}

/** Выключенная видна без наведения и показывает тултип. */
export const DISABLED_ARGS = {
  disabled: true,
  tooltipWhenDisabled: true,
}
