// Публичный вход композиции плагинов: фабрики встроенных плагинов как
// примитивы presence-based композиции.
//
//   import { rowSelection, columnSorting } from '@mstrvtt/tessera/plugins'
//   useCreateTable({ columns, data, plugins: [rowSelection(), columnSorting()] })
export * from './lib/plugins'
