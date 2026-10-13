/**
 * Демо прокрутки к строке (ADR 0104): поле id, выравнивание, колонка, раскрытие предков
 * и плавность — `table.scrollToRow`; итог вызова — в строке состояния.
 */
import { useMemo, useState } from 'react'

import { definePlugin } from '../../core/definePlugin'
import type {
  ScrollAlign,
  ScrollToRowOptions,
} from '../../core/scrollToRow/scrollToRowFeature'
import { StoryComponent } from '../DataGridStory'
import type { StoryProps } from '../DataGridStory.types'
import { getData } from '../__mocks__/data'
import {
  DemoButton,
  DemoInput,
  DemoItem,
  DemoNote,
  DemoPanel,
} from './DemoPanel'

interface ScrollApi {
  scrollToRow: (rowId: string, options?: ScrollToRowOptions) => Promise<boolean>
}

/** Отдаёт таблицу кнопкам демо над гридом. */
const scrollToRowDemo = definePlugin<{
  enabled?: boolean
  onTable: (table: ScrollApi | null) => void
}>()({
  id: 'scrollToRowDemo',
  setup: o => table => {
    o.onTable(table as unknown as ScrollApi)
    return () => o.onTable(null)
  },
})

const ALIGNS: ScrollAlign[] = ['auto', 'start', 'center', 'end']

export const ScrollToRowDemo = (args: StoryProps) => {
  const data = useMemo(() => getData(300, 'nested'), [])
  const [table, setTable] = useState<ScrollApi | null>(null)
  const [rowId, setRowId] = useState('item-id-250')
  const [align, setAlign] = useState<ScrollAlign>('auto')
  const [toColumn, setToColumn] = useState(false)
  const [expandParents, setExpandParents] = useState(true)
  const [smooth, setSmooth] = useState(false)
  const [result, setResult] = useState<string>('')

  const plugins = useMemo(() => [scrollToRowDemo({ onTable: setTable })], [])

  const scroll = async () => {
    if (!table) return
    setResult('Прокручиваю…')
    const shown = await table.scrollToRow(rowId.trim(), {
      align,
      columnId: toColumn ? 'total' : undefined,
      expandParents,
      behavior: smooth ? 'smooth' : 'instant',
    })
    setResult(
      shown ? `Строка ${rowId} на месте` : `Строку ${rowId} показать нельзя`,
    )
  }

  return (
    <div>
      <DemoPanel status={result && <DemoNote>{result}</DemoNote>}>
        <DemoItem
          title="Строка"
          hint="Id строки: item-id-250 — корень на другом краю, item-id-90-0-0 — внук свёрнутой строки, missing — нет такой."
        >
          <DemoInput
            aria-label="Id строки"
            value={rowId}
            onChange={event => setRowId(event.target.value)}
          />
          <DemoButton onClick={() => void scroll()}>Прокрутить</DemoButton>
        </DemoItem>
        <DemoItem
          title="Выравнивание"
          hint="auto не двигает видимую строку; start, center, end — к краю или центру окна тела."
        >
          {ALIGNS.map(value => (
            <DemoButton
              key={value}
              pressed={align === value}
              onClick={() => setAlign(value)}
            >
              {value}
            </DemoButton>
          ))}
        </DemoItem>
        <DemoItem
          title="Опции"
          hint="Колонка Total — ещё и горизонталь; раскрытие предков — для строк в свёрнутых родителях; плавно — анимация вместо прыжка."
        >
          <DemoButton pressed={toColumn} onClick={() => setToColumn(!toColumn)}>
            К колонке Total
          </DemoButton>
          <DemoButton
            pressed={expandParents}
            onClick={() => setExpandParents(!expandParents)}
          >
            Раскрыть предков
          </DemoButton>
          <DemoButton pressed={smooth} onClick={() => setSmooth(!smooth)}>
            Плавно
          </DemoButton>
        </DemoItem>
        {result && (
          <DemoItem
            title="Итог"
            hint="true — строка смонтирована и стоит на месте, false — показать нельзя."
          >
            <DemoNote>
              <span data-testid="scroll-result">{result}</span>
            </DemoNote>
          </DemoItem>
        )}
      </DemoPanel>
      <StoryComponent {...args} dataOverride={data} extraPlugins={plugins} />
    </div>
  )
}
