/**
 * Плагины-флажки ушли из ядра и грида (ADR 0170, CH14): базы стражей слоёв без записей
 * шага 7 аудита, ядро и грид не читают опций плагинов, плагины не импортируют грид.
 * Запуск: npx vitest run --config vitest.node.config.ts flagPlugins
 */
import { describe, expect, it } from 'vitest'

import {
  CORE_PLUGIN_API,
  CORE_PLUGIN_ONLY,
  FOREIGN_OPTION_READS,
  LAYER_EDGES,
} from './architecture.baseline'
import { foreignOptionReads, layerViolations } from './layerRules'

const TYPES_TIMEOUT = 120_000
const STEP_7 = /шаг 7/

describe('плагины-флажки (ADR 0170)', () => {
  it(
    'CH14: в базах LB1, LB2 и LB5 нет записей шага 7: ядро и грид не читают опций плагинов-флажков, плагины не импортируют грид',
    () => {
      const reasons = [
        ...Object.values(LAYER_EDGES),
        ...Object.values(CORE_PLUGIN_ONLY),
        ...Object.values(CORE_PLUGIN_API),
        ...Object.values(FOREIGN_OPTION_READS),
      ]
      expect(reasons.filter(reason => STEP_7.test(reason))).toEqual([])
      expect(
        foreignOptionReads().filter(read => /^lib\/(core|grid)\//.test(read)),
      ).toEqual([])
      expect(
        layerViolations().filter(edge =>
          /lib\/plugins\/.* -> lib\/grid\//.test(edge),
        ),
      ).toEqual([])
    },
    TYPES_TIMEOUT,
  )
})
