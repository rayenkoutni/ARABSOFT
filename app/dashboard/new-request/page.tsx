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
import { REQUEST_STATUS, REQUEST_TYPE, ROLE } from '@/lib/constants'
import { documentTypeOptions } from '@/lib/document-type'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'
import { fetchEmployeePayslips } from '@/lib/services/client/employees.service'
import { fetchProfile } from '@/lib/services/client/settings.service'
import { formatFrenchMonthYear, getPayslipPeriodLabel } from '@/lib/payslip'
import {
  formatLeaveBalance,
  getTodayDateOnly,
  getLeaveDurationLabel,
  getLeaveImpactSummary,
  getLeaveRequestValidationMessage,
  hasLeaveDateRangeOverlap,
  isLeaveRequestType,
  toDateOnlyValue,
} from '@/lib/leave-request'
import { parseRequestContent } from '@/lib/request-content'
import { Request, RequestDocumentType, RequestType } from '@/lib/types'
import { requestService } from '@/lib/services/request.service'
import type { RequestCreatePayload } from '@/lib/services/request.service'

interface EmployeeProfileSummary {
  id: string
  hireDate?: string | null
  leaveBalance?: number
}

interface EmployeePayslipSummary {
  id: string
  period: string
  periodType: 'MONTHLY' | 'ANNUAL'
}

type PayslipPeriodType = 'MONTHLY' | 'ANNUAL'

function unwrapRequestsResponse(response: Request[] | { data?: Request[] }) {
  if (Array.isArray(response)) return response
  return Array.isArray(response.data) ? response.data : []
}

function startOfMonthUtc(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0))
}

function addMonthUtc(date: Date, months: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1, 0, 0, 0, 0))
}

function toMonthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export default function NewRequestPage() {
  const { user } = useCurrentUser()
  const router = useRouter()
  const searchParams = useSearchParams()
  const draftId = searchParams.get('draftId')

  const [formData, setFormData] = useState({
    type: '',
    documentType: '',
    title: '',
    description: '',
    startDate: '',
    endDate: '',
  })
  const [profile, setProfile] = useState<EmployeeProfileSummary | null>(null)
  const [leaveBalance, setLeaveBalance] = useState(0)
  const [existingRequests, setExistingRequests] = useState<Request[]>([])
  const [existingPayslips, setExistingPayslips] = useState<EmployeePayslipSummary[]>([])
  const [payslipPeriodType, setPayslipPeriodType] = useState<PayslipPeriodType>('MONTHLY')
  const [selectedMonthlyPeriod, setSelectedMonthlyPeriod] = useState('')
  const [selectedAnnualPeriod, setSelectedAnnualPeriod] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [isLoadingDraft, setIsLoadingDraft] = useState(!!draftId)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [isLoadingPayslips, setIsLoadingPayslips] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const todayDate = getTodayDateOnly()

  const resetForm = () => {
    setFormData({
      type: '',
      documentType: '',
      title: '',
      description: '',
      startDate: '',
      endDate: '',
    })
    setPayslipPeriodType('MONTHLY')
    setSelectedMonthlyPeriod('')
    setSelectedAnnualPeriod('')
  }

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return

      try {
        setIsLoadingProfile(true)
        setLoadError(null)
        const data = (await fetchProfile()) as EmployeeProfileSummary
        setProfile(data)
        setLeaveBalance(typeof data.leaveBalance === 'number' ? data.leaveBalance : 0)
      } catch {
        setLoadError('Impossible de charger les donnees')
      } finally {
        setIsLoadingProfile(false)
      }
    }

    loadProfile()
  }, [user])

  useEffect(() => {
    const loadPayslips = async () => {
      if (!user) return

      try {
        setIsLoadingPayslips(true)
        const data = (await fetchEmployeePayslips(user.id)) as EmployeePayslipSummary[]
        setExistingPayslips(Array.isArray(data) ? data : [])
      } catch {
        setLoadError('Impossible de charger les donnees')
        setExistingPayslips([])
      } finally {
        setIsLoadingPayslips(false)
      }
    }

    loadPayslips()
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
            documentType: draftRequest.documentType ?? '',
            title,
            description,
            startDate: toDateOnlyValue(draftRequest.startDate),
            endDate: toDateOnlyValue(draftRequest.endDate),
          })

          if (draftRequest.documentType === 'FICHE_PAIE' && draftRequest.reason) {
            const [draftPeriodType, draftPeriod] = draftRequest.reason.split(':')
            if (draftPeriodType === 'MONTHLY' || draftPeriodType === 'ANNUAL') {
              setPayslipPeriodType(draftPeriodType)
              if (draftPeriodType === 'MONTHLY') {
                setSelectedMonthlyPeriod(draftPeriod)
              } else {
                setSelectedAnnualPeriod(draftPeriod)
              }
            }
          }
        }
      } catch {
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
        const requests = unwrapRequestsResponse(
          await requestService.getUserRequests(user.id) as Request[] | { data?: Request[] }
        )
        setExistingRequests(requests)
      } catch {
        setLoadError('Impossible de charger les donnees')
      }
    }

    loadRequests()
  }, [user])

  const isLeaveRequest = isLeaveRequestType(formData.type)
  const isDocumentRequest = formData.type === REQUEST_TYPE.DOCUMENT
  const isPayslipDocument = isDocumentRequest && formData.documentType === 'FICHE_PAIE'
  const hireDate = profile?.hireDate ? new Date(profile.hireDate) : null
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
        if (request.id === draftId || request.type !== REQUEST_TYPE.LEAVE) {
          return false
        }

        if (![REQUEST_STATUS.PENDING_MANAGER, REQUEST_STATUS.PENDING_HR, REQUEST_STATUS.APPROVED].some((status) => status === request.status)) {
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

  const monthlyOptions = useMemo(() => {
    if (!hireDate) return []

    const today = new Date()
    const firstAvailable = startOfMonthUtc(hireDate)
    const lastCompleteMonth = startOfMonthUtc(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1)))
    if (firstAvailable.getTime() > lastCompleteMonth.getTime()) {
      return []
    }

    const existingMonthlyPeriods = new Set(
      existingPayslips
        .filter((item) => item.periodType === 'MONTHLY')
        .map((item) => item.period),
    )

    const options: Array<{ value: string; label: string; disabled: boolean }> = []
    for (let cursor = firstAvailable; cursor.getTime() <= lastCompleteMonth.getTime(); cursor = addMonthUtc(cursor, 1)) {
      const value = toMonthKey(cursor)
      options.push({
        value,
        label: formatFrenchMonthYear(cursor),
        disabled: existingMonthlyPeriods.has(value),
      })
    }

    return options.reverse()
  }, [existingPayslips, hireDate])

  const annualOptions = useMemo(() => {
    if (!hireDate) return []

    const today = new Date()
    const lastCompleteYear = today.getUTCFullYear() - 1
    if (hireDate.getUTCFullYear() > lastCompleteYear) {
      return []
    }

    const existingAnnualPeriods = new Set(
      existingPayslips
        .filter((item) => item.periodType === 'ANNUAL')
        .map((item) => item.period),
    )

    const options: Array<{ value: string; label: string; disabled: boolean }> = []
    for (let year = hireDate.getUTCFullYear(); year <= lastCompleteYear; year += 1) {
      const value = String(year)
      options.push({
        value,
        label: getPayslipPeriodLabel('ANNUAL', value),
        disabled: existingAnnualPeriods.has(value),
      })
    }

    return options.reverse()
  }, [existingPayslips, hireDate])

  const draftRequests = useMemo(
    () => existingRequests.filter((request) => request.status === REQUEST_STATUS.DRAFT),
    [existingRequests],
  )

  const selectedPayslipReason = isPayslipDocument
    ? payslipPeriodType === 'MONTHLY'
      ? selectedMonthlyPeriod
        ? `MONTHLY:${selectedMonthlyPeriod}`
        : ''
      : selectedAnnualPeriod
        ? `ANNUAL:${selectedAnnualPeriod}`
        : ''
    : ''

  if (!user || user.role !== ROLE.EMPLOYEE) {
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
      startDate: value === REQUEST_TYPE.LEAVE ? current.startDate : '',
      endDate: value === REQUEST_TYPE.LEAVE ? current.endDate : '',
      documentType: value === REQUEST_TYPE.DOCUMENT ? current.documentType : '',
    }))
  }

  const handleDocumentTypeChange = (value: string) => {
    setFormData((current) => ({
      ...current,
      documentType: value,
    }))

    if (value !== 'FICHE_PAIE') {
      setSelectedMonthlyPeriod('')
      setSelectedAnnualPeriod('')
      setPayslipPeriodType('MONTHLY')
    }
  }

  const handleSubmit = async (e: React.FormEvent, asDraft: boolean = false) => {
    e.preventDefault()
    setError('')

    if (!formData.type || !formData.title || !formData.description) {
      setError('Tous les champs sont obligatoires')
      return
    }

    if (isDocumentRequest && !formData.documentType) {
      setError('Le type de document est obligatoire')
      return
    }

    if (isPayslipDocument && !selectedPayslipReason) {
      setError('La periode de la fiche de paie est obligatoire')
      return
    }

    if (leaveValidationMessage || overlapValidationMessage) {
      setError(leaveValidationMessage || overlapValidationMessage)
      return
    }

    try {
      setIsSubmitting(true)

      const payload: RequestCreatePayload = {
        type: formData.type as RequestType,
        title: formData.title,
        description: formData.description,
        isDraft: asDraft,
        startDate: isLeaveRequest ? formData.startDate : '',
        endDate: isLeaveRequest ? formData.endDate : '',
        documentType: isDocumentRequest ? formData.documentType as RequestDocumentType : null,
        reason: isPayslipDocument ? selectedPayslipReason : null,
      }

      if (draftId) {
        await requestService.updateRequest(draftId, {
          type: payload.type,
          comment: `[${payload.title}] - ${payload.description}`,
          isDraft: payload.isDraft,
          startDate: payload.startDate || null,
          endDate: payload.endDate || null,
          documentType: payload.documentType ?? null,
          reason: payload.reason ?? null,
        })

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

  const handleCancel = async () => {
    if (!draftId) {
      router.back()
      return
    }

    try {
      setIsSubmitting(true)
      setError('')
      await requestService.deleteRequest(draftId)

      setExistingRequests((current) => current.filter((request) => request.id !== draftId))
      resetForm()
      setIsLoadingDraft(false)
      router.replace('/dashboard/new-request')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Echec de la suppression du brouillon')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {loadError && (
        <div className="text-destructive text-sm p-4 rounded border border-destructive/20">
          {loadError}
        </div>
      )}
      <div>
        <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text)', fontSize: '22px', fontWeight: 600 }}>
          {draftId ? 'Modifier le brouillon' : 'Creer une nouvelle demande'}
        </h1>
        <p className="mt-1" style={{ color: 'var(--color-text-muted)' }}>
          {draftId ? 'Continuer a modifier votre brouillon et soumettre quand pret' : 'Soumettre une nouvelle demande pour approbation'}
        </p>
      </div>

      {draftRequests.length > 0 ? (
        <Card className="max-w-2xl p-3 md:p-4">
          <div className="space-y-3">
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>
              Liste des brouillons
            </h2>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Reprenez un brouillon existant depuis les cartes ci-dessous.
            </p>
          </div>

            <div className="space-y-2">
              {draftRequests.slice(0, 4).map((request) => {
                const { title, description } = parseRequestContent(request)
                const fallbackTitle = request.type === REQUEST_TYPE.DOCUMENT
                  ? 'Brouillon document'
                  : request.type === REQUEST_TYPE.LEAVE
                    ? 'Brouillon conge'
                    : request.type === REQUEST_TYPE.AUTHORIZATION
                      ? 'Brouillon autorisation'
                      : 'Brouillon pret'

                return (
                  <button
                    key={request.id}
                    type="button"
                    onClick={() => router.push(`/dashboard/new-request?draftId=${request.id}`)}
                    className="w-full rounded-lg border px-3 py-3 text-left transition-colors hover:bg-slate-50"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    <p className="font-medium" style={{ color: 'var(--color-text)' }}>
                      {title || fallbackTitle}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                      {description || 'Aucune description'}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>
        </Card>
      ) : null}

      {isLoadingDraft ? (
        <div className="flex items-center justify-center py-12">
          <Spinner className="h-8 w-8" />
        </div>
      ) : (
        <Card className="max-w-2xl p-3 md:p-4 lg:p-5">
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
                  <SelectItem value={REQUEST_TYPE.LEAVE}>Demande de Conge</SelectItem>
                  <SelectItem value={REQUEST_TYPE.AUTHORIZATION}>Autorisation</SelectItem>
                  <SelectItem value={REQUEST_TYPE.DOCUMENT}>Document ressources humaines</SelectItem>
                  <SelectItem value={REQUEST_TYPE.LOAN}>Pret Materiel</SelectItem>
                </SelectContent>
              </Select>
            </FieldGroup>

            {isDocumentRequest && (
              <FieldGroup>
                <FieldLabel htmlFor="documentType">Type de document</FieldLabel>
                <Select value={formData.documentType} onValueChange={handleDocumentTypeChange}>
                  <SelectTrigger id="documentType">
                    <SelectValue placeholder="Selectionner le type de document" />
                  </SelectTrigger>
                  <SelectContent>
                    {documentTypeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldGroup>
            )}

            {isPayslipDocument && (
              <div className="space-y-4 rounded-xl border p-4">
                <FieldGroup>
                  <FieldLabel htmlFor="payslipPeriodType">Type de periode</FieldLabel>
                  <Select value={payslipPeriodType} onValueChange={(value: PayslipPeriodType) => setPayslipPeriodType(value)}>
                    <SelectTrigger id="payslipPeriodType">
                      <SelectValue placeholder="Selectionner le type de periode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MONTHLY">Mensuelle</SelectItem>
                      <SelectItem value="ANNUAL">Annuelle</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldGroup>

                {payslipPeriodType === 'MONTHLY' ? (
                  <FieldGroup>
                    <FieldLabel htmlFor="monthlyPeriod">Mois concerne</FieldLabel>
                    <Select value={selectedMonthlyPeriod} onValueChange={setSelectedMonthlyPeriod}>
                      <SelectTrigger id="monthlyPeriod">
                        <SelectValue placeholder={isLoadingPayslips || isLoadingProfile ? 'Chargement des periodes...' : 'Selectionner un mois'} />
                      </SelectTrigger>
                      <SelectContent>
                        {monthlyOptions.length > 0 ? monthlyOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
                            {option.label}{option.disabled ? ' - deja generee' : ''}
                          </SelectItem>
                        )) : (
                          <div className="px-2 py-2 text-sm text-muted-foreground">
                            Aucune periode mensuelle disponible.
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  </FieldGroup>
                ) : (
                  <FieldGroup>
                    <FieldLabel htmlFor="annualPeriod">Annee concernee</FieldLabel>
                    <Select value={selectedAnnualPeriod} onValueChange={setSelectedAnnualPeriod}>
                      <SelectTrigger id="annualPeriod">
                        <SelectValue placeholder={isLoadingPayslips || isLoadingProfile ? 'Chargement des periodes...' : 'Selectionner une annee'} />
                      </SelectTrigger>
                      <SelectContent>
                        {annualOptions.length > 0 ? annualOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
                            {option.label}{option.disabled ? ' - deja generee' : ''}
                          </SelectItem>
                        )) : (
                          <div className="px-2 py-2 text-sm text-muted-foreground">
                            Aucune periode annuelle disponible.
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  </FieldGroup>
                )}
              </div>
            )}

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
                      min={todayDate}
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
                      min={formData.startDate || todayDate}
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
                onClick={handleCancel}
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
