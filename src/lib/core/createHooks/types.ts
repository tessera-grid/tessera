/**
 * Пустой контракт хуков ядра (types-mode b, ADR 0010). Ядро больше НЕ агрегирует
 * слайсы встроенных плагинов и не импортит их — тип хуков таблицы выводится из
 * набора `plugins` (`InferPluginHooks`) в сигнатуре `useCreateTable`. Именованный
 * union встроенных слайсов доступен как `BuiltinPluginsHooks` из входа
 * `@mstrvtt/tessera/plugins` (для вызовов с явными дженериками, где вывод из
 * кортежа не срабатывает).
 */
export type PluginsHooks = Record<never, never>
