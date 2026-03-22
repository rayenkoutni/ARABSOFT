const requestDateTimeFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export function formatRequestDateTime(value: string | Date) {
  return requestDateTimeFormatter.format(new Date(value))
}
