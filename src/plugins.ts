// Публичный вход композиции плагинов: фабрики встроенных плагинов как
// примитивы presence-based композиции.
//
//   import { rowSelection, columnSorting } from '@tessera-grid/tessera/plugins'
//   useCreateTable({ columns, data, plugins: [rowSelection(), columnSorting()] })
export * from './lib/plugins'
