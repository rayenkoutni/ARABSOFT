'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { requestService } from '@/lib/request-service'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FieldGroup, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'

export default function NewRequestPage() {
  const { user } = useAuth()
  const router = useRouter()

  const [formData, setFormData] = useState({
    type: '',
    title: '',
    description: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!user || user.role !== 'COLLABORATEUR') {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Only employees can create requests</p>
      </div>
    )
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const handleTypeChange = (value: string) => {
    setFormData({ ...formData, type: value })
  }

  const handleSubmit = async (e: React.FormEvent, asDraft: boolean = false) => {
    e.preventDefault()
    setError('')

    if (!formData.type || !formData.title || !formData.description) {
      setError('All fields are required')
      return
    }

    try {
      setIsSubmitting(true)
      const request = await requestService.createRequest(
        user.id,
        formData.type,
        formData.title,
        formData.description,
        asDraft
      )

      if (!asDraft) {
        await requestService.submitRequest(request.id, user.role)
      }

      router.push('/dashboard/my-requests')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create request')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text)', fontSize: '22px', fontWeight: 600 }}>Create New Request</h1>
        <p className="mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Submit a new request for approval
        </p>
      </div>

      <Card className="p-6 max-w-2xl">
        <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
          {error && (
            <div className="rounded-lg p-4 text-sm" style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>
              {error}
            </div>
          )}

          <FieldGroup>
            <FieldLabel htmlFor="type">Request Type</FieldLabel>
            <Select value={formData.type} onValueChange={handleTypeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select request type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CONGE">Demande de Congé</SelectItem>
                <SelectItem value="AUTORISATION">Autorisation</SelectItem>
                <SelectItem value="DOCUMENT">Document RH</SelectItem>
                <SelectItem value="PRET">Prêt Matériel</SelectItem>
              </SelectContent>
            </Select>
          </FieldGroup>

          <FieldGroup>
            <FieldLabel htmlFor="title">Title</FieldLabel>
            <Input
              id="title"
              name="title"
              placeholder="e.g., Annual Leave Request"
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
              placeholder="Please provide details about your request..."
              value={formData.description}
              onChange={handleChange}
              rows={6}
              required
            />
          </FieldGroup>

          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Spinner className="h-4 w-4 mr-2" />
                  Submitting...
                </>
              ) : (
                'Submit Request'
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={(e) => handleSubmit(e, true)}
              disabled={isSubmitting}
            >
              Save as Draft
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.back()}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
