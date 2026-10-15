import { memo, useRef, useState } from 'react'
import clsx from 'clsx'

import { useIsomorphicLayoutEffect } from '../../core/useIsomorphicLayoutEffect'
import { useErrorFlash } from '../buttonStates/useErrorFlash'
import { usePresence } from '../usePresence'

import styles from './LinearProgress.module.css'

interface LinearProgressProps {
  label: string
  /** Идёт обновление данных — синее свечение. */
  active?: boolean
  /** Ключ ошибки загрузки: каждое новое значение — вспышка красного света (ADR 0096). */
  errorFlash?: number
}

/**
 * @description
 * Индикатор загрузки грида (ADR 0094): размытая полоса оттенков синего по нижней
 * границе шапки — цвета текут вдоль неё, яркость дышит и не гаснет. Отказ загрузки
 * (ADR 0096) переводит её в ровный красный свет — он держится и гаснет. Контейнер
 * смонтирован всегда: красный свет нарастает и без идущего обновления.
 */
export const LinearProgress = memo(
  ({ label, active = true, errorFlash }: LinearProgressProps) => {
    const ref = useRef<HTMLDivElement>(null)
    const phase = useErrorFlash(ref, errorFlash)
    // Повтор начался во время вспышки — красный сразу перетекает в синее свечение.
    const flash = active ? undefined : phase
    const shown = active || flash !== undefined
    // Синее свечение появляется и уходит плавно; под красным — гаснет на вспышку.
    const glows = usePresence<HTMLDivElement>(active || flash === 'on')
    // Первый кадр слоя — без света: рост идёт переходом от него, и уход посреди роста
    // убывает от текущих значений (LE20).
    const [entering, setEntering] = useState(true)
    if (!glows.mounted && !entering) {
      setEntering(true)
    }
    useIsomorphicLayoutEffect(() => {
      const el = glows.ref.current
      if (!entering || !el) {
        return
      }
      // Стиль первого кадра должен быть посчитан, иначе переходу не от чего начаться.
      getComputedStyle(el).getPropertyValue('--tsr-loader-grow-fill')
      setEntering(false)
    }, [entering, glows.mounted, glows.ref])

    return (
      <div
        ref={ref}
        className={clsx(
          shown && 'data-grid__loader',
          styles['linear-progress'],
        )}
        role={active ? 'progressbar' : undefined}
        aria-label={active ? label : undefined}
        data-error-flash={flash}
      >
        {glows.mounted && (
          <div
            ref={glows.ref}
            className={styles.glows}
            data-entering={entering || undefined}
            data-leaving={glows.leaving || undefined}
          >
            <div
              className={clsx(
                'data-grid__loader-glow',
                styles.glow,
                styles.flow,
              )}
            />
            <div
              className={clsx(
                'data-grid__loader-glow',
                styles.glow,
                styles.counter,
              )}
            />
          </div>
        )}
        {(glows.mounted || shown) && (
          <div
            className={clsx('data-grid__loader-line', styles.line)}
            data-leaving={(glows.leaving && !flash) || undefined}
          />
        )}
      </div>
    )
  },
)

LinearProgress.displayName = 'LinearProgress'
