// Контракт плагинов живёт в ядре (core/pluginContract) — ADR 0010: ядро
// определяет, что такое плагин, плагины его реализуют. Этот модуль реэкспортит
// контракт для обратной совместимости (плагины импортят из '../types', публичный
// API — из этого пути).
export type {
  TablePlugin,
  ServiceColumn,
  RegistryEntry,
  PluginOptions,
  HeaderComponentProps,
  CellComponentProps,
} from '../core/pluginContract'
