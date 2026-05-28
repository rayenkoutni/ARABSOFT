'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, UserRole } from '../types'
import { io, Socket } from 'socket.io-client'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  isOtpVerified: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  switchRole?: (role: UserRole) => void
  socket: Socket | null
  setOtpVerified: (verified: boolean) => void
}

const STORAGE_KEY_PREFIX = 'trusted_device_'

function getInitialOtpVerified(userId: string): boolean {
  if (typeof window === 'undefined') return false
  const key = STORAGE_KEY_PREFIX + userId
  const stored = localStorage.getItem(key)
  if (!stored) return false

  try {
    const data = JSON.parse(stored)
    return Boolean(data.expiresAt && new Date(data.expiresAt).getTime() > Date.now())
  } catch {
    return false
  }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [socket, setSocket] = useState<Socket | null>(null)

  const [initialUser] = useState<User | null>(() => {
    if (typeof window === 'undefined') {
      return null
    }

    const stored = localStorage.getItem('hr_user')
    if (!stored) {
      return null
    }

    try {
      return JSON.parse(stored)
    } catch {
      return null
    }
  })

  const [isOtpVerified, setIsOtpVerified] = useState<boolean>(() =>
    initialUser ? getInitialOtpVerified(initialUser.id) : false,
  )

  useEffect(() => {
    if (user) {
      setIsOtpVerified(getInitialOtpVerified(user.id))
    }
  }, [user])

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
            localStorage.setItem('hr_user', JSON.stringify(data.user))
          } else {
            setUser(null)
            localStorage.removeItem('hr_user')
          }
        } else {
          setUser(null)
          localStorage.removeItem('hr_user')
        }
      } catch (error) {
        console.error('Auth check failed:', error)
        setUser(null)
        localStorage.removeItem('hr_user')
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [])

  const login = async (email: string, password: string) => {
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

      setUser(data)
      localStorage.setItem('hr_user', JSON.stringify(data))
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('otp_pending', 'true')
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
      localStorage.removeItem('hr_user')
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('otp_pending')
      }
    }
  }

  const switchRole = (role: UserRole) => {
    if (!user) return

    const updatedUser = { ...user, role }
    setUser(updatedUser)
    localStorage.setItem('hr_user', JSON.stringify(updatedUser))
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        isOtpVerified,
        login,
        logout,
        switchRole,
        socket,
        setOtpVerified: setIsOtpVerified,
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
