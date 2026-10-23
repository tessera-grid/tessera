import { createContext, useContext } from 'react'

import type { TableLabels } from './labels'
import { ENGLISH_LABELS } from './resolveLabels'

/** Подписи смонтированной таблицы: умолчания или разрешённый словарь приложения. */
export const LocalizationContext = createContext<TableLabels>(ENGLISH_LABELS)

/**
 * Возвращает текущие подписи (дефолтные или переопределённые через DataGrid).
 */
export const useLocalization = (): TableLabels =>
  useContext(LocalizationContext)
