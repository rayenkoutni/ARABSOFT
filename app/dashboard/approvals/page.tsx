'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, Search, X, XCircle } from 'lucide-react'
import { RequestCard } from '@/components/request-card'
import { RequestDetailsSummary } from '@/components/request-details-summary'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BrandedLoading } from '@/components/ui/spinner'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/lib'
import { parseRequestContent } from '@/lib/request-content'
import { matchesRequestDateRange } from '@/lib/request-date-filter'
import { buildRequestCardSearchText, normalizeSearchText } from '@/lib/request-search'
import { requestService } from '@/lib'
import { requestTypeLabels } from '@/lib/request-type'
import { Request } from '@/lib/types'

function ApprovalsContent() {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const [requests, setRequests] = useState<Request[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null)
  const [isLoadingSelectedRequest, setIsLoadingSelectedRequest] = useState(false)
  const [selectedRequestError, setSelectedRequestError] = useState('')
  const [approvalComment, setApprovalComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null)
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [selectedType, setSelectedType] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const openRequestForExamination = async (requestId: string) => {
    try {
      setIsLoadingSelectedRequest(true)
      setSelectedRequestError('')
      setSelectedRequest(null)
      setSelectedRequest(await requestService.getRequestById(requestId))
    } catch (error) {
      console.error('Failed to load request details:', error)
      setSelectedRequest(null)
      setSelectedRequestError("Impossible de charger les details de la demande.")
    } finally {
      setIsLoadingSelectedRequest(false)
    }
  }

  useEffect(() => {
    const loadRequests = async () => {
      if (!user) return

      try {
        setIsLoading(true)
        const data = await requestService.getRHPendingRequests()
        setRequests(data)

        const requestId = searchParams.get('requestId')
        if (requestId) {
          const target = data.find((request) => request.id === requestId && request.status === 'EN_ATTENTE_RH')
          if (target) {
            await openRequestForExamination(target.id)
          }
        }
      } finally {
        setIsLoading(false)
      }
    }

    loadRequests()
  }, [user, searchParams])

  if (!user || user.role !== 'RH') {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">Cette page est reservee aux RH</p>
      </div>
    )
  }

  const handleApprove = async () => {
    if (!selectedRequest) return

    try {
      setIsSubmitting(true)
      setSelectedRequestError('')
      const updated = await requestService.approveRequest(selectedRequest.id, user.role, approvalComment)

      if (updated) {
        setRequests(requests.filter((request) => request.id !== updated.id))
        setSelectedRequest(null)
        setApprovalComment('')
        setActionType(null)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Impossible de traiter l'approbation."
      setSelectedRequestError(message)

      try {
        setSelectedRequest(await requestService.getRequestById(selectedRequest.id))
      } catch (refreshError) {
        console.error('Failed to refresh request after approval error:', refreshError)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReject = async () => {
    if (!selectedRequest || !approvalComment.trim()) return

    try {
      setIsSubmitting(true)
      setSelectedRequestError('')
      const updated = await requestService.rejectRequest(selectedRequest.id, user.role, approvalComment)

      if (updated) {
        setRequests(requests.filter((request) => request.id !== updated.id))
        setSelectedRequest(null)
        setApprovalComment('')
        setActionType(null)
      }
    } catch (error) {
      setSelectedRequestError(error instanceof Error ? error.message : "Impossible de traiter le rejet.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedRequestInfo = selectedRequest ? parseRequestContent(selectedRequest) : null
  const pendingRequests = requests.filter((request) => request.status === 'EN_ATTENTE_CHEF' || request.status === 'EN_ATTENTE_RH')
  const normalizedSearchTerm = normalizeSearchText(searchTerm)
  const searchedRequests = pendingRequests.filter((request) => {
    const searchable = normalizeSearchText(buildRequestCardSearchText(request, user.id))
    return normalizedSearchTerm === '' || searchable.includes(normalizedSearchTerm)
  })
  const availableTypes = Array.from(new Set(searchedRequests.map((request) => request.type)))

  const filteredByMetaRequests = searchedRequests.filter((request) => {
    if (!matchesRequestDateRange(request.createdAt, startDate, endDate)) {
      return false
    }

    if (selectedType !== 'all' && request.type !== selectedType) {
      return false
    }

    return true
  })

  const pendingChefCount = filteredByMetaRequests.filter((request) => request.status === 'EN_ATTENTE_CHEF').length
  const pendingRHCount = filteredByMetaRequests.filter((request) => request.status === 'EN_ATTENTE_RH').length

  const visibleRequests = filteredByMetaRequests.filter((request) => {
    if (selectedStatus === 'pending-chef') {
      return request.status === 'EN_ATTENTE_CHEF'
    }

    if (selectedStatus === 'pending-rh') {
      return request.status === 'EN_ATTENTE_RH'
    }

    return true
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" style={{ fontSize: '22px', fontWeight: 600, color: 'var(--color-text)' }}>
          Approbations RH
        </h1>
        <p className="mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Examinez et approuvez les demandes en attente de validation RH
        </p>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
          <Input
            placeholder="Rechercher dans les approbations en attente..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Tabs value={selectedStatus} onValueChange={setSelectedStatus}>
        <TabsList className="h-auto flex-wrap justify-start gap-2 bg-transparent p-0">
          <TabsTrigger className="h-9 flex-none px-4" value="all">Tous ({filteredByMetaRequests.length})</TabsTrigger>
          <TabsTrigger className="h-9 flex-none px-4" value="pending-chef">En attente Chef ({pendingChefCount})</TabsTrigger>
          <TabsTrigger className="h-9 flex-none px-4" value="pending-rh">En attente RH ({pendingRHCount})</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-col gap-4">
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

      {isLoading ? (
        <div className="py-12 text-center">
          <BrandedLoading />
        </div>
      ) : visibleRequests.length > 0 ? (
        <div className="grid gap-4">
          {visibleRequests.map((request) => {
            const isActionable = request.status === 'EN_ATTENTE_RH'

            return (
              <div
                key={request.id}
                className={isActionable ? 'min-w-0 cursor-pointer' : 'min-w-0'}
                onClick={isActionable ? () => void openRequestForExamination(request.id) : undefined}
              >
                <RequestCard
                  request={request}
                  onView={isActionable ? () => void openRequestForExamination(request.id) : undefined}
                  onExamine={isActionable ? () => void openRequestForExamination(request.id) : undefined}
                />
              </div>
            )
          })}
        </div>
      ) : (
        <div className="py-12 text-center" style={{ color: 'var(--color-text-muted)' }}>
          <CheckCircle2 className="mx-auto mb-4 h-12 w-12 opacity-50" style={{ color: 'var(--color-text-muted)' }} />
          <p>Aucune approbation RH en attente</p>
        </div>
      )}

      <Dialog
        open={!!selectedRequest || isLoadingSelectedRequest || !!selectedRequestError}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedRequest(null)
            setSelectedRequestError('')
            setActionType(null)
            setApprovalComment('')
          }
        }}
      >
        <DialogContent className="h-auto max-h-[min(85vh,48rem)] w-[min(calc(100vw-2rem),48rem)] min-w-0 max-w-[min(calc(100vw-2rem),48rem)] overflow-hidden p-0">
          <div className="flex min-h-0 min-w-0 flex-col">
            <DialogHeader className="min-w-0 shrink-0 border-b px-6 py-5 pr-12">
              <DialogTitle className="min-w-0 max-w-full whitespace-normal wrap-anywhere [word-break:break-word]">
                {selectedRequestInfo && `Titre : ${selectedRequestInfo.title}`}
              </DialogTitle>
              <DialogDescription className="min-w-0 max-w-full wrap-anywhere [word-break:break-word]">
                Examinez le flux d&apos;approbation et fournissez votre avis
              </DialogDescription>
            </DialogHeader>

            {isLoadingSelectedRequest && (
              <div className="px-6 py-10 text-center">
                <BrandedLoading />
              </div>
            )}

            {!isLoadingSelectedRequest && selectedRequestError && (
              <div className="px-6 py-8">
                <p className="text-sm" style={{ color: '#991B1B' }}>
                  {selectedRequestError}
                </p>
              </div>
            )}

            {!isLoadingSelectedRequest && selectedRequest && (
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <div className="min-h-0 min-w-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
                  {selectedRequestError && (
                    <div className="rounded-lg p-4 text-sm" style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>
                      {selectedRequestError}
                    </div>
                  )}

                  <RequestDetailsSummary request={selectedRequest} showBalanceImpact showRequester />

                  {actionType && (
                    <div className="min-w-0">
                      <label className="text-sm font-medium">
                        Commentaire {actionType === 'approve' ? "d'approbation" : 'de rejet'}
                      </label>
                      <Textarea
                        placeholder={
                          actionType === 'approve'
                            ? 'Ajoutez un commentaire (optionnel)...'
                            : 'Veuillez fournir une raison pour le rejet'
                        }
                        value={approvalComment}
                        onChange={(event) => setApprovalComment(event.target.value)}
                        className="mt-2 min-w-0 wrap-anywhere [word-break:break-word]"
                        rows={4}
                        required={actionType === 'reject'}
                      />
                    </div>
                  )}
                </div>

                <DialogFooter className="shrink-0 gap-2 border-t px-6 py-4">
                  {!actionType ? (
                    <>
                      <Button variant="outline" onClick={() => setSelectedRequest(null)}>
                        Fermer
                      </Button>
                      <Button variant="destructive" onClick={() => setActionType('reject')} className="gap-2">
                        <XCircle className="h-4 w-4" />
                        Rejeter
                      </Button>
                      <Button onClick={() => setActionType('approve')} className="gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        Approuver
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setActionType(null)
                          setApprovalComment('')
                        }}
                        disabled={isSubmitting}
                      >
                        Annuler
                      </Button>
                      <Button
                        onClick={actionType === 'approve' ? handleApprove : handleReject}
                        disabled={isSubmitting || (actionType === 'reject' && !approvalComment.trim())}
                        variant={actionType === 'reject' ? 'destructive' : 'default'}
                      >
                        {isSubmitting ? 'Traitement...' : actionType === 'approve' ? "Confirmer l'approbation" : 'Confirmer le rejet'}
                      </Button>
                    </>
                  )}
                </DialogFooter>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function ApprovalsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center">
          <BrandedLoading />
        </div>
      }
    >
      <ApprovalsContent />
    </Suspense>
  )
}
