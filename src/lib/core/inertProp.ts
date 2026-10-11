import { REACT_MAJOR } from './reactVersion'

/**
 * `inert` для React 18 и 19 (ADR 0091): React 18 атрибута не знает и булево значение не
 * пишет в DOM — только строку.
 */
export const inertProp = (value: boolean): { inert?: boolean } =>
  REACT_MAJOR >= 19
    ? { inert: value }
    : value
      ? { inert: '' as unknown as boolean }
      : {}
