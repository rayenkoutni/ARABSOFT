'use client'

import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react'

interface NotificationContextType {
  refreshKey: number
  triggerRefresh: () => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [refreshKey, setRefreshKey] = useState(0)

  const triggerRefresh = useCallback(() => {
    setRefreshKey(prev => prev + 1)
  }, [])

  useEffect(() => {
    const handleRefresh = () => triggerRefresh()
    window.addEventListener('refreshNotifications', handleRefresh)
    return () => window.removeEventListener('refreshNotifications', handleRefresh)
  }, [triggerRefresh])

  return (
    <NotificationContext.Provider value={{ refreshKey, triggerRefresh }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotificationRefresh() {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    return { refreshKey: 0, triggerRefresh: () => {} }
  }
  return context
}
