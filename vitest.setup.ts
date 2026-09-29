import { setProjectAnnotations } from '@storybook/react-vite'
import { beforeEach } from 'vitest'

import { parkPointer } from './src/lib/stories/__tests__/pointer'

import preview from './.storybook/preview'

// Wire the Storybook preview annotations into portable stories so
// composeStories() renders them exactly as Storybook does.
setProjectAnnotations([preview])

// Указатель переживает тест и файл: где его оставил прошлый, там и hover. Паркуем в
// угол окна, чтобы проверки «скрыто до наведения» не зависели от порядка тестов.
beforeEach(parkPointer)
