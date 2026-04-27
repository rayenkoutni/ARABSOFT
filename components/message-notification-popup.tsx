'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MessageNotification {
  id: string
  conversationId: string
  senderName: string
  senderInitials: string
  messagePreview: string
  timestamp: Date
}

interface MessageNotificationPopupProps {
  notification: MessageNotification | null
  onDismiss: () => void
  onNavigate: (conversationId: string) => void
}

export function MessageNotificationPopup({
  notification,
  onDismiss,
  onNavigate
}: MessageNotificationPopupProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [progress, setProgress] = useState(100)
  const router = useRouter()
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (notification) {
      setIsVisible(true)
      setProgress(100)

      // Auto-dismiss after 10 seconds
      timerRef.current = setTimeout(() => {
        handleDismiss()
      }, 10000)

      // Progress bar countdown
      progressTimerRef.current = setInterval(() => {
        setProgress(prev => {
          if (prev <= 0) {
            if (progressTimerRef.current) {
              clearInterval(progressTimerRef.current)
            }
            return 0
          }
          return prev - 1
        })
      }, 100) // 100ms interval for smooth animation (100 steps over 10 seconds)

      return () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current)
        }
        if (progressTimerRef.current) {
          clearInterval(progressTimerRef.current)
        }
      }
    } else {
      setIsVisible(false)
    }
  }, [notification])

  const handleDismiss = () => {
    setIsVisible(false)
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current)
    }
    setTimeout(() => {
      onDismiss()
    }, 300) // Wait for animation to complete
  }

  const handleClick = () => {
    if (notification) {
      onNavigate(notification.conversationId)
      handleDismiss()
    }
  }

  if (!notification) return null

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-50 w-80 bg-white dark:bg-slate-800 rounded-lg shadow-2xl border border-gray-200 dark:border-slate-700 overflow-hidden transition-all duration-300 ease-out",
        isVisible
          ? "translate-y-0 opacity-100"
          : "translate-y-full opacity-0"
      )}
      style={{
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)'
      }}
    >
      {/* Clickable content area */}
      <button
        onClick={handleClick}
        className="w-full p-3 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors text-left"
      >
        <Avatar className="h-10 w-10 flex-shrink-0">
          <AvatarFallback className="bg-blue-500 text-white text-sm">
            {notification.senderInitials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm text-gray-900 dark:text-slate-100 truncate">
              {notification.senderName}
            </h4>
            <span className="text-xs text-gray-500 dark:text-slate-400 ml-2 flex-shrink-0">
              {formatTimestamp(notification.timestamp)}
            </span>
          </div>
          <p className="text-sm text-gray-600 dark:text-slate-300 mt-0.5 line-clamp-2">
            {notification.messagePreview}
          </p>
        </div>
      </button>

      {/* Dismiss button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          handleDismiss()
        }}
        className="absolute top-2 right-2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
        aria-label="Fermer"
      >
        <X className="h-4 w-4 text-gray-500 dark:text-slate-400" />
      </button>

      {/* Progress bar */}
      <div className="h-1 bg-gray-200 dark:bg-slate-700">
        <div
          className="h-full bg-blue-500 transition-all duration-100 linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}

function formatTimestamp(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)

  if (diffSeconds < 60) {
    return "À l'instant"
  } else if (diffMinutes < 60) {
    return `Il y a ${diffMinutes} min`
  } else {
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }
}
