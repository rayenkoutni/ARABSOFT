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

export default function MyApprovalsPage() {
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
        const data = await requestService.getManagerPendingRequests(user.id)
        setRequests(data)
      } finally {
        setIsLoading(false)
      }
    }

    loadRequests()
  }, [user])

  if (!user || user.role !== 'CHEF') {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">This page is for managers only</p>
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

  const pendingRequests = requests.filter(r =>
    r.approvals.some(a => a.approverRole === user.role && a.status === 'PENDING')
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" style={{ fontSize: '22px', fontWeight: 600, color: 'var(--color-text)' }}>My Approvals</h1>
        <p className="mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Review and approve pending requests from your team
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <BrandedLoading />
        </div>
      ) : pendingRequests.length > 0 ? (
        <div className="grid gap-4">
          {pendingRequests.map((request) => (
            <div key={request.id} onClick={() => setSelectedRequest(request)}>
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
          <p>No pending approvals</p>
        </div>
      )}

      {/* Approval Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedRequest?.title}</DialogTitle>
            <DialogDescription>
              Review the approval workflow and provide feedback
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">Description</h3>
                <p className="text-sm text-muted-foreground">{selectedRequest.description}</p>
              </div>

              <div>
                <h3 className="font-semibold mb-4">Approval Timeline</h3>
                <ApprovalTimeline approvals={selectedRequest.approvals} />
              </div>

              {actionType && (
                <div>
                  <label className="text-sm font-medium">
                    {actionType === 'approve' ? 'Approval' : 'Rejection'} Comment
                  </label>
                  <Textarea
                    placeholder={
                      actionType === 'approve'
                        ? 'Add your approval comment (optional)...'
                        : 'Please provide a reason for rejection'
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
                      Close
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => setActionType('reject')}
                      className="gap-2"
                    >
                      <XCircle className="h-4 w-4" />
                      Reject
                    </Button>
                    <Button
                      onClick={() => setActionType('approve')}
                      className="gap-2"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Approve
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
                      Cancel
                    </Button>
                    <Button
                      onClick={actionType === 'approve' ? handleApprove : handleReject}
                      disabled={isSubmitting || (actionType === 'reject' && !approvalComment.trim())}
                      variant={actionType === 'reject' ? 'destructive' : 'default'}
                    >
                      {isSubmitting ? 'Processing...' : actionType === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
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
