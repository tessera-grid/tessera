import { useEffect, useState } from 'react'

import { faker } from '@faker-js/faker'

const today = new Date()

export type DataShape = 'flat' | 'tree' | 'grouped'
/** Вложенность мока историй: `nested` — дети у каждой 10-й строки верхнего уровня. */
export type DataNesting = 'flat' | 'nested'

const makeRow = (id: string) => {
  const sexType = faker.person.sexType()

  return {
    id,
    country: faker.location.country(),
    firstName: faker.person.firstName(sexType),
    lastName: faker.person.lastName(sexType),
    age:
      today.getFullYear() -
      faker.date.birthdate({ min: 18, max: 45, mode: 'age' }).getFullYear(),
    visits: faker.number.int({ min: 0, max: 20 }),
    gender: sexType,
    total: faker.number.int({ min: 200, max: 1000 }),
  }
}

/**
 * Мок историй и тестов: `count` строк верхнего уровня. `nested` — у каждой 10-й
 * дети, у каждой 30-й — трое детей, и у первого из них свой ребёнок; пока раскрытие
 * выключено, видны только строки верхнего уровня. По умолчанию — плоский: дерево
 * задаётся явно там, где оно предмет истории или теста.
 */
export const getData = (count: number, nesting: DataNesting = 'flat') => {
  // Сид от объёма: данные истории не зависят от того, что генерировалось до неё.
  faker.seed(count)
  const rows: any[] = Array.from({ length: count }).map((_, i) =>
    makeRow(`item-id-${i}`),
  )

  if (nesting === 'flat') return rows

  // Дети — после всех корней: значения корней не зависят от вложенности.
  rows.forEach((row, i) => {
    if (i % 10 !== 0) return

    row.subRows = Array.from({ length: i % 30 === 0 ? 3 : 2 }).map((_, j) =>
      makeRow(`${row.id}-${j}`),
    )

    if (i % 30 === 0) {
      row.subRows[0].subRows = [makeRow(`${row.id}-0-0`)]
    }
  })

  return rows
}

/**
 * Рекурсивно строит дерево subRows: `count` узлов на уровне, `breadth` детей у
 * каждого узла, `depth` уровней.
 */
const makeTree = (
  count: number,
  depth: number,
  breadth: number,
  prefix = 'node',
): any[] =>
  Array.from({ length: count }).map((_, i) => {
    const id = `${prefix}-${i}`
    const node: any = makeRow(id)

    if (depth > 1) {
      node.subRows = makeTree(breadth, depth - 1, breadth, id)
    }

    return node
  })

/**
 * Данные заданной формы — для сценариев, которым важна сама форма (группа `Data`,
 * глубокое дерево, строки без детей). Детерминирован по параметрам
 * (`faker.seed`), чтобы демо было воспроизводимым. `grouped` отдаёт
 * плоские строки — саму группировку/агрегацию применяет история через
 * `enableGrouping` + `initialGrouping` (механизм TanStack).
 */
export const makeData = ({
  shape,
  count,
  depth = 3,
  breadth = 3,
}: {
  shape: DataShape
  count: number
  depth?: number
  breadth?: number
}) => {
  faker.seed(count * 1000 + depth * 100 + breadth * 10 + shape.length)

  if (shape === 'tree') {
    return makeTree(count, depth, breadth)
  }

  return Array.from({ length: count }).map((_, i) => makeRow(`row-${i}`))
}

export const useData = ({
  count,
  nesting = 'flat',
  showStub,
  skip = false,
}: {
  count: number
  nesting?: DataNesting
  showStub: boolean
  /** Данные пришли извне — не генерировать. */
  skip?: boolean
}) => {
  const [data, setData] = useState<any[]>([])

  // Данные приходят после монтирования, как с сервера: истории и замеры смены скелета
  // на данные опираются на этот первый пустой рендер.
  useEffect(() => {
    if (skip) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- мок внешнего источника данных
    setData(showStub ? [] : getData(count, nesting))
  }, [count, nesting, showStub, skip])

  return { data, setData }
}
