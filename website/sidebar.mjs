// Навигация сайта (ADR 0113 §3, DC4): восемь разделов по порядку; Features делится на
// Columns, Rows, Cells, Data. Конфиг сайта и страж DC4 читают один и тот же список.

import { typeDocSidebarGroup } from 'starlight-typedoc'

/** Метка раздела API: группу заполняет `starlight-typedoc`. */
export const API_LABEL = 'API reference'

const group = (label, ru, items) => ({ label, translations: { ru }, items })

export const sidebar = [
  group('Getting started', 'Начало работы', [
    'getting-started/introduction',
    'getting-started/installation',
    'getting-started/quick-start',
    'getting-started/core-concepts',
    'getting-started/typescript',
  ]),
  group('Core', 'Ядро', ['core/overview']),
  group('Features', 'Возможности', [
    'features/columns',
    'features/rows',
    'features/cells',
    'features/data',
  ]),
  group('Customization', 'Настройка', [
    'customization/overview',
    'customization/css-variables',
    'customization/localization-keys',
    'customization/icons',
  ]),
  group('Plugin authoring', 'Свои плагины', ['plugin-authoring/overview']),
  group('Accessibility', 'Доступность', ['accessibility/overview']),
  typeDocSidebarGroup,
  group('Resources', 'Ресурсы', ['resources/overview']),
]
