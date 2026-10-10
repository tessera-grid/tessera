// Типы doiuse лежат в пакете, но не указаны в его `exports` — подключаем их явно.
declare module 'doiuse' {
  export { default } from '../node_modules/doiuse/types/exports/index'
}
