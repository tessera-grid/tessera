import type { CSSProperties } from 'react'

import { RadioGroup } from '@base-ui/react/radio-group'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import '../../../ui/theme/theme.css'
import { DATA_GRID_THEME_CLASS } from '../../../ui/theme'
import { Radio } from '../../../ui/Radio/Radio'

// Радио кита (ADR 0183, PK24).

const Harness = ({ style }: { style?: CSSProperties }) => (
  <div className={DATA_GRID_THEME_CLASS} style={style}>
    <RadioGroup defaultValue="a" aria-label="Choice">
      <Radio value="a" data-testid="radio" />
    </RadioGroup>
  </div>
)

const radio = () => document.querySelector<HTMLElement>('[data-testid="radio"]')
const dotOf = () => radio()?.querySelector('[data-radio-dot]')
const box = (el: Element) => {
  const { width, height } = el.getBoundingClientRect()
  return [width, height]
}

describe('Радио кита', () => {
  test('PK24: размер и форма радио — токены --tsr-comp-radio-*: по умолчанию кружок размером флажка, точка вполовину и той же формы', async () => {
    const plain = await render(<Harness />)
    await expect.poll(() => dotOf()).toBeTruthy()
    expect(box(radio()!)).toEqual([16, 16])
    expect(getComputedStyle(radio()!).borderTopLeftRadius).toBe('50%')
    await plain.unmount()

    const themed = await render(
      <Harness
        style={
          {
            '--tsr-comp-radio-size': '24px',
            '--tsr-comp-radio-radius': '4px',
          } as CSSProperties
        }
      />,
    )
    await expect.poll(() => dotOf()).toBeTruthy()
    const dot = dotOf()!
    expect(box(radio()!)).toEqual([24, 24])
    expect(getComputedStyle(radio()!).borderTopLeftRadius).toBe('4px')
    expect(box(dot)).toEqual([12, 12])
    expect(getComputedStyle(dot).borderTopLeftRadius).toBe('4px')
    await themed.unmount()
  })
})
