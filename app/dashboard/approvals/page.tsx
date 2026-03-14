'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { requestService } from '@/lib/request-service'
import { Request } from '@/lib/types'
import { RequestCard } from '@/components/request-card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { ApprovalTimeline } from '@/components/approval-timeline'
import { CheckCircle2, XCircle } from 'lucide-react'
import { BrandedLoading } from '@/components/ui/spinner'

export default function ApprovalsPage() {
  const { user } = useAuth()
  const [requests, setRequests] = useState<Request[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null)
  const [approvalComment, setApprovalComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null)

  useEffect(() => {
    const loadRequests = async () => {
      if (!user) return

      try {
        setIsLoading(true)
        const data = await requestService.getRHPendingRequests()
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
        <p className="text-muted-foreground">This page is for HR only</p>
      </div>
    )
  }

  const handleApprove = async () => {
    if (!selectedRequest) return

    try {
      setIsSubmitting(true)
      const updated = await requestService.approveRequest(
        selectedRequest.id,
        user.role,
        approvalComment
      )
      if (updated) {
        setRequests(requests.map(r => (r.id === updated.id ? updated : r)))
        setSelectedRequest(null)
        setApprovalComment('')
        setActionType(null)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReject = async () => {
    if (!selectedRequest || !approvalComment.trim()) return

    try {
      setIsSubmitting(true)
      const updated = await requestService.rejectRequest(
        selectedRequest.id,
        user.role,
        approvalComment
      )
      if (updated) {
        setRequests(requests.map(r => (r.id === updated.id ? updated : r)))
        setSelectedRequest(null)
        setApprovalComment('')
        setActionType(null)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // Filter to show only requests waiting for HR
  const pendingRequests = requests.filter(r => r.status === 'EN_ATTENTE_RH')

  const getRequestInfo = (request: Request) => {
    let title = request.type
    let description = ''
    if (request.comment) {
      const match = request.comment.match(/^\[(.+?)\]\s*-\s*(.*)$/)
      if (match) {
        title = match[1]
        description = match[2]
      } else {
        description = request.comment
      }
    }
    return { title, description }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" style={{ fontSize: '22px', fontWeight: 600, color: 'var(--color-text)' }}>Approbations RH</h1>
        <p className="mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Examinez et approuvez les demandes en attente de validation RH
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <BrandedLoading />
        </div>
      ) : pendingRequests.length > 0 ? (
        <div className="grid gap-4">
          {pendingRequests.map((request) => (
            <div key={request.id}>
              <RequestCard
                request={request}
                onView={setSelectedRequest}
                showApprovalAction={true}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>
          <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" style={{ color: 'var(--color-text-muted)' }} />
          <p>Aucune approbation RH en attente</p>
        </div>
      )}

      {/* Approval Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedRequest && getRequestInfo(selectedRequest).title}</DialogTitle>
            <DialogDescription>
              Examinez le flux d'approbation et fournissez votre avis
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">Description</h3>
                <p className="text-sm text-muted-foreground">{getRequestInfo(selectedRequest).description}</p>
              </div>

              {selectedRequest.employee && (
                <div>
                  <h3 className="font-semibold mb-2">Demandeur</h3>
                  <p className="text-sm text-muted-foreground">{selectedRequest.employee.name}</p>
                </div>
              )}

              <div>
                <h3 className="font-semibold mb-4">Historique</h3>
                <ApprovalTimeline history={selectedRequest.history} />
              </div>

              {actionType && (
                <div>
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
                    onChange={e => setApprovalComment(e.target.value)}
                    className="mt-2"
                    rows={4}
                    required={actionType === 'reject'}
                  />
                </div>
              )}

              <DialogFooter className="gap-2">
                {!actionType ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setSelectedRequest(null)}
                    >
                      Fermer
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => setActionType('reject')}
                      className="gap-2"
                    >
                      <XCircle className="h-4 w-4" />
                      Rejeter
                    </Button>
                    <Button
                      onClick={() => setActionType('approve')}
                      className="gap-2"
                    >
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
        </DialogContent>
      </Dialog>
    </div>
  )
}
