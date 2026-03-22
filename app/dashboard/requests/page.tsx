'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
<<<<<<< HEAD
import { RequestCard } from '@/components/request-card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BrandedLoading } from '@/components/ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { matchesRequestDateRange } from '@/lib/request-date-filter'
import { requestService } from '@/lib/request-service'
import { buildRequestCardSearchText, normalizeSearchText } from '@/lib/request-search'
import { requestTypeLabels } from '@/lib/request-type'
import { Request } from '@/lib/types'
import { Search, X } from 'lucide-react'
=======
import { requestService } from '@/lib/request-service'
import { Request } from '@/lib/types'
import { RequestCard } from '@/components/request-card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'
import { BrandedLoading } from '@/components/ui/spinner'
>>>>>>> f49d7d60cb38a7e60984e5dc779dbb32a52e7fe2

export default function RequestsPage() {
  const { user } = useAuth()
  const [requests, setRequests] = useState<Request[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTab, setSelectedTab] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
<<<<<<< HEAD
  const [selectedType, setSelectedType] = useState<string>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
=======
>>>>>>> f49d7d60cb38a7e60984e5dc779dbb32a52e7fe2

  useEffect(() => {
    const loadRequests = async () => {
      if (!user) return

      try {
        setIsLoading(true)
<<<<<<< HEAD
        const data = await requestService.getRHHistoryRequests()
=======
        const data = await requestService.getAllRequests()
>>>>>>> f49d7d60cb38a7e60984e5dc779dbb32a52e7fe2
        setRequests(data)
      } finally {
        setIsLoading(false)
      }
    }

    loadRequests()
  }, [user])

  if (!user || user.role !== 'RH') {
    return (
<<<<<<< HEAD
      <div className="py-12 text-center">
=======
      <div className="text-center py-12">
>>>>>>> f49d7d60cb38a7e60984e5dc779dbb32a52e7fe2
        <p className="text-muted-foreground">Access denied</p>
      </div>
    )
  }

<<<<<<< HEAD
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

    if (selectedTab === 'approved') {
      return request.status === 'APPROUVE'
    }

    if (selectedTab === 'rejected') {
      return request.status === 'REJETE'
    }

    return true
  })

  const approvedCount = searchedRequests.filter((request) => request.status === 'APPROUVE').length
  const rejectedCount = searchedRequests.filter((request) => request.status === 'REJETE').length
=======
  const filteredRequests = requests.filter(r => {
    const searchable = (r.comment || r.type || '').toLowerCase()
    const employeeName = (r.employee?.name || '').toLowerCase()
    const matchesSearch = searchTerm === '' ||
      searchable.includes(searchTerm.toLowerCase()) ||
      employeeName.includes(searchTerm.toLowerCase())

    if (selectedTab === 'pending') {
      return (r.status === 'EN_ATTENTE_CHEF' || r.status === 'EN_ATTENTE_RH') && matchesSearch
    } else if (selectedTab === 'approved') {
      return r.status === 'APPROUVE' && matchesSearch
    } else if (selectedTab === 'rejected') {
      return r.status === 'REJETE' && matchesSearch
    }

    return matchesSearch
  })

  const pendingCount = requests.filter(r => r.status === 'EN_ATTENTE_CHEF' || r.status === 'EN_ATTENTE_RH').length
  const approvedCount = requests.filter(r => r.status === 'APPROUVE').length
  const rejectedCount = requests.filter(r => r.status === 'REJETE').length
>>>>>>> f49d7d60cb38a7e60984e5dc779dbb32a52e7fe2

  return (
    <div className="space-y-6">
      <div>
<<<<<<< HEAD
        <h1 className="text-3xl font-bold" style={{ fontSize: '22px', fontWeight: 600, color: 'var(--color-text)' }}>
          Historique des Demandes
        </h1>
        <p className="mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Consultez l&apos;historique des demandes finalisees des employes
=======
        <h1 className="text-3xl font-bold" style={{ fontSize: '22px', fontWeight: 600, color: 'var(--color-text)' }}>Toutes les Demandes</h1>
        <p className="mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Gérez et examinez toutes les demandes des employés
>>>>>>> f49d7d60cb38a7e60984e5dc779dbb32a52e7fe2
        </p>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
<<<<<<< HEAD
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
          <Input
            placeholder={"Rechercher dans l'historique des demandes..."}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
=======
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
          <Input
            placeholder="Rechercher des demandes..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
>>>>>>> f49d7d60cb38a7e60984e5dc779dbb32a52e7fe2
            className="pl-10"
          />
        </div>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
<<<<<<< HEAD
        <TabsList className="h-auto flex-wrap justify-start gap-2 bg-transparent p-0">
          <TabsTrigger className="h-9 flex-none px-4" value="all">Tous ({searchedRequests.length})</TabsTrigger>
          <TabsTrigger className="h-9 flex-none px-4" value="approved">Approuvees ({approvedCount})</TabsTrigger>
          <TabsTrigger className="h-9 flex-none px-4" value="rejected">Rejetees ({rejectedCount})</TabsTrigger>
        </TabsList>

        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:flex-wrap">
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
=======
        <TabsList>
          <TabsTrigger value="all">Toutes ({requests.length})</TabsTrigger>
          <TabsTrigger value="pending">
            En attente ({pendingCount})
          </TabsTrigger>
          <TabsTrigger value="approved">
            Approuvées ({approvedCount})
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Rejetées ({rejectedCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={selectedTab} className="space-y-4 mt-6">
          {isLoading ? (
            <div className="text-center py-12">
>>>>>>> f49d7d60cb38a7e60984e5dc779dbb32a52e7fe2
              <BrandedLoading />
            </div>
          ) : filteredRequests.length > 0 ? (
            <div className="grid gap-4">
              {filteredRequests.map((request) => (
<<<<<<< HEAD
                <RequestCard key={request.id} request={request} />
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              <p>Aucune demande dans cet historique</p>
=======
                <RequestCard
                  key={request.id}
                  request={request}
                  showApprovalAction={true}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>Aucune demande trouvée</p>
>>>>>>> f49d7d60cb38a7e60984e5dc779dbb32a52e7fe2
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
