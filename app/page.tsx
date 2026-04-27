'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/lib'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { AlertCircle } from 'lucide-react'
import { OTPVerificationModal, checkRememberedDevice } from '@/components/otp-verification-modal'

export default function LoginPage() {
  const { login, isLoading, isAuthenticated, isOtpVerified, setOtpVerified, user } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [showOTPVerification, setShowOTPVerification] = useState(false)

  useEffect(() => {
    if (isAuthenticated && user) {
      if (isOtpVerified) {
        router.push('/dashboard')
      } else {
        const trusted = checkRememberedDevice(user.id)
        if (trusted) {
          router.push('/dashboard')
        } else {
          setShowOTPVerification(true)
        }
      }
    }
  }, [isAuthenticated, isOtpVerified, router, user])

  const maskedEmail = useMemo(() => {
    if (!user?.email) return '***@***.com'
    const [local, domain] = user.email.split('@')
    if (local.length <= 2) return `${local}***@${domain}`
    return `${local[0]}***@${domain}`
  }, [user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      await login(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Echec de la connexion')
    }
  }

  const handleVerifyOTP = async (code: string): Promise<boolean> => {
    if (!user) return false
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, code }),
      })
      return res.ok
    } catch {
      return false
    }
  }

  const handleSendCode = async (): Promise<void> => {
    if (!user) return
    await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id }),
    })
  }

  const handleVerified = () => {
    setOtpVerified(true)
    router.push('/dashboard')
  }

  const handleCancel = () => {
    setShowOTPVerification(false)
  }

  if (showOTPVerification && user) {
    return (
      <OTPVerificationModal
        userId={user.id}
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
