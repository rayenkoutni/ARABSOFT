'use client'

import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/lib'
import { useNotificationRefresh } from '@/lib/notification-context'
import { usePathname, useRouter } from 'next/navigation'
import { MessageNotificationPopup } from '@/components/message-notification-popup'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

interface MessageData {
  id: string
  content: string
  conversationId: string
  sender: {
    id: string
    name: string
    email: string
    role: string
  }
  createdAt: string
}

export function GlobalMessageHandler() {
  const { user, socket } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [popupNotification, setPopupNotification] = useState<{
    id: string
    conversationId: string
    senderName: string
    senderInitials: string
    messagePreview: string
    timestamp: Date
  } | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const prevMessagesRef = useRef<Set<string>>(new Set())

  // Initialize audio context
  useEffect(() => {
    if (typeof window !== 'undefined') {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
  }, [])

  // Play notification sound
  const playNotificationSound = () => {
    if (!audioContextRef.current) return
    
    try {
      const ctx = audioContextRef.current
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)
      
      oscillator.frequency.value = 800
      oscillator.type = 'sine'
      
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2)
      
      oscillator.start(ctx.currentTime)
      oscillator.stop(ctx.currentTime + 0.2)
    } catch (error) {
      console.error('Error playing notification sound:', error)
    }
  }

  // Get initials from name
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  // Handle popup navigation
  const handlePopupNavigate = (conversationId: string) => {
    router.push(`/dashboard/chat?conversation=${conversationId}`)
    setPopupNotification(null)
  }

  // Listen for messages from global socket
  useEffect(() => {
    if (!socket || !user) return

    const handleNewMessage = (message: MessageData) => {
      // Skip if message is from current user
      if (message.sender.id === user.id) return

      // Skip if already shown this message
      if (prevMessagesRef.current.has(message.id)) return
      prevMessagesRef.current.add(message.id)

      const isOnChatPage = pathname === '/dashboard/chat'
      
      if (!isOnChatPage) {
        // Not on chat page - show popup notification + sound
        playNotificationSound()
        
        setPopupNotification({
          id: message.id,
          conversationId: message.conversationId,
          senderName: message.sender.name,
          senderInitials: getInitials(message.sender.name),
          messagePreview: message.content.substring(0, 60),
          timestamp: new Date(message.createdAt)
        })
        
        // Refresh notifications to update badge
        console.log("📨 Dispatching refreshNotifications event")
        window.dispatchEvent(new Event('refreshNotifications'))
      } else {
        // On chat page - just play sound
        playNotificationSound()
      }
    }

    socket.on('new_message', handleNewMessage)

    return () => {
      socket.off('new_message', handleNewMessage)
    }
  }, [socket, user, pathname, router])

  if (!user || !socket) return null

  return (
    <MessageNotificationPopup
      notification={popupNotification}
      onDismiss={() => setPopupNotification(null)}
      onNavigate={handlePopupNavigate}
    />
  )
}
