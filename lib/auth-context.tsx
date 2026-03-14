'use client'

import { createContext, useContext, useState, ReactNode, useEffect } from 'react'
import { User, UserRole } from './types'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  switchRole?: (role: UserRole) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Auth check on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/me")
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
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Invalid credentials')
      }

      const foundUser = await res.json()
      setUser(foundUser)
      localStorage.setItem('hr_user', JSON.stringify(foundUser))
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } finally {
      setUser(null)
      localStorage.removeItem('hr_user')
    }
  }

  // switchRole is kept to avoid breaking Settings UI typing, but doesn't actually mutate database role
  const switchRole = (role: UserRole) => {
    if (user) {
      const updatedUser = { ...user, role }
      setUser(updatedUser)
      localStorage.setItem('hr_user', JSON.stringify(updatedUser))
    }
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, login, logout, switchRole }}>
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
