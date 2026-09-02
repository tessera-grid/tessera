// Публичный вход композиции плагинов (ADR 0010): фабрики встроенных плагинов как
// примитивы presence-based композиции.
//
//   import { rowSelection, columnSorting } from '@mstrvtt/tessera/plugins'
//   useCreateTable({ columns, data, plugins: [rowSelection(), columnSorting()] })
export * from './lib/plugins'
