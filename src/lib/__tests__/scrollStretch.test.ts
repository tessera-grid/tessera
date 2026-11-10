/**
 * Растяжка высоты (ADR 0142, XS10): вертикальную прокрутку грида библиотека читает и пишет
 * через слой координат — прямой `scrollTop` только в модулях списка стража с причиной.
 * Запуск: npx vitest run --config vitest.node.config.ts scrollStretch
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

import { describe, expect, it } from 'vitest'

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      return ['__tests__', 'stories', '__mocks__'].includes(name)
        ? []
        : sourceFiles(path)
    }
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })

/** Прямая вертикальная прокрутка: `scrollTop` или `scrollTo`/`scrollBy` элемента. */
const DIRECT =
  /\.scrollTop\b|'scrollTop'|(?<!layer\(\w+\)|layer)\.scroll(?:To|By)\(/

/**
 * Кто трогает `scrollTop` мимо слоя и почему. Список только сокращается: модуль,
 * переведённый на слой, уходит из списка.
 */
const DIRECT_SCROLL: Record<string, string> = {
  'core/scrollStretch.ts':
    'сам слой: виртуальная позиция и физический scrollTop',
  'core/scrollHeightLimit.ts':
    'пробник предела липкости прокручивает свою скрытую область',
  'core/stickyGeometry.ts':
    'сдвиг на пиксель и обратно в одной задаче: событие scroll видит прежний scrollTop',
  'core/fastScroll/fastScrollDetector.ts':
    'читает scrollTop источника — фасада слоя, а не элемента',
  'grid/rowMotion/RowMotion.tsx':
    'сдвиг физического scrollTop — признак «прокрутка была», движение отменяется',
  'grid/columnMotion/ColumnMotion.tsx':
    'сдвиг физического scrollTop — признак «прокрутка была», движение отменяется',
  'plugins/contextMenu/ContextMenu.tsx':
    'смена физической прокрутки — ключ закрытия меню, виртуальная позиция не нужна',
  'grid/useSkeletonWave.ts':
    'фаза волны — в координатах DOM-содержимого рядом с getBoundingClientRect: нужна физическая прокрутка',
  'grid/ScrollingAttribute.ts':
    'сдвиг физического scrollTop — признак идущей прокрутки',
  'plugins/backToTop/model.ts':
    'читает scrollTop области — фасада слоя, а не элемента',
  'plugins/infiniteScroll/loader.ts':
    'scrollTop геометрии края — виртуальная позиция из слоя',
  'ui/Popup/centerSelected.ts':
    'список поповера — колонки времени и год календаря — ставит выбранное значение в середину — это не прокрутка грида',
}

describe('Растяжка высоты', () => {
  it('XS10: вертикальную прокрутку грида читают и пишут через слой координат — прямой scrollTop в src/lib вне слоя только по списку стража с причиной, список только сокращается', () => {
    const root = join(__dirname, '..')
    const direct = sourceFiles(root)
      .filter(file =>
        readFileSync(file, 'utf8')
          .split('\n')
          .some(line => DIRECT.test(line) && !line.includes('scrollLayer(')),
      )
      .map(file => relative(root, file).replace(/\\/g, '/'))
      .sort()
    const unlisted = direct.filter(file => !(file in DIRECT_SCROLL))
    const stale = Object.keys(DIRECT_SCROLL).filter(
      file => !direct.includes(file),
    )
    expect({ unlisted, stale }).toEqual({ unlisted: [], stale: [] })
    for (const reason of Object.values(DIRECT_SCROLL)) {
      expect(reason.length).toBeGreaterThan(10)
    }
  })
})
