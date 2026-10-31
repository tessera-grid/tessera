import { useEffect, useRef } from 'react'

import { logWarn, shouldLog } from '../../util/logger'

/**
 * Включённое состояние скринридеру передаёт подпись (ADR 0129, §5): `active` сменился, а
 * доступное имя нет и своего `aria-pressed`/`aria-expanded`/`aria-checked` нет —
 * предупреждение в разработке.
 */
export const useActiveNameCheck = (
  active: boolean | undefined,
  name: string | undefined,
  hasState: boolean,
) => {
  const previous = useRef<{ active?: boolean; name?: string } | null>(null)
  useEffect(() => {
    const was = previous.current
    previous.current = { active, name }
    if (
      !was ||
      active === undefined ||
      was.active === undefined ||
      was.active === active ||
      was.name !== name ||
      hasState ||
      !shouldLog({}, 'warn')
    ) {
      return
    }
    logWarn(
      {},
      `Кнопка «${name ?? ''}»: active сменился, а доступное имя нет — скринридер не узнает о включённом состоянии. Передайте его в label или aria-label (ADR 0129, AV8).`,
      `active-name:${name ?? ''}`,
    )
  }, [active, name, hasState])
}
