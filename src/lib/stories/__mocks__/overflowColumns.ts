// Мок истории «Overflow tooltip» (ADR 0075): узкие колонки, длинный и короткий текст.
const SHORT_NAMES = ['Ann', 'Bob', 'Eve', 'Ida', 'Max']

export const overflowColumns = [
  { id: 'name', accessorKey: 'name', header: 'Name', size: 160 },
  {
    id: 'company',
    accessorKey: 'company',
    header: 'Company registered name',
    footer: 'Companies registered in total',
    size: 160,
  },
  { id: 'city', accessorKey: 'city', header: 'City', size: 160 },
]

export const overflowData = Array.from({ length: 40 }, (_, index) => ({
  id: `person-${index}`,
  name:
    index === 0
      ? 'Bartholomew Montgomery-Fitzgerald'
      : SHORT_NAMES[index % SHORT_NAMES.length],
  company:
    index % 2 === 0
      ? `Northern Lights Logistics Holding ${index}`
      : `Acme ${index}`,
  // Помещается в колонку, но обрезается, когда появляется кнопка ячейки (OT3).
  city: index % 2 === 0 ? 'Saint Petersburg' : 'Oslo',
}))
