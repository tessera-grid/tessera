import { setProjectAnnotations } from '@storybook/react-vite'
import { beforeEach } from 'vitest'
import { configure } from 'vitest-browser-react/pure'

import { parkPointer } from './src/lib/stories/__tests__/pointer'

import preview from './.storybook/preview'

// Wire the Storybook preview annotations into portable stories so
// composeStories() renders them exactly as Storybook does.
setProjectAnnotations([preview])

// Указатель переживает тест и файл: где его оставил прошлый, там и hover. Паркуем в
// угол окна, чтобы проверки «скрыто до наведения» не зависели от порядка тестов.
beforeEach(parkPointer)

// StrictMode по умолчанию (ADR 0091, EV3): эффекты и рендер запускаются дважды, как в
// разработке у потребителя. В перф-прогоне React продовый — там StrictMode ничего не делает.
configure({ reactStrictMode: true })
