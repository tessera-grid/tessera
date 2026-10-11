import { describe, test } from 'vitest'

import { IconButton } from '../../../ui/IconButton'
import {
  expectCollected,
  frames,
  mount,
  track,
  type Mounted,
  type Tracked,
} from '../memory.helpers'

// Обработчики прошлых рендеров (ADR 0092, LK15): стабильный колбэк кнопки не держит
// контекст рендера, в котором создан, а с ним — `onClick` и то, что тот замкнул.

const Host = ({ marker }: { marker: object }) => (
  <IconButton aria-label="probe" onClick={() => void marker}>
    x
  </IconButton>
)

// Элементы создаются в отдельных функциях: кадр асинхронного теста держал бы их.
const mountHost = (markers: Tracked[]) => {
  const marker = {}
  markers.push(track('обработчик 0', marker))
  return mount(<Host marker={marker} />)
}

const renderHost = (mounted: Mounted, markers: Tracked[], index: number) => {
  const marker = {}
  markers.push(track(`обработчик ${index}`, marker))
  mounted.render(<Host marker={marker} />)
}

describe('Обработчики прошлых рендеров', () => {
  test('LK15: IconButton после перерисовок с новым onClick не держит обработчики прошлых рендеров — то, что замкнул onClick первого рендера, собрано', async () => {
    const markers: Tracked[] = []
    const mounted = mountHost(markers)
    try {
      for (let i = 1; i <= 6; i++) {
        renderHost(mounted, markers, i)
        await frames()
      }
      // Два буфера fiber держат пропсы двух последних отрисовок.
      await expectCollected(markers.slice(0, -2))
    } finally {
      mounted.unmount()
    }
  })
})
