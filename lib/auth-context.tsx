'use client'

import { createContext, useContext, useState, ReactNode, useEffect } from 'react'
import { User, UserRole } from './types'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  switchRole?: (role: UserRole) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Simulate auth check on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Simulate checking if user is logged in
        const storedUser = localStorage.getItem('hr_user')
        if (storedUser) {
          setUser(JSON.parse(storedUser))
        }
      } catch (error) {
        console.error('Auth check failed:', error)
      } finally {
        setIsLoading(false)
      }
    }
    checkAuth()
  }, [])

  const login = async (email: string, password: string) => {
    setIsLoading(true)
    try {
      // Simulate login with demo users
      const demoUsers: Record<string, User> = {
        'admin@company.com': {
          id: '1',
          email: 'admin@company.com',
          name: 'Admin User',
          role: 'RH',
          department: 'Human Resources',
          createdAt: new Date(),
        },
        'manager@company.com': {
          id: '2',
          email: 'manager@company.com',
          name: 'Manager User',
          role: 'CHEF',
          department: 'Operations',
          createdAt: new Date(),
        },
        'employee@company.com': {
          id: '3',
          email: 'employee@company.com',
          name: 'Employee User',
          role: 'COLLABORATEUR',
          department: 'Sales',
          manager: 'Manager User',
          createdAt: new Date(),
        },
      }

      const foundUser = demoUsers[email]
      if (foundUser && password === 'demo') {
        setUser(foundUser)
        localStorage.setItem('hr_user', JSON.stringify(foundUser))
      } else {
        throw new Error('Invalid credentials')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('hr_user')
  }

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
