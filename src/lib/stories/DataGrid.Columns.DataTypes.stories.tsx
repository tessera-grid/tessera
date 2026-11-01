import { useState } from 'react'
import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'
import type { StoryProps } from './DataGridStory.types'
import { StoryComponent } from './DataGridStory'
import { dataGridMeta } from './dataGridMeta'
import { guideNext, settle, until, waitForRows } from './__mocks__/catalogPlay'
import {
  MEDIUM_DATES,
  MONEY_TYPES,
  productColumns,
  productRows,
} from './__mocks__/dataTypesData'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { GuideStory, type GuideStoryStep, guideArgs } from './demos/GuideStory'
import { WithConsole } from './demos/StoryConsole'
import { createConsoleLog } from './demos/consoleLog'

/**
 * Типы данных колонок (ADR 0172): вид значения, выравнивание и формат по типу колонки,
 * свои типы реестром. `Playground` — все встроенные типы и свой тип «деньги»; язык и пояс
 * меняют формат денег и время.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Columns/Data types',
} satisfies Meta<StoryProps>

export default meta

const ROWS = productRows(50)
const OWN_TABLE = 'Строки и колонки задаёт раздел: по колонке на каждый тип'

export const DataTypesPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  args: {
    columnsOverride: productColumns('money'),
    dataOverride: ROWS,
    dataTypes: MONEY_TYPES,
    timeZone: 'UTC',
  },
  parameters: showControls(['locale', 'timeZone'], {
    columnCount: OWN_TABLE,
    dataCount: OWN_TABLE,
  }),
  render: function Render(args) {
    const [consoleLog] = useState(createConsoleLog)
    return (
      <WithConsole log={consoleLog} args={args}>
        <StoryComponent {...normalizeArgs(args)} />
      </WithConsole>
    )
  },
}

// --- Чтение ячеек в `play` ----------------------------------------------------------

const CELL = '.data-grid__body-cell'
const cellOf = (root: ParentNode, rowIndex: number, columnId: string) =>
  root.querySelectorAll<HTMLElement>(
    `.data-grid__body-row ${CELL}[data-column-id="${columnId}"]`,
  )[rowIndex]
const textOf = (root: ParentNode, rowIndex: number, columnId: string) =>
  cellOf(root, rowIndex, columnId)?.textContent?.trim()

const localeOf = (args: StoryProps) =>
  args.locale === 'ru' ? 'ru-RU' : 'en-US'

// --- S3: свой тип «деньги» ------------------------------------------------------------

const CUSTOM_TYPE: readonly GuideStoryStep[] = [
  {
    title: 'Цена — обычное число',
    hint: 'Приложение показывает цену как число без единиц. Значения выровнены по правому краю, цифры стоят друг под другом.',
    props: () => ({
      columnsOverride: productColumns('number'),
      dataOverride: ROWS,
      timeZone: 'UTC',
    }),
  },
  {
    title: 'Свой тип «деньги»',
    hint: 'Приложение описало свой тип для денег и назначило его колонке цены. Цена показана в долларах со знаком валюты и двумя знаками после запятой, выравнивание по правому краю сохранилось.',
    props: () => ({
      columnsOverride: productColumns('money'),
      dataTypes: MONEY_TYPES,
    }),
  },
]

/** ADR 0172, S3: разработчик задаёт свой тип «деньги» — валюта и выравнивание вправо. */
export const DataTypesCustomType: StoryObj<StoryProps> = {
  name: 'Custom type',
  parameters: { scenario: '0172/S3', ...guideControls() },
  render: args => (
    <GuideStory
      title="Свой тип данных"
      steps={CUSTOM_TYPE}
      args={guideArgs({ dataCount: 20, height: '360' }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, args, step }) => {
    if (globals.catalog !== true) return
    const price = ROWS[0]!.price
    await step(CUSTOM_TYPE[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(textOf(canvas, 0, 'price')).toBe(String(price)))
      await expect(cellOf(canvas, 0, 'price')!.dataset.align).toBe('end')
    })
    await step(CUSTOM_TYPE[1]!.title, async () => {
      await guideNext(canvas)
      const money = new Intl.NumberFormat(localeOf(args), {
        style: 'currency',
        currency: 'USD',
      }).format(price)
      await until(() => expect(textOf(canvas, 0, 'price')).toBe(money))
      await expect(cellOf(canvas, 0, 'price')!.dataset.align).toBe('end')
      await settle()
    })
  },
}

// --- S4: вид всех дат в одном месте ---------------------------------------------------

const OVERRIDE_BUILT_IN: readonly GuideStoryStep[] = [
  {
    title: 'Даты по умолчанию',
    hint: 'Даты показаны в нейтральном виде: год, месяц и день, у даты со временем — ещё часы и минуты.',
    props: () => ({
      columnsOverride: productColumns(),
      dataOverride: ROWS,
      timeZone: 'UTC',
    }),
  },
  {
    title: 'Вид дат сменился во всей таблице',
    hint: 'Приложение в одном месте задало новый вид для встроенных типов дат. Обе колонки с датами показывают месяц словом, а дата со временем — ещё и время, хотя сами колонки не менялись.',
    props: () => ({ dataTypes: MEDIUM_DATES }),
  },
]

/** ADR 0172, S4: разработчик меняет вид всех дат таблицы в одном месте. */
export const DataTypesOverrideBuiltIn: StoryObj<StoryProps> = {
  name: 'Override built-in type',
  parameters: { scenario: '0172/S4', ...guideControls() },
  render: args => (
    <GuideStory
      title="Вид встроенного типа"
      steps={OVERRIDE_BUILT_IN}
      args={guideArgs({ dataCount: 20, height: '360' }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, args, step }) => {
    if (globals.catalog !== true) return
    const { released, updatedAt } = ROWS[0]!
    await step(OVERRIDE_BUILT_IN[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(textOf(canvas, 0, 'released')).toBe(released))
      await expect(textOf(canvas, 0, 'updatedAt')).toBe(
        `${updatedAt.slice(0, 10)} ${updatedAt.slice(11, 16)}`,
      )
    })
    await step(OVERRIDE_BUILT_IN[1]!.title, async () => {
      await guideNext(canvas)
      const locale = localeOf(args)
      const day = new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeZone: 'UTC',
      }).format(new Date(`${released}T00:00:00Z`))
      const moment = new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'UTC',
      }).format(new Date(updatedAt))
      await until(() => expect(textOf(canvas, 0, 'released')).toBe(day))
      await expect(textOf(canvas, 0, 'updatedAt')).toBe(moment)
      await settle()
    })
  },
}
