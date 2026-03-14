'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { requestService } from '@/lib/request-service'
import { Request } from '@/lib/types'
import { RequestCard } from '@/components/request-card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'
import { BrandedLoading } from '@/components/ui/spinner'

export default function RequestsPage() {
  const { user } = useAuth()
  const [requests, setRequests] = useState<Request[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTab, setSelectedTab] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    const loadRequests = async () => {
      if (!user) return

      try {
        setIsLoading(true)
        const data = await requestService.getAllRequests()
        setRequests(data)
      } finally {
        setIsLoading(false)
      }
    }

    loadRequests()
  }, [user])

  if (!user || user.role !== 'RH') {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Access denied</p>
      </div>
    )
  }

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" style={{ fontSize: '22px', fontWeight: 600, color: 'var(--color-text)' }}>Toutes les Demandes</h1>
        <p className="mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Gérez et examinez toutes les demandes des employés
        </p>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
          <Input
            placeholder="Rechercher des demandes..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
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
              <BrandedLoading />
            </div>
          ) : filteredRequests.length > 0 ? (
            <div className="grid gap-4">
              {filteredRequests.map((request) => (
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
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
