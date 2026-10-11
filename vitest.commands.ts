// Команды браузерных тестов — один объект для Chromium, движков и мобильной эмуляции
// (ADR 0084, CB3): конфиг, переопределяющий `test`, их не теряет.
import { axTree } from './src/lib/stories/__tests__/a11y.commands'
import {
  collectGarbage,
  domCounters,
  globalListeners,
  heapUsed,
  retainingPaths,
} from './src/lib/stories/__tests__/memory.commands'
import {
  forcedColors,
  moreContrast,
  reducedMotion,
} from './src/lib/stories/__tests__/motion.commands'
import {
  heldModuleRequests,
  releaseModule,
  routeModule,
} from './src/lib/stories/__tests__/network.commands'
import {
  realDrag,
  realDragHold,
  realMouseDown,
  realMouseMove,
  realMouseUp,
  realSwipe,
  realTap,
  realTouchDown,
  realTouchMove,
  realTouchUp,
  realWheel,
} from './src/lib/stories/__tests__/pointer.commands'

// Дерево доступности Chromium через CDP (ADR 0033); настоящий drag мышью (TQ3);
// задержка и отказ загрузки модуля (ADR 0061); касания мобильной эмуляции (ADR 0084);
// память страницы через CDP (ADR 0092).
export const testCommands = {
  axTree,
  collectGarbage,
  domCounters,
  globalListeners,
  heapUsed,
  retainingPaths,
  forcedColors,
  moreContrast,
  reducedMotion,
  realDrag,
  realDragHold,
  realMouseDown,
  realMouseMove,
  realMouseUp,
  realSwipe,
  realTap,
  realTouchDown,
  realTouchMove,
  realTouchUp,
  realWheel,
  routeModule,
  releaseModule,
  heldModuleRequests,
}
