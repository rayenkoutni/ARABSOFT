'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, UserRole } from '../types'
import { io, Socket } from 'socket.io-client'

interface AuthContextType {
  user: User | null
  pendingUser: User | null
  isLoading: boolean
  isAuthenticated: boolean
  isOtpVerified: boolean
  login: (email: string, password: string) => Promise<"session" | "otp">
  logout: () => Promise<void>
  completeOtpVerification: () => Promise<void>
  switchRole?: (role: UserRole) => void
  socket: Socket | null
  setOtpVerified: (verified: boolean) => void
  updateCurrentUser: (patch: Partial<User>) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [pendingUser, setPendingUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isOtpVerified, setIsOtpVerified] = useState(false)

  useEffect(() => {
    if (user) {
      const socketInstance = io({
        path: '/socket.io',
        transports: ['websocket', 'polling'],
      })

      setSocket(socketInstance)

      return () => {
        socketInstance.disconnect()
      }
    }

    if (socket) {
      socket.disconnect()
      setSocket(null)
    }
  }, [user])

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/me')
        if (res.ok) {
          const data = await res.json()
          if (data.authenticated && data.user) {
            setUser(data.user)
            setPendingUser(null)
            setIsOtpVerified(true)
            localStorage.setItem('hr_user', JSON.stringify(data.user))
          } else {
            setUser(null)
            setPendingUser(null)
            setIsOtpVerified(false)
            localStorage.removeItem('hr_user')
          }
        } else {
          setUser(null)
          setPendingUser(null)
          setIsOtpVerified(false)
          localStorage.removeItem('hr_user')
        }
      } catch (error) {
        console.error('Auth check failed:', error)
        setUser(null)
        setPendingUser(null)
        setIsOtpVerified(false)
        localStorage.removeItem('hr_user')
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [])

  const login = async (email: string, password: string): Promise<"session" | "otp"> => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const responseText = await res.text()
      const data = responseText ? JSON.parse(responseText) : null

      if (!res.ok) {
        throw new Error(data?.error || 'Erreur lors de la connexion')
      }

      if (!data) {
        throw new Error('Reponse de connexion invalide')
      }

      if (data.nextStep === 'session') {
        setUser(data.user)
        setPendingUser(null)
        setIsOtpVerified(true)
        localStorage.setItem('hr_user', JSON.stringify(data.user))
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('otp_pending')
        }
        return 'session'
      }

      setPendingUser(data.user)
      setUser(null)
      setIsOtpVerified(false)
      localStorage.removeItem('hr_user')
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('otp_pending', 'true')
      }
      return 'otp'
    } finally {
      setIsLoading(false)
    }
  }

  const completeOtpVerification = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' })
      const data = res.ok ? await res.json() : null

      if (!res.ok || !data?.authenticated || !data.user) {
        throw new Error('Session introuvable apres verification OTP')
      }

      setUser(data.user)
      setPendingUser(null)
      setIsOtpVerified(true)
      localStorage.setItem('hr_user', JSON.stringify(data.user))
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('otp_pending')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      setUser(null)
      setPendingUser(null)
      setIsOtpVerified(false)
      localStorage.removeItem('hr_user')
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('otp_pending')
      }
    }
  }

  const switchRole = (role: UserRole) => {
    if (!user) return
    setUser((currentUser) => (currentUser ? { ...currentUser, role } : currentUser))
  }

  const updateCurrentUser = (patch: Partial<User>) => {
    setUser((currentUser) => (currentUser ? { ...currentUser, ...patch } : currentUser))
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        pendingUser,
        isLoading,
        isAuthenticated: !!user,
        isOtpVerified,
        login,
        logout,
        completeOtpVerification,
        switchRole,
        socket,
        setOtpVerified: setIsOtpVerified,
        updateCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
