'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { AlertCircle } from 'lucide-react'
import { OTPVerificationModal } from '@/components/otp-verification-modal'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'

export default function LoginPage() {
  const { login, logout, isLoading, isAuthenticated, completeOtpVerification, pendingUser, user } = useCurrentUser()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [showOTPVerification, setShowOTPVerification] = useState(false)

  useEffect(() => {
    if (isAuthenticated && user) {
      router.push('/dashboard')
    }
  }, [isAuthenticated, router, user])

  useEffect(() => {
    if (!isAuthenticated && pendingUser) {
      setShowOTPVerification(true)
    } else if (!pendingUser) {
      setShowOTPVerification(false)
    }
  }, [isAuthenticated, pendingUser])

  const maskedEmail = useMemo(() => {
    const activeUser = pendingUser ?? user
    if (!activeUser?.email) return '***@***.com'
    const [local, domain] = activeUser.email.split('@')
    if (local.length <= 2) return `${local}***@${domain}`
    return `${local[0]}***@${domain}`
  }, [pendingUser, user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      const nextStep = await login(email, password)
      if (nextStep === 'session') {
        router.push('/dashboard')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Echec de la connexion')
    }
  }

  const handleVerifyOTP = async (code: string, rememberDevice: boolean): Promise<boolean> => {
    if (!pendingUser) return false
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, rememberDevice }),
      })
      return res.ok
    } catch {
      return false
    }
  }

  const handleSendCode = useCallback(async (): Promise<void> => {
    if (!pendingUser) return
    await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
  }, [pendingUser])

  const handleVerified = async () => {
    await completeOtpVerification()
    router.push('/dashboard')
  }

  const handleCancel = async () => {
    setShowOTPVerification(false)
    await logout()
  }

  if (showOTPVerification && pendingUser) {
    return (
      <OTPVerificationModal
        userId={pendingUser.id}
        maskedEmail={maskedEmail}
        onVerify={handleVerifyOTP}
        onSendCode={handleSendCode}
        onCancel={handleCancel}
        onVerified={handleVerified}
      />
    )
  }


  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--color-bg)' }}>
      <Card className="w-full max-w-md">
        <div className="p-8">
          {/* Logo */}
          <div className="mb-8">
            <div className="mb-4">
              <img src="/logo.png" alt="ARABSOFT Logo" className="h-10 w-auto" />
            </div>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Système de gestion collaborative des demandes
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="flex gap-3 rounded-lg p-3" style={{ backgroundColor: '#FEE2E2' }}>
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#991B1B' }} />
                <p className="text-sm" style={{ color: '#991B1B' }}>{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Adresse email</Label>
              <Input
                id="email"
                type="email"
                placeholder="vous@exemple.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
              style={{ backgroundColor: 'var(--color-brand-blue)', color: 'white' }}
            >
              {isLoading ? (
                <>
                  <Spinner className="h-4 w-4 mr-2" />
                  Connexion en cours...
                </>
              ) : (
                'Se connecter'
              )}
            </Button>
          </form>

        </div>
      </Card>
    </div>
  )
}
