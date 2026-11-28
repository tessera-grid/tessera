// Справочник API (ADR 0113 §5, DC7): один конфиг TypeDoc для сборки сайта
// (`starlight-typedoc`) и строгой проверки `docs:api` — предупреждение роняет сборку.

/** Типы внутри публичных сигнатур, которые намеренно не экспортируются, — с причиной. */
const INTERNAL = {
  // Фичи ядра в карте `TesseraFeatures`: устройство сборки, не API (ADR 0164).
  actionStatusFeature: 'core feature map',
  commonFeature: 'core feature map',
  draftsFeature: 'core feature map',
  failuresFeature: 'core feature map',
  flashFeature: 'core feature map',
  highlightFeature: 'core feature map',
  scrollToRowFeature: 'core feature map',
  serverActionFeature: 'core feature map',
  MergeFeatures: 'core feature map',
  // Запись плагина — служебная форма; автор пишет `TablePlugin` (ADR 0164, CK3).
  TesseraFeatureEntry: 'internal plugin entry',
  // Внутренности фич моделей строк в типе возврата фабрик.
  OwnSlot: 'row engine stage',
  SortColumn: 'sorting feature internals',
  TypedSortColumn: 'sorting feature internals',
  GroupingColumn: 'grouping feature internals',
  // Значения форматов выгрузки: публичный вход — `exportFormats`.
  csvFormat: 'reached through exportFormats',
  xlsxFormat: 'reached through exportFormats',
  // Служебные типы-вычисления словаря и опций.
  CountKey: 'dictionary type helper',
  LabelKey: 'dictionary type helper',
  PluralForm: 'dictionary type helper',
  FunctionKeys: 'dictionary type helper',
  RowIdParams: 'useCreateTable params helper',
  CountKeysOf: 'dictionary type helper',
  UnionToIntersection: 'dictionary type helper',
  Owner: 'dictionary type helper',
  SlotDeclOf: 'definePlugin type helper',
  // Ключ строки виртуализатора — тип вендора TanStack Virtual (ADR 0143).
  Key: 'vendored TanStack Virtual type',
}

export default {
  entryPoints: ['../src/index.ts', '../src/plugins.ts', '../src/ui.ts'],
  tsconfig: '../tsconfig.json',
  excludePrivate: true,
  excludeInternal: true,
  excludeExternals: true,
  readme: 'none',
  intentionallyNotExported: Object.keys(INTERNAL),
  validation: {
    notExported: true,
    invalidLink: true,
    rewrittenLink: true,
    notDocumented: false,
    unusedMergeModuleWith: true,
  },
}
