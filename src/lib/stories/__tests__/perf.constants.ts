// Чистые перф-константы без импортов — безопасны и в браузерном коде (тесты,
// helpers), и в Node-командах (perf.commands). Пороги абсолютные, из моделей
// восприятия RAIL / Core Web Vitals, а не измеренные.

/** Бюджет кадра 60fps, мс (RAIL Animation). */
export const FRAME_BUDGET_60FPS = 1000 / 60

/** RAIL Animation: p95 работы на кадр при прокрутке ≤ бюджету 60fps. */
export const ANIMATION_BUDGET_MS = FRAME_BUDGET_60FPS

/** RAIL Load: первая отрисовка до интерактивности ≤ 1000мс. */
export const LOAD_BUDGET_MS = 1000

/** Длинная задача (RAIL/CWV): > 50мс блокирует поток; основа TBT и готовности к INP. */
export const LONG_TASK_MS = 50

/**
 * Бюджет отзывчивости на взаимодействие (INP), RAIL Response: приложение отвечает на
 * ввод в пределах 100мс, чтобы ощущаться мгновенным (CWV INP «good» ≤200мс — ещё
 * мягче). Синхронная задача обработчик→рендер→коммит не должна превышать бюджет.
 */
export const INTERACTION_BUDGET_MS = 100

/**
 * ×4 CPU-троттлинг (стиль Lighthouse) во время замера: пороги RAIL/CWV заданы под
 * средний девайс, а не под быструю dev-машину.
 */
export const CPU_THROTTLE_RATE = 4
