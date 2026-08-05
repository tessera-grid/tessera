import { useEffect, useState } from 'react'

import { faker } from '@faker-js/faker'

const today = new Date()

export const getData = (count: number) => {
  return Array.from({ length: count }).map((_, i) => {
    const sexType = faker.person.sexType()

    return {
      id: `item-id-${i}`,
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
  })
}

export const emptyData = []

export const hierarchyData = [
  {
    id: 'item-id-0',
    country: 'USA',
    firstName: 'Dave',
    lastName: 'Green',
    age: 20,
    visits: 4,
    gender: 'male',
    total: 400,
    isGroup: false,
    subRows: [
      {
        id: 'item-id-1',
        country: 'USA',
        firstName: 'Kate',
        lastName: 'Parker',
        age: 27,
        visits: 1,
        gender: 'female',
        total: 200,
      },
      {
        id: 'item-id-2',
        country: 'France',
        firstName: 'Abobu',
        lastName: 'Labubu',
        age: 34,
        visits: 2,
        gender: 'male',
        total: 400,
        subRows: [
          {
            id: 'item-id-3',
            country: 'Germany',
            firstName: 'Thomas',
            lastName: 'Herz',
            age: 35,
            visits: 5,
            gender: 'male',
            total: 1000,
          },
        ],
      },
    ],
  },
  {
    id: 'item-id-4',
    country: 'Spain',
    firstName: 'Hose',
    lastName: 'Torres',
    age: 23,
    visits: 5,
    gender: 'male',
    total: 1000,
  },
]

export const groupedData = [
  {
    id: 'item-id-0',
    country: 'USA',
    firstName: 'Dave',
    lastName: 'Green',
    age: 20,
    visits: 4,
    gender: 'male',
    total: 400,
    isGroup: true,
    subRows: [
      {
        id: 'item-id-1',
        country: 'USA',
        firstName: 'Kate',
        lastName: 'Parker',
        age: 27,
        visits: 1,
        gender: 'female',
        total: 200,
      },
    ],
  },
  {
    id: 'item-id-2',
    country: 'Germany',
    firstName: 'Manuel',
    lastName: 'Muller',
    age: 34,
    visits: 2,
    gender: 'male',
    total: 400,
    isGroup: true,
    subRows: [
      {
        id: 'item-id-3',
        country: 'Germany',
        firstName: 'Thomas',
        lastName: 'Herz',
        age: 35,
        visits: 5,
        gender: 'male',
        total: 1000,
      },
    ],
  },
  {
    id: 'item-id-4',
    country: 'Spain',
    firstName: 'Hose',
    lastName: 'Torres',
    age: 23,
    visits: 5,
    gender: 'male',
    total: 1000,
  },
]

export type DataShape = 'flat' | 'tree' | 'grouped'

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
 * Рекурсивно строит дерево subRows: `count` узлов на уровне, `breadth` детей у
 * каждого узла, `depth` уровней. Узлы с детьми помечаются `isGroup: true` — так
 * существующий предикат раскрытия (`row.original.isGroup`) даёт им тоггл.
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
      node.isGroup = true
      node.subRows = makeTree(breadth, depth - 1, breadth, id)
    }

    return node
  })

/**
 * Параметризованный генератор данных для группы `Data`. Детерминирован по
 * параметрам (`faker.seed`), чтобы демо было воспроизводимым. `grouped` отдаёт
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
  mode,
  showStub,
}: {
  count: number
  mode: 'flat' | 'hierarchy' | 'groups'
  showStub: boolean
}) => {
  const [data, setData] = useState<any[]>([])

  useEffect(() => {
    if (showStub) {
      setData([])

      return
    }

    if (mode === 'flat') {
      setData(getData(count))
    }

    if (mode === 'hierarchy') {
      setData(hierarchyData)
    }

    if (mode === 'groups') {
      setData(groupedData)
    }
  }, [count, mode, showStub])

  return { data, setData }
}
