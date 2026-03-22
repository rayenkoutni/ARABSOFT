export function matchesRequestDateRange(
  timestamp: string,
  startDate: string,
  endDate: string,
) {
  if (!startDate && !endDate) {
    return true
  }

  const value = new Date(timestamp)

  if (Number.isNaN(value.getTime())) {
    return false
  }

  if (startDate) {
    const start = new Date(`${startDate}T00:00:00`)

    if (value < start) {
      return false
    }
  }

  if (endDate) {
    const end = new Date(`${endDate}T23:59:59.999`)

    if (value > end) {
      return false
    }
  }

  return true
}
