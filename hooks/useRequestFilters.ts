import { useState, useMemo } from 'react'
import { Request } from '@/lib/types'
import { matchesRequestDateRange } from '@/lib/request-date-filter'
import { buildRequestCardSearchText, normalizeSearchText } from '@/lib/request-search'

interface UseRequestFiltersOptions {
  requests: Request[]
  userId: string
}

export function useRequestFilters({ requests, userId }: UseRequestFiltersOptions) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedType, setSelectedType] = useState<string>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const normalizedSearchTerm = useMemo(
    () => normalizeSearchText(searchTerm),
    [searchTerm]
  )

  const filteredRequests = useMemo(() => {
    return requests.filter((request) => {
      if (normalizedSearchTerm) {
        const searchable = normalizeSearchText(buildRequestCardSearchText(request, userId))
        if (!searchable.includes(normalizedSearchTerm)) return false
      }

      if (!matchesRequestDateRange(request.createdAt, startDate, endDate)) {
        return false
      }

      if (selectedType !== 'all' && request.type !== selectedType) {
        return false
      }

      if (statusFilter !== 'all') {
        if (statusFilter === 'pending') {
          if (request.status !== 'EN_ATTENTE_CHEF' && request.status !== 'EN_ATTENTE_RH') return false
        } else if (request.status !== statusFilter) {
          return false
        }
      }

      return true
    })
  }, [requests, normalizedSearchTerm, userId, startDate, endDate, selectedType, statusFilter])

  const stats = useMemo(() => ({
    total: requests.length,
    pending: requests.filter(r => r.status === 'EN_ATTENTE_CHEF' || r.status === 'EN_ATTENTE_RH').length,
    approved: requests.filter(r => r.status === 'APPROUVE').length,
    rejected: requests.filter(r => r.status === 'REJETE').length,
    draft: requests.filter(r => r.status === 'BROUILLON').length
  }), [requests])

  return {
    searchTerm,
    setSearchTerm,
    selectedType,
    setSelectedType,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    statusFilter,
    setStatusFilter,
    filteredRequests,
    stats
  }
}