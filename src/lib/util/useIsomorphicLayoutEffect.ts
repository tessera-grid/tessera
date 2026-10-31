import { useEffect, useLayoutEffect } from 'react'

/**
 * `useLayoutEffect` в браузере, `useEffect` без DOM (ADR 0091): на сервере эффект
 * раскладки не выполняется, а React 18 на каждый такой хук предупреждает.
 */
export const useIsomorphicLayoutEffect =
  typeof document === 'undefined' ? useEffect : useLayoutEffect
