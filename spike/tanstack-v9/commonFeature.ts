/**
 * СПАЙК v9 — порт среза `commonPlugin` ([src/lib/core/commonPlugin.ts]) как
 * кастомной фичи v9.
 *
 * Отвечает на открытые вопросы плана:
 *  - Q5 «судьба <TData,THooks,TState,TOptions>»: наши `hooks`/`slots` перестают быть
 *    глобальными дженериками таблицы — они становятся ОПЦИЯМИ фичи
 *    (`TableOptions_FeatureMap`) и её ПУБЛИЧНЫМИ API (`Table_FeatureMap`).
 *    `getHooks()`/`getRenderSlots()` читают их из `table.options`, как и раньше.
 *  - Q1 «render→columnDef vs FlexRender»: в v9 есть нативный `flexRender`/
 *    `table.FlexRender`, поэтому наш самописный механизм `render`→`columnDef` в
 *    `createHeader/createCell` можно выкинуть. Здесь он намеренно НЕ портируется.
 *
 * Идиома взята из официального custom-features SKILL.md, который едет в пакете
 * (`@tanstack/table-core/skills/custom-features/SKILL.md`, v9.2.4).
 */
import {
  assignPrototypeAPIs,
  assignTableAPIs,
  type RowData,
  type TableFeature,
  type TableFeatures,
} from '@tanstack/table-v9'

// --- Доменные типы фичи (урезанный срез commonPlugin) ------------------------

/** Плейсхолдеры под реальные контракты Tessera (THooks/slots). */
export type CommonHooks = Record<string, unknown>
export type CommonSlots = Record<string, unknown>

interface CommonOptions {
  /** Бизнес-контракт хуков (бывш. дженерик THooks, опция `hooks`). */
  hooks?: CommonHooks
  /** Декларативные слоты (бывш. кастомная опция `slots`). */
  slots?: CommonSlots
}

interface CommonTableAPI {
  getHooks: () => CommonHooks | undefined
  getRenderSlots: () => CommonSlots | undefined
}

interface CommonRowAPI {
  /** Бывш. `row.getIsFirstRow()` из commonPlugin (на прототипе, через `this`). */
  getIsFirstRow: () => boolean
}

// --- Declaration merging в feature-карты v9 ----------------------------------
// Вместо прямого расширения Table/Row (как в v8 src/table.d.ts) — регистрация в
// *_FeatureMap. Ключ карты совпадает с ключом фичи в `tableFeatures({...})`.
declare module '@tanstack/table-v9' {
  interface Plugins {
    commonFeature: TableFeature
  }
  interface TableOptions_FeatureMap<
    TFeatures extends TableFeatures,
    TData extends RowData,
  > {
    commonFeature: CommonOptions
  }
  interface Table_FeatureMap<
    TFeatures extends TableFeatures,
    TData extends RowData,
  > {
    commonFeature: CommonTableAPI
  }
  interface Row_FeatureMap<
    TFeatures extends TableFeatures,
    TData extends RowData,
  > {
    commonFeature: CommonRowAPI
  }
}

// --- Реализация фичи ---------------------------------------------------------
export const commonFeature: TableFeature = {
  constructTableAPIs: table => {
    assignTableAPIs('commonFeature', table, {
      table_getHooks: {
        fn: () => (table.options as CommonOptions).hooks,
      },
      table_getRenderSlots: {
        fn: () => (table.options as CommonOptions).slots,
      },
    })
  },

  assignRowPrototype: (prototype, table) => {
    assignPrototypeAPIs('commonFeature', prototype, table, {
      // Прототипный метод получает текущий объект первым аргументом (см. SKILL.md).
      row_getIsFirstRow: {
        fn: (row: { id: string; table: typeof table }) =>
          row.table.getRowModel().rows[0]?.id === row.id,
      },
    })
  },
}
