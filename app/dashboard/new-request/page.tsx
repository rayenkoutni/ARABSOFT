'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/lib'
import {
  formatLeaveBalance,
  getLeaveDurationLabel,
  getLeaveImpactSummary,
  getLeaveRequestValidationMessage,
  hasLeaveDateRangeOverlap,
  isLeaveRequestType,
  toDateOnlyValue,
} from '@/lib/leave-request'
import { parseRequestContent } from '@/lib/request-content'
import { requestService } from '@/lib/services/request.service'
import { Request } from '@/lib/types'

interface EmployeeProfileSummary {
  leaveBalance?: number
}

export default function NewRequestPage() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const draftId = searchParams.get('draftId')

  const [formData, setFormData] = useState({
    type: '',
    title: '',
    description: '',
    startDate: '',
    endDate: '',
  })
  const [leaveBalance, setLeaveBalance] = useState(0)
  const [existingRequests, setExistingRequests] = useState<Request[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [isLoadingDraft, setIsLoadingDraft] = useState(!!draftId)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return

      try {
        setIsLoadingProfile(true)
        const response = await fetch('/api/employees/profile', { cache: 'no-store' })
        if (!response.ok) {
          throw new Error('Echec du chargement du profil')
        }

        const profile = (await response.json()) as EmployeeProfileSummary
        setLeaveBalance(typeof profile.leaveBalance === 'number' ? profile.leaveBalance : 0)
      } catch (err) {
        console.error('Failed to load profile:', err)
      } finally {
        setIsLoadingProfile(false)
      }
    }

    loadProfile()
  }, [user])

  useEffect(() => {
    const loadDraft = async () => {
      if (!draftId || !user) return

      try {
        setIsLoadingDraft(true)
        const draftRequest = await requestService.getRequestById(draftId)

        if (draftRequest.status === 'BROUILLON') {
          const { title, description } = parseRequestContent(draftRequest)
          setFormData({
            type: draftRequest.type,
            title,
            description,
            startDate: toDateOnlyValue(draftRequest.startDate),
            endDate: toDateOnlyValue(draftRequest.endDate),
          })
        }
      } catch (err) {
        console.error('Failed to load draft:', err)
        setError('Echec du chargement du brouillon')
      } finally {
        setIsLoadingDraft(false)
      }
    }

    loadDraft()
  }, [draftId, user])

  useEffect(() => {
    const loadRequests = async () => {
      if (!user) return

      try {
        const requests = await requestService.getUserRequests(user.id)
        setExistingRequests(requests)
      } catch (err) {
        console.error('Failed to load requests:', err)
      }
    }

    loadRequests()
  }, [user])

  const isLeaveRequest = isLeaveRequestType(formData.type)
  const leaveImpact = useMemo(
    () =>
      getLeaveImpactSummary({
        startDate: formData.startDate,
        endDate: formData.endDate,
        leaveBalance,
      }),
    [formData.endDate, formData.startDate, leaveBalance],
  )
  const leaveValidationMessage = getLeaveRequestValidationMessage({
    type: formData.type,
    startDate: formData.startDate,
    endDate: formData.endDate,
    leaveBalance,
  })
  const overlappingLeaveRequest = isLeaveRequest && formData.startDate && formData.endDate
    ? existingRequests.find((request) => {
        if (request.id === draftId || request.type !== 'CONGE') {
          return false
        }

        if (!['EN_ATTENTE_CHEF', 'EN_ATTENTE_RH', 'APPROUVE'].includes(request.status)) {
          return false
        }

        const existingStartDate = toDateOnlyValue(request.startDate)
        const existingEndDate = toDateOnlyValue(request.endDate)
        if (!existingStartDate || !existingEndDate) {
          return false
        }

        return hasLeaveDateRangeOverlap(
          formData.startDate,
          formData.endDate,
          existingStartDate,
          existingEndDate,
        )
      })
    : undefined
  const overlapValidationMessage = overlappingLeaveRequest
    ? 'Une demande de conge existe deja sur cette periode.'
    : ''

  if (!user || user.role !== 'COLLABORATEUR') {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">Seuls les employes peuvent creer des demandes</p>
      </div>
    )
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((current) => ({
      ...current,
      [e.target.name]: e.target.value,
    }))
  }

  const handleTypeChange = (value: string) => {
    setFormData((current) => ({
      ...current,
      type: value,
      startDate: value === 'CONGE' ? current.startDate : '',
      endDate: value === 'CONGE' ? current.endDate : '',
    }))
  }

  const handleSubmit = async (e: React.FormEvent, asDraft: boolean = false) => {
    e.preventDefault()
    setError('')

    if (!formData.type || !formData.title || !formData.description) {
      setError('Tous les champs sont obligatoires')
      return
    }

    if (leaveValidationMessage || overlapValidationMessage) {
      setError(leaveValidationMessage || overlapValidationMessage)
      return
    }

    try {
      setIsSubmitting(true)

      const payload = {
        type: formData.type,
        title: formData.title,
        description: formData.description,
        isDraft: asDraft,
        startDate: isLeaveRequest ? formData.startDate : '',
        endDate: isLeaveRequest ? formData.endDate : '',
      }

      if (draftId) {
        const response = await fetch(`/api/requests/${draftId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: payload.type,
            comment: `[${payload.title}] - ${payload.description}`,
            isDraft: payload.isDraft,
            startDate: payload.startDate || null,
            endDate: payload.endDate || null,
          }),
        })

        if (!response.ok) {
          const body = await response.json().catch(() => null)
          throw new Error(body?.error || 'Echec de la mise a jour du brouillon')
        }

        router.push('/dashboard/my-requests')
        return
      }

      await requestService.createRequest(payload)
      router.push('/dashboard/my-requests')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Echec de la creation de la demande')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text)', fontSize: '22px', fontWeight: 600 }}>
          {draftId ? 'Modifier le brouillon' : 'Creer une nouvelle demande'}
        </h1>
        <p className="mt-1" style={{ color: 'var(--color-text-muted)' }}>
          {draftId ? 'Continuer a modifier votre brouillon et soumettre quand pret' : 'Soumettre une nouvelle demande pour approbation'}
        </p>
      </div>

      {isLoadingDraft ? (
        <div className="flex items-center justify-center py-12">
          <Spinner className="h-8 w-8" />
        </div>
      ) : (
        <Card className="max-w-2xl p-6">
          <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
            {error && (
              <div className="rounded-lg p-4 text-sm" style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>
                {error}
              </div>
            )}

            <FieldGroup>
              <FieldLabel htmlFor="type">Type de demande</FieldLabel>
              <Select value={formData.type} onValueChange={handleTypeChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selectionner le type de demande" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CONGE">Demande de Conge</SelectItem>
                  <SelectItem value="AUTORISATION">Autorisation</SelectItem>
                  <SelectItem value="DOCUMENT">Document RH</SelectItem>
                  <SelectItem value="PRET">Pret Materiel</SelectItem>
                </SelectContent>
              </Select>
            </FieldGroup>

            <FieldGroup>
              <FieldLabel htmlFor="title">Titre</FieldLabel>
              <Input
                id="title"
                name="title"
                placeholder="ex: Demande de conges"
                value={formData.title}
                onChange={handleChange}
                required
              />
            </FieldGroup>

            <FieldGroup>
              <FieldLabel htmlFor="description">Description</FieldLabel>
              <Textarea
                id="description"
                name="description"
                placeholder="Veuillez fournir les details de votre demande..."
                value={formData.description}
                onChange={handleChange}
                rows={6}
                required
              />
            </FieldGroup>

            {isLeaveRequest && (
              <div className="space-y-4 rounded-xl border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label className="text-sm font-medium">Solde conge actuel</Label>
                    <p className="text-sm text-muted-foreground">
                      {isLoadingProfile ? 'Chargement...' : `${formatLeaveBalance(leaveBalance)} jours`}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FieldGroup>
                    <FieldLabel htmlFor="startDate">Date de debut</FieldLabel>
                    <Input
                      id="startDate"
                      name="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={handleChange}
                      required={isLeaveRequest}
                    />
                  </FieldGroup>

                  <FieldGroup>
                    <FieldLabel htmlFor="endDate">Date de fin</FieldLabel>
                    <Input
                      id="endDate"
                      name="endDate"
                      type="date"
                      value={formData.endDate}
                      onChange={handleChange}
                      required={isLeaveRequest}
                    />
                  </FieldGroup>
                </div>

                <div className="grid gap-3 rounded-lg bg-muted/30 p-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Duree demandee</p>
                    <p className="text-sm">{getLeaveDurationLabel(leaveImpact.requestedDays)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Solde projete</p>
                    <p className="text-sm">{formatLeaveBalance(leaveImpact.projectedBalance)} jours</p>
                  </div>
                </div>

                {(leaveValidationMessage || overlapValidationMessage) && (
                  <p className="text-sm" style={{ color: '#991B1B' }}>
                    {leaveValidationMessage || overlapValidationMessage}
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Spinner className="mr-2 h-4 w-4" />
                    Soumission en cours...
                  </>
                ) : (
                  'Soumettre la demande'
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={(e) => handleSubmit(e, true)}
                disabled={isSubmitting}
              >
                Enregistrer comme brouillon
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.back()}
                disabled={isSubmitting}
              >
                Annuler
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  )
}
