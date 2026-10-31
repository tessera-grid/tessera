/**
 * Снимок контракта (ADR 0163, §6): каждый ключ — с номером ADR, откуда он. Новое поле
 * контракта появляется только вместе со строкой здесь.
 */

/** Свои поля описания колонки — записи фич Tessera в `ColumnDef_FeatureMap`. */
export const COLUMN_DEF_FIELDS: Record<string, string> = {
  dataType: '0139',
  enableDragging: '0006',
  filter: '0045',
  getOptionLabel: '0048',
  options: '0048',
  parseValue: '0139',
  pinSides: '0165',
  skeletonCell: '0060',
}

/** Опции ядра `CommonOptions`. */
export const CORE_OPTIONS: Record<string, string> = {
  actionMenu: '0024',
  appendOnlyData: '0145',
  contextMenuActions: '0030',
  enableAnnouncements: '0032',
  enableColumnAnimation: '0115',
  enableFooter: '0106',
  enableOverflowTooltip: '0075',
  enableRowAnimation: '0107',
  enableStatusBar: '0046',
  enableToolbar: '0046',
  footerPosition: '0118',
  getBodyBusy: '0081',
  getRowSource: '0138',
  getTotalRowCount: '0081',
  headerHeight: '0077',
  hooks: '0027',
  keyboardActions: '0021',
  loadError: '0096',
  loading: '0106',
  logLevel: '0022',
  onColumnAutoSizingChange: '0010',
  onDebugAction: '0125',
  onRetry: '0096',
  partialData: '0081',
  pluginDiagnostics: '0022',
  pluginRenderVersion: '0039',
  pluginStateListeners: '0028',
  pluginWrappers: '0168',
  refreshNarrowing: '0160',
  refreshOptions: '0094',
  rowHeight: '0077',
  skeletonOptions: '0060',
  slotActions: '0024',
  slots: '0010',
  stubEntries: '0123',
}

/** Поля публичной записи плагина `TablePlugin` (ADR 0164, §3). */
export const PLUGIN_ENTRY_FIELDS: Record<string, string> = {
  actionMenu: '0024',
  column: '0010',
  contextMenuActions: '0030',
  diagnose: '0022',
  enabled: '0010',
  features: '0010',
  hooks: '0027',
  id: '0010',
  keyboardActions: '0021',
  model: '0120',
  narrow: '0039',
  options: '0010',
  reconcile: '0040',
  setup: '0010',
  slotActions: '0024',
  slots: '0010',
  stubs: '0123',
}

/** Поля внутренней записи `TesseraFeatureEntry`, которые ставят ядро и `definePlugin`. */
export const INTERNAL_ENTRY_FIELDS: Record<string, string> = {
  args: '0039',
  argsKey: '0039',
  configure: '0039',
  controlledState: '0028',
  includedBy: '0120',
  inertReason: '0039',
  lifetimeArgs: '0039',
  refreshArgs: '0039',
  stateSlices: '0120',
  wrappers: '0168',
}
