'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Search, X } from 'lucide-react'
import { RequestCard } from '@/components/request-card'
import { RequestDetailsSummary } from '@/components/request-details-summary'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BrandedLoading } from '@/components/ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/lib'
import { requestService } from '@/lib'
import { matchesRequestDateRange } from '@/lib/request-date-filter'
import { buildRequestCardSearchText, normalizeSearchText } from '@/lib/request-search'
import { requestTypeLabels } from '@/lib/request-type'
import { Request } from '@/lib/types'

export default function MyRequestsPage() {
  const { user } = useAuth()
  const [requests, setRequests] = useState<Request[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTab, setSelectedTab] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedType, setSelectedType] = useState<string>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null)

  useEffect(() => {
    const loadRequests = async () => {
      if (!user) return

      try {
        setIsLoading(true)
        const data = await requestService.getUserRequests(user.id)
        setRequests(data)
      } finally {
        setIsLoading(false)
      }
    }

    loadRequests()
  }, [user])

  if (!user) return null

  const normalizedSearchTerm = normalizeSearchText(searchTerm)
  const availableTypes = Array.from(new Set(requests.map((request) => request.type)))

  const searchedRequests = requests.filter((request) => {
    const searchable = normalizeSearchText(buildRequestCardSearchText(request, user.id))
    return normalizedSearchTerm === '' || searchable.includes(normalizedSearchTerm)
  })

  const filteredRequests = searchedRequests.filter((request) => {
    if (!matchesRequestDateRange(request.createdAt, startDate, endDate)) {
      return false
    }

    if (selectedType !== 'all' && request.type !== selectedType) {
      return false
    }

    if (selectedTab === 'pending') {
      return request.status === 'EN_ATTENTE_CHEF' || request.status === 'EN_ATTENTE_RH'
    }

    if (selectedTab === 'draft') {
      return request.status === 'BROUILLON'
    }

    if (selectedTab === 'approved') {
      return request.status === 'APPROUVE'
    }

    if (selectedTab === 'rejected') {
      return request.status === 'REJETE'
    }

    return true
  })

  const pendingCount = searchedRequests.filter((request) => request.status === 'EN_ATTENTE_CHEF' || request.status === 'EN_ATTENTE_RH').length
  const draftCount = searchedRequests.filter((request) => request.status === 'BROUILLON').length
  const approvedCount = searchedRequests.filter((request) => request.status === 'APPROUVE').length
  const rejectedCount = searchedRequests.filter((request) => request.status === 'REJETE').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ fontSize: '22px', fontWeight: 600, color: 'var(--color-text)' }}>
            Mes Demandes
          </h1>
          <p className="mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Visualisez et gerez toutes vos demandes
          </p>
        </div>
        <Link href="/dashboard/new-request">
          <Button className="gap-2" style={{ backgroundColor: 'var(--color-brand-amber)', color: 'var(--color-brand-navy)', fontWeight: 600 }}>
            <Plus className="h-4 w-4" />
            Nouvelle Demande
          </Button>
        </Link>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
          <Input
            placeholder="Rechercher dans mes demandes..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <TabsList className="h-auto flex-wrap justify-start gap-2 bg-transparent p-0">
          <TabsTrigger className="h-9 flex-none px-4" value="all">Tous ({searchedRequests.length})</TabsTrigger>
          <TabsTrigger className="h-9 flex-none px-4" value="approved">Approuvees ({approvedCount})</TabsTrigger>
          <TabsTrigger className="h-9 flex-none px-4" value="rejected">Rejetees ({rejectedCount})</TabsTrigger>
          <TabsTrigger className="h-9 flex-none px-4" value="pending">En attente ({pendingCount})</TabsTrigger>
          <TabsTrigger className="h-9 flex-none px-4" value="draft">Brouillon ({draftCount})</TabsTrigger>
        </TabsList>

        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
            <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
              Filtrer par date :
            </span>
            <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              de
            </span>
            <div className="relative w-full sm:w-52">
              <Input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="pr-10"
              />
              {startDate && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute top-1/2 right-1 h-7 w-7 -translate-y-1/2"
                  onClick={() => setStartDate('')}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              &agrave;
            </span>
            <div className="relative w-full sm:w-52">
              <Input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="pr-10"
              />
              {endDate && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute top-1/2 right-1 h-7 w-7 -translate-y-1/2"
                  onClick={() => setEndDate('')}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
              Filtrer par type :
            </span>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="Tous" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {availableTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {requestTypeLabels[type] ?? type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <TabsContent value={selectedTab} className="mt-6 space-y-4">
          {isLoading ? (
            <div className="py-12 text-center">
              <BrandedLoading />
            </div>
          ) : filteredRequests.length > 0 ? (
            <div className="grid gap-4">
              {filteredRequests.map((request) => (
                <RequestCard key={request.id} request={request} onView={(current) => setSelectedRequest(current)} />
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              <p>Aucune demande trouvee pour ce filtre</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
        <DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Details de la demande</DialogTitle>
          </DialogHeader>
          {selectedRequest && <RequestDetailsSummary request={selectedRequest} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}
