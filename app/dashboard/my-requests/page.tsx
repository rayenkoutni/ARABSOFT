'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { requestService } from '@/lib/request-service'
import { Request } from '@/lib/types'
import { RequestCard } from '@/components/request-card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { BrandedLoading } from '@/components/ui/spinner'

export default function MyRequestsPage() {
  const { user } = useAuth()
  const [requests, setRequests] = useState<Request[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTab, setSelectedTab] = useState('all')

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

  const filteredRequests = requests.filter(r => {
    if (selectedTab === 'draft') return r.status === 'BROUILLON'
    if (selectedTab === 'pending') return r.status === 'EN_ATTENTE_CHEF' || r.status === 'EN_ATTENTE_RH'
    if (selectedTab === 'approved') return r.status === 'APPROUVE'
    if (selectedTab === 'rejected') return r.status === 'REJETE'
    return true
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ fontSize: '22px', fontWeight: 600, color: 'var(--color-text)' }}>Mes Demandes</h1>
          <p className="mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Visualisez et gérez toutes vos demandes
          </p>
        </div>
        <Link href="/dashboard/new-request">
          <Button className="gap-2" style={{ backgroundColor: 'var(--color-brand-amber)', color: 'var(--color-brand-navy)', fontWeight: 600 }}>
            <Plus className="h-4 w-4" />
            Nouvelle Demande
          </Button>
        </Link>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="all">Toutes</TabsTrigger>
          <TabsTrigger value="draft">Brouillons</TabsTrigger>
          <TabsTrigger value="pending">En attente</TabsTrigger>
          <TabsTrigger value="approved">Approuvées</TabsTrigger>
          <TabsTrigger value="rejected">Rejetées</TabsTrigger>
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
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>Aucune demande {selectedTab === 'all' ? '' : selectedTab} trouvée</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
