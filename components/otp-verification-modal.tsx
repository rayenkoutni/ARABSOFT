'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react'

const STORAGE_KEY_PREFIX = 'trusted_device_'
const CODE_LENGTH = 6
const RESEND_COOLDOWN = 60

export interface OTPVerificationModalProps {
  userId: string
  maskedEmail: string
  onVerify: (code: string) => Promise<boolean>
  onSendCode: () => Promise<void>
  onCancel: () => void
  onVerified: () => void
}

export function checkRememberedDevice(userId: string): boolean {
  if (typeof window === 'undefined') return false
  const key = STORAGE_KEY_PREFIX + userId
  const stored = localStorage.getItem(key)
  if (!stored) return false
  try {
    const data = JSON.parse(stored)
    if (data.expiresAt && new Date(data.expiresAt).getTime() > Date.now()) {
      return true
    }
  } catch {
    return false
  }
  return false
}

function saveTrustedDeviceToken(userId: string, remember: boolean) {
  if (typeof window === 'undefined') return
  const key = STORAGE_KEY_PREFIX + userId
  if (remember) {
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30)
    localStorage.setItem(key, JSON.stringify({ expiresAt: expiresAt.toISOString() }))
  } else {
    localStorage.removeItem(key)
  }
}

export function OTPVerificationModal({
  userId,
  maskedEmail,
  onVerify,
  onSendCode,
  onCancel,
  onVerified,
}: OTPVerificationModalProps) {
  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(''))
  const [rememberDevice, setRememberDevice] = useState(false)
  const [error, setError] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN)
  const [shake, setShake] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    onSendCode()
  }, [])

  const isComplete = code.every(d => d !== '')

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus()
    }
  }, [])

  const handleInput = useCallback((index: number, value: string) => {
    if (!/^\d*$/.test(value)) return
    const newCode = [...code]
    newCode[index] = value.slice(-1)
    setCode(newCode)
    setError('')
    if (value && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus()
    }
  }, [code])

  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }, [code])

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH)
    if (pasted.length === 0) return
    const newCode = [...code]
    for (let i = 0; i < pasted.length; i++) {
      newCode[i] = pasted[i]
    }
    setCode(newCode)
    setError('')
    const focusIndex = Math.min(pasted.length, CODE_LENGTH - 1)
    inputRefs.current[focusIndex]?.focus()
  }, [code])

  const handleResend = useCallback(async () => {
    setCountdown(RESEND_COOLDOWN)
    setCode(Array(CODE_LENGTH).fill(''))
    setError('')
    inputRefs.current[0]?.focus()
    try {
      await onSendCode()
    } catch (e) {
      console.error(e)
    }
  }, [onSendCode])

  const handleSubmit = async () => {
    if (!isComplete || isVerifying) return
    setIsVerifying(true)
    const codeStr = code.join('')
    try {
      const valid = await onVerify(codeStr)
      if (valid) {
        saveTrustedDeviceToken(userId, rememberDevice)
        onVerified()
      } else {
        setError('Code incorrect. Veuillez réessayer.')
        setShake(true)
        setTimeout(() => setShake(false), 500)
        setCode(Array(CODE_LENGTH).fill(''))
        inputRefs.current[0]?.focus()
      }
    } finally {
      setIsVerifying(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--color-bg)' }}>
      <Card className="w-full max-w-md">
        <CardContent className="p-8">
          <button
            onClick={onCancel}
            className="flex items-center gap-2 mb-6 text-sm hover:opacity-80 transition-opacity"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </button>

          <div className="mb-8">
            <h1 className="text-xl font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
              Vérification de votre identité
            </h1>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Un code à 6 chiffres a été envoyé à <span className="font-medium" style={{ color: 'var(--color-text)' }}>{maskedEmail}</span>
            </p>
          </div>

          <div className={`flex justify-center gap-3 mb-6 ${shake ? 'animate-shake' : ''}`}>
            {code.map((digit, index) => (
              <input
                key={index}
                ref={el => { inputRefs.current[index] = el }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handleInput(index, e.target.value)}
                onKeyDown={e => handleKeyDown(index, e)}
                onPaste={handlePaste}
                className="w-12 h-14 text-center text-lg font-semibold rounded-lg border shadow-sm focus:ring-2 focus:ring-offset-1 outline-none transition-all"
                style={{
                  borderColor: error ? 'var(--color-danger)' : 'var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-text)',
                  '--tw-ring-color': error ? 'var(--color-danger)' : 'var(--color-brand-blue)',
                } as React.CSSProperties}
              />
            ))}
          </div>

          {error && (
            <div className="flex gap-2 items-center mb-6 text-sm" style={{ color: 'var(--color-danger)' }}>
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 mb-6">
            <Checkbox
              id="remember"
              checked={rememberDevice}
              onCheckedChange={(checked) => setRememberDevice(checked as boolean)}
            />
            <Label htmlFor="remember" className="text-sm cursor-pointer" style={{ color: 'var(--color-text)' }}>
              Se souvenir de cet appareil
            </Label>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!isComplete || isVerifying}
            className="w-full mb-4"
            style={{ backgroundColor: 'var(--color-brand-blue)', color: 'white' }}
          >
            {isVerifying ? 'Vérification...' : 'Vérifier'}
          </Button>

          <div className="text-center">
            {countdown > 0 ? (
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Code envoyé. Vous pouvez redemander dans {countdown}s.
              </p>
            ) : (
              <button
                onClick={handleResend}
                className="flex items-center gap-2 mx-auto text-sm hover:opacity-80 transition-opacity"
                style={{ color: 'var(--color-brand-blue)' }}
              >
                <RefreshCw className="h-4 w-4" />
                Renvoyer le code
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
