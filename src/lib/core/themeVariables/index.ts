export { type ColorMode, DATA_GRID_THEME_CLASS } from './types'

// Дефолты токенов темы подключены ДВАЖДЫ намеренно (правила идентичны, дубль
// безвреден): (1) bare-`import` ниже — для dev/Storybook/vitest, где он
// применяется надёжно, но при сборке библиотеки вырезается tree-shaking'ом;
// (2) CSS `@import` в grid/DataGrid/DataGrid.module.css — инлайнится в CSS-графе
// и гарантированно попадает в dist/style.css (bare-`import` туда не доходит).
import './theme.css'
